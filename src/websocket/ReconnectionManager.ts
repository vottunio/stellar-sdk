import { Logger } from '../config/Logger';
import { RetryConfig } from '../types/config.types';

/**
 * Manages WebSocket reconnection with exponential backoff.
 *
 * Tracks connection attempts and computes delay between retries.
 * Respects the configured max attempts and backoff multiplier.
 */
export class ReconnectionManager {
  private readonly retryConfig: RetryConfig;
  private readonly logger: Logger;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(retryConfig: RetryConfig, logger: Logger) {
    this.retryConfig = retryConfig;
    this.logger = logger;
  }

  /**
   * Schedule a reconnection attempt after the appropriate backoff delay.
   * @param callback - Function to call when it's time to reconnect.
   * @returns True if a reconnection was scheduled, false if max attempts exhausted.
   */
  scheduleReconnect(callback: () => void): boolean {
    if (this.attempt >= this.retryConfig.maxAttempts) {
      this.logger.error(
        `Max reconnection attempts (${this.retryConfig.maxAttempts}) exhausted`,
      );
      return false;
    }

    const delay = this.getDelay();
    this.attempt++;

    this.logger.info(
      `Reconnecting in ${delay}ms (attempt ${this.attempt}/${this.retryConfig.maxAttempts})`,
    );

    this.reconnectTimer = setTimeout(callback, delay);
    return true;
  }

  /** Reset the attempt counter (call on successful connection). */
  reset(): void {
    this.attempt = 0;
    this.cancelPending();
  }

  /** Cancel any pending reconnection timer. */
  cancelPending(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Get the current attempt count. */
  getAttemptCount(): number {
    return this.attempt;
  }

  /** Compute backoff delay for the current attempt. Capped at 30 seconds. */
  private getDelay(): number {
    const baseDelay = 1000;
    const delay = baseDelay * Math.pow(this.retryConfig.backoffMultiplier, this.attempt);
    return Math.min(delay, 30000);
  }
}
