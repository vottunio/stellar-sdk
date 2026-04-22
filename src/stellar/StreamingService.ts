import { Horizon } from '@stellar/stellar-sdk';

import { Logger } from '../config/Logger';
import { ResolvedConfig } from '../types/config.types';
import { StreamCallback, StreamCloseFn } from '../types/stellar.types';

// The Stellar SDK types `onmessage` as `(value: CollectionPage<T>) => void`
// but at runtime SSE delivers individual records. This is a known SDK typing
// issue. We use a generic stream helper with a safe cast to work around it.
type StreamOptions<T> = {
  onmessage: (record: T) => void;
  onerror?: (error: unknown) => void;
};

/**
 * Horizon SSE (Server-Sent Events) streaming service.
 *
 * Provides real-time streaming of transactions, payments, operations,
 * and effects from the Stellar Horizon server with automatic cursor
 * management for resume-on-reconnect.
 *
 * Accessed via `sdk.stellar.stream`.
 *
 * @example
 * ```typescript
 * const close = sdk.stellar.stream.transactions('G...', (tx) => {
 *   console.log(`New tx: ${tx.hash} in ledger ${tx.ledger}`);
 * });
 *
 * // Stop streaming when done
 * close();
 * ```
 */
export class StreamingService {
  private readonly config: ResolvedConfig;
  private readonly logger: Logger;
  private readonly cursors = new Map<string, string>();

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.logger = new Logger(config.logging.level, 'StreamingService');
  }

  /**
   * Stream transactions for an account in real-time.
   * Resumes from the last seen cursor on reconnect.
   */
  transactions(
    account: string,
    onMessage: StreamCallback<Horizon.ServerApi.TransactionRecord>,
    onError?: StreamCallback<Error>,
  ): StreamCloseFn {
    const cursorKey = `transactions:${account}`;
    const server = new Horizon.Server(this.config.horizonUrl);

    this.logger.info(`Streaming transactions for ${account}`);

    let builder = server.transactions().forAccount(account);
    builder = this.applyCursor(builder, cursorKey);

    return this.startStream(builder, cursorKey, onMessage, onError, `transaction stream for ${account}`);
  }

  /**
   * Stream payment operations for an account in real-time.
   */
  payments(
    account: string,
    onMessage: StreamCallback<Horizon.ServerApi.PaymentOperationRecord>,
    onError?: StreamCallback<Error>,
  ): StreamCloseFn {
    const cursorKey = `payments:${account}`;
    const server = new Horizon.Server(this.config.horizonUrl);

    this.logger.info(`Streaming payments for ${account}`);

    let builder = server.payments().forAccount(account);
    builder = this.applyCursor(builder, cursorKey);

    return this.startStream(builder, cursorKey, onMessage, onError, `payment stream for ${account}`);
  }

  /**
   * Stream all operations for an account in real-time.
   */
  operations(
    account: string,
    onMessage: StreamCallback<Horizon.ServerApi.OperationRecord>,
    onError?: StreamCallback<Error>,
  ): StreamCloseFn {
    const cursorKey = `operations:${account}`;
    const server = new Horizon.Server(this.config.horizonUrl);

    this.logger.info(`Streaming operations for ${account}`);

    let builder = server.operations().forAccount(account);
    builder = this.applyCursor(builder, cursorKey);

    return this.startStream(builder, cursorKey, onMessage, onError, `operation stream for ${account}`);
  }

  /**
   * Stream effects for an account in real-time.
   */
  effects(
    account: string,
    onMessage: StreamCallback<Horizon.ServerApi.EffectRecord>,
    onError?: StreamCallback<Error>,
  ): StreamCloseFn {
    const cursorKey = `effects:${account}`;
    const server = new Horizon.Server(this.config.horizonUrl);

    this.logger.info(`Streaming effects for ${account}`);

    let builder = server.effects().forAccount(account);
    builder = this.applyCursor(builder, cursorKey);

    return this.startStream(builder, cursorKey, onMessage, onError, `effect stream for ${account}`);
  }

  /**
   * Stream new ledgers in real-time.
   */
  ledgers(
    onMessage: StreamCallback<Horizon.ServerApi.LedgerRecord>,
    onError?: StreamCallback<Error>,
  ): StreamCloseFn {
    const cursorKey = 'ledgers';
    const server = new Horizon.Server(this.config.horizonUrl);

    this.logger.info('Streaming ledgers');

    let builder = server.ledgers();
    builder = this.applyCursor(builder, cursorKey);

    return this.startStream(builder, cursorKey, onMessage, onError, 'ledger stream');
  }

  // ─── Cursor Management ────────────────────────────────────────────────────

  /** Get the last saved cursor for a stream. */
  getCursor(key: string): string | undefined {
    return this.cursors.get(key);
  }

  /** Manually set a cursor for a stream (to resume from a specific point). */
  setCursor(key: string, cursor: string): void {
    this.cursors.set(key, cursor);
  }

  /** Clear all saved cursors. */
  clearCursors(): void {
    this.cursors.clear();
  }

  // ─── Internal Helpers ─────────────────────────────────────────────────────

  private applyCursor<T extends { cursor: (c: string) => T }>(builder: T, cursorKey: string): T {
    const savedCursor = this.cursors.get(cursorKey);
    if (savedCursor) {
      this.logger.debug(`Resuming from cursor: ${savedCursor}`);
      return builder.cursor(savedCursor);
    }
    return builder.cursor('now');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private startStream<T extends { paging_token: string }>(
    builder: { stream: (options: any) => () => void },
    cursorKey: string,
    onMessage: StreamCallback<T>,
    onError: StreamCallback<Error> | undefined,
    label: string,
  ): StreamCloseFn {
    const options: StreamOptions<T> = {
      onmessage: (record: T) => {
        this.cursors.set(cursorKey, record.paging_token);
        onMessage(record);
      },
      onerror: (error: unknown) => {
        this.logger.error(`${label} error: ${String(error)}`);
        if (onError && error instanceof Error) {
          onError(error);
        }
      },
    };

    const close = builder.stream(options);

    return () => {
      this.logger.debug(`Closing ${label}`);
      close();
    };
  }
}
