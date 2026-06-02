import { Logger } from '../config/Logger';
import { getErrorMessage } from '../errors/utils';
import {
  WebSocketEventName,
  EventHandler,
  SubscriptionFilter,
} from '../types/websocket.types';

/**
 * Type-safe event dispatcher for WebSocket messages.
 *
 * Manages event handler registration and dispatches incoming messages
 * to the appropriate handlers. Supports subscription filters for
 * account-specific or asset-specific event routing.
 */
export class EventRouter {
  private readonly handlers = new Map<WebSocketEventName, Set<EventHandler>>();
  private readonly filters: SubscriptionFilter[] = [];
  private readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger('none', 'EventRouter');
  }

  /**
   * Register an event handler for a specific event type.
   * @param event - The event name to listen for.
   * @param handler - Callback invoked when the event fires.
   * @returns Unsubscribe function to remove this handler.
   */
  on<T = unknown>(event: WebSocketEventName, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);

    return () => {
      this.handlers.get(event)?.delete(handler as EventHandler);
    };
  }

  /**
   * Remove all handlers for a specific event, or all handlers if no event specified.
   */
  off(event?: WebSocketEventName): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Add a subscription filter. Events that don't match any active filter
   * will be dropped (unless no filters are registered, in which case all pass).
   * @param filter - Filter criteria (events, account, asset).
   */
  subscribe(filter: SubscriptionFilter): void {
    this.filters.push(filter);
  }

  /** Clear all subscription filters. */
  clearFilters(): void {
    this.filters.length = 0;
  }

  /**
   * Dispatch an event to all matching handlers.
   * @param event - The event name.
   * @param payload - The event payload data.
   */
  dispatch(event: WebSocketEventName, payload: unknown): void {
    if (!this.matchesFilters(event, payload)) {
      return;
    }

    const handlers = this.handlers.get(event);
    if (!handlers || handlers.size === 0) {
      return;
    }

    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (error) {
        // Don't let one bad handler break others, but surface the error
        // so callers can find bugs in their handlers.
        this.logger.warn(
          `Event handler for "${event}" threw: ${getErrorMessage(error)}`,
        );
      }
    }
  }

  /** Get the count of registered handlers for an event. */
  handlerCount(event: WebSocketEventName): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  /** Check if any handlers are registered for an event. */
  hasHandlers(event: WebSocketEventName): boolean {
    return this.handlerCount(event) > 0;
  }

  /**
   * Check if an event+payload matches the active subscription filters.
   * If no filters are registered, all events pass.
   */
  private matchesFilters(event: WebSocketEventName, payload: unknown): boolean {
    if (this.filters.length === 0) {
      return true;
    }

    return this.filters.some((filter) => {
      // Check event name filter
      if (filter.events && filter.events.length > 0 && !filter.events.includes(event)) {
        return false;
      }

      // Check account filter
      if (filter.account && payload && typeof payload === 'object') {
        const p = payload as Record<string, unknown>;
        const payloadAccount = p.account ?? p.from ?? p.to ?? p.source_account;
        if (payloadAccount && payloadAccount !== filter.account) {
          return false;
        }
      }

      // Check asset filter
      if (filter.asset && payload && typeof payload === 'object') {
        const p = payload as Record<string, unknown>;
        if (p.asset && p.asset !== filter.asset) {
          return false;
        }
      }

      return true;
    });
  }
}
