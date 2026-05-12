import WebSocket from 'ws';

import { Logger } from '../config/Logger';
import { getErrorMessage, truncate } from '../errors/utils';
import { ResolvedConfig } from '../types/config.types';
import {
  ConnectionState,
  EventHandler,
  SubscriptionFilter,
  WebSocketEventName,
} from '../types/websocket.types';

import { EventRouter } from './EventRouter';
import { ReconnectionManager } from './ReconnectionManager';

/**
 * WebSocket client for real-time event streaming.
 *
 * Provides connection management with auto-reconnection, heartbeat keep-alive,
 * type-safe event subscription, and server-side event filtering.
 *
 * **Runtime requirements:**
 * - **Node.js**: depends on the `ws` package (peer-installed automatically).
 * - **Browser / React Native**: requires bundler aliasing of `ws` to the
 *   platform's native `WebSocket` global (Vite/webpack typically handle this
 *   via the `browser` field in `ws`'s package.json). If your bundler does
 *   not, configure an alias: `'ws': 'isomorphic-ws'` or similar.
 *
 * **Browser-friendly alternative:** For Horizon-only streaming (transactions,
 * payments, effects), prefer `sdk.stellar.stream.*` (SSE-based) which works
 * natively in every browser and React Native without any polyfill.
 *
 * Accessed via `sdk.websocket`.
 *
 * @example
 * ```typescript
 * const ws = sdk.websocket;
 *
 * // Listen for lifecycle events
 * ws.on('connected', () => console.log('Connected'));
 * ws.on('disconnected', () => console.log('Disconnected'));
 * ws.on('error', (err) => console.error(err));
 *
 * // Subscribe to payment events for a specific account
 * ws.subscribe({ events: ['payment.received'], account: 'G...' });
 * ws.on('payment.received', (payment) => {
 *   console.log(`Received ${payment.amount} ${payment.asset}`);
 * });
 *
 * // Connect
 * await ws.connect('wss://example.com/ws');
 *
 * // Disconnect when done
 * ws.disconnect();
 * ```
 */
export class WebSocketClient {
  private readonly config: ResolvedConfig;
  private readonly logger: Logger;
  private readonly router: EventRouter;
  private readonly reconnectionManager: ReconnectionManager;

  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private url: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private autoReconnect = true;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.logger = new Logger(config.logging.level, 'WebSocketClient');
    this.router = new EventRouter(new Logger(config.logging.level, 'EventRouter'));
    this.reconnectionManager = new ReconnectionManager(config.retry, this.logger);
  }

  // ─── 2.4.2: Connect / Disconnect ─────────────────────────────────────────

  /**
   * Connect to a WebSocket server.
   * @param url - WebSocket URL (wss:// or ws://).
   */
  async connect(url: string): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      this.logger.warn('Already connected or connecting');
      return;
    }

    this.url = url;
    this.autoReconnect = true;
    await this.doConnect(url);
  }

  /**
   * Disconnect from the WebSocket server.
   * Stops auto-reconnection and heartbeat.
   */
  disconnect(): void {
    this.autoReconnect = false;
    this.reconnectionManager.cancelPending();
    this.stopHeartbeat();

    if (this.ws) {
      this.setState('disconnected');
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Client disconnect');
      }
      this.ws = null;
    }

    this.router.dispatch('disconnected', undefined);
    this.logger.info('Disconnected');
  }

  // ─── 2.4.5: Event Subscription ───────────────────────────────────────────

  /**
   * Register a handler for a WebSocket event.
   * @param event - Event name (e.g. 'payment.received', 'connected', 'error').
   * @param handler - Callback function.
   * @returns Unsubscribe function.
   */
  on<T = unknown>(event: WebSocketEventName, handler: EventHandler<T>): () => void {
    return this.router.on(event, handler);
  }

  /**
   * Remove handlers for a specific event, or all handlers.
   */
  off(event?: WebSocketEventName): void {
    this.router.off(event);
  }

  // ─── 2.4.6: Event Filtering ──────────────────────────────────────────────

  /**
   * Add a subscription filter. Only events matching at least one filter
   * will be dispatched to handlers.
   * @param filter - Filter criteria (events, account, asset).
   */
  subscribe(filter: SubscriptionFilter): void {
    this.router.subscribe(filter);
    this.logger.debug(`Subscription filter added: ${JSON.stringify(filter)}`);
  }

  /** Clear all subscription filters (all events will be dispatched). */
  clearFilters(): void {
    this.router.clearFilters();
  }

  // ─── 2.4.7: Connection Status ────────────────────────────────────────────

  /** Get the current connection state. */
  getState(): ConnectionState {
    return this.state;
  }

  /** Check if currently connected. */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  // ─── Internal: Connection ─────────────────────────────────────────────────

  private doConnect(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.setState('connecting');
      this.logger.info(`Connecting to ${url}`);

      try {
        this.ws = new WebSocket(url);
      } catch (error) {
        this.setState('disconnected');
        reject(error);
        return;
      }

      const onOpen = () => {
        cleanup();
        this.setState('connected');
        this.reconnectionManager.reset();
        this.startHeartbeat();
        this.router.dispatch('connected', undefined);
        this.logger.info('Connected');
        resolve();
      };

      const onError = (error: Error) => {
        cleanup();
        this.setState('disconnected');
        this.router.dispatch('error', { message: error.message });
        this.logger.error(`Connection error: ${error.message}`);
        reject(error);
      };

      const onClose = () => {
        cleanup();
        this.handleClose();
      };

      const cleanup = () => {
        this.ws?.removeListener('open', onOpen);
        this.ws?.removeListener('error', onError);
        this.ws?.removeListener('close', onClose);
        this.setupPersistentListeners();
      };

      this.ws.on('open', onOpen);
      this.ws.on('error', onError);
      this.ws.on('close', onClose);
    });
  }

  private setupPersistentListeners(): void {
    if (!this.ws) return;

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data);
    });

    this.ws.on('close', () => {
      this.handleClose();
    });

    this.ws.on('error', (error: Error) => {
      this.router.dispatch('error', { message: error.message });
      this.logger.error(`WebSocket error: ${error.message}`);
    });

    this.ws.on('pong', () => {
      this.logger.debug('Pong received');
    });
  }

  private handleMessage(data: WebSocket.Data): void {
    let raw: string;
    try {
      raw = data.toString();
    } catch (error) {
      this.logger.warn(`Failed to read WebSocket message: ${getErrorMessage(error)}`);
      return;
    }

    try {
      const message = JSON.parse(raw);
      const event = message.event as WebSocketEventName | undefined;
      const payload = message.data ?? message.payload ?? message;

      if (event) {
        this.router.dispatch(event, payload);
      }
    } catch (error) {
      // Surface JSON parse failures at warn level so protocol issues are visible.
      // Truncate the raw payload to avoid blowing up logs on huge messages.
      this.logger.warn(
        `Received non-JSON WebSocket message: ${getErrorMessage(error)} ` +
        `(raw: ${truncate(raw, 100)})`,
      );
    }
  }

  // ─── 2.4.3: Auto-Reconnection ────────────────────────────────────────────

  private handleClose(): void {
    this.stopHeartbeat();

    if (this.state === 'disconnected') {
      return; // Intentional disconnect — don't reconnect
    }

    this.setState('reconnecting');
    this.router.dispatch('disconnected', undefined);
    this.logger.warn('Connection closed unexpectedly');

    if (this.autoReconnect && this.url) {
      const url = this.url;
      const scheduled = this.reconnectionManager.scheduleReconnect(() => {
        // ReconnectionManager already enforces maxAttempts. We must not
        // synchronously re-enter handleClose() on failure — that would
        // trigger an immediate next attempt and bypass the backoff schedule.
        // Instead, let the WebSocket's own 'close' event drive the next
        // reconnect via setupPersistentListeners/handleClose.
        this.doConnect(url).catch((error) => {
          this.logger.error(`Reconnection failed: ${getErrorMessage(error)}`);
          // The connection attempt failed before any 'close' event fires,
          // so explicitly schedule the next attempt.
          if (this.autoReconnect && this.state !== 'disconnected') {
            this.setState('reconnecting');
            const next = this.reconnectionManager.scheduleReconnect(() => {
              this.doConnect(url).catch((e) => {
                this.logger.error(`Reconnection failed: ${getErrorMessage(e)}`);
              });
            });
            if (!next) {
              this.setState('disconnected');
              this.router.dispatch('error', {
                message: 'Max reconnection attempts exhausted',
              });
            }
          }
        });
      });

      if (!scheduled) {
        this.setState('disconnected');
        this.router.dispatch('error', { message: 'Max reconnection attempts exhausted' });
      }
    } else {
      this.setState('disconnected');
    }
  }

  // ─── 2.4.4: Heartbeat ────────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const interval = 30000; // 30 seconds

    this.heartbeatInterval = setInterval(() => {
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.ping();
          this.logger.debug('Ping sent');
        }
      } catch (error) {
        // ws.ping() can throw in odd states; stop heartbeat to avoid
        // crashing the interval. The next 'close' event will drive recovery.
        this.logger.warn(`Heartbeat ping failed: ${getErrorMessage(error)}`);
        this.stopHeartbeat();
      }
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private setState(state: ConnectionState): void {
    this.state = state;
  }
}
