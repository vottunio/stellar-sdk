import { Logger } from '../config/Logger';

/**
 * Configuration for the rate limiter.
 */
export interface RateLimiterConfig {
  /** Maximum requests allowed per window. Default: 100. */
  maxRequests: number;
  /** Window duration in milliseconds. Default: 10_000 (10s). */
  windowMs: number;
}

const DEFAULT_RATE_LIMIT: RateLimiterConfig = {
  maxRequests: 100,
  windowMs: 10_000,
};

/**
 * Client-side sliding-window rate limiter for Horizon/Soroban API requests.
 *
 * Features:
 * - Sliding window with timestamp tracking
 * - Respects `Retry-After` headers from 429 responses
 * - Automatically throttles requests when approaching the limit
 * - Thread-safe via sequential awaiting (Node.js single-threaded)
 */
export class RateLimiter {
  private readonly config: RateLimiterConfig;
  private readonly logger: Logger;
  private readonly timestamps: number[] = [];
  private retryAfterUntil = 0;

  constructor(config?: Partial<RateLimiterConfig>, logger?: Logger) {
    this.config = { ...DEFAULT_RATE_LIMIT, ...config };
    this.logger = logger ?? new Logger('none', 'RateLimiter');
  }

  /**
   * Wait until a request is allowed under the current rate limit.
   * Call this before every outbound request.
   */
  async acquire(): Promise<void> {
    // Respect server-mandated Retry-After
    const now = Date.now();
    if (this.retryAfterUntil > now) {
      const waitMs = this.retryAfterUntil - now;
      this.logger.debug(`Rate limited by server, waiting ${waitMs}ms`);
      await this.sleep(waitMs);
    }

    // Slide the window — discard timestamps older than the window
    this.pruneWindow();

    // If at capacity, wait until the oldest request in the window expires
    if (this.timestamps.length >= this.config.maxRequests) {
      const oldestTs = this.timestamps[0];
      const waitMs = oldestTs + this.config.windowMs - Date.now() + 1;
      if (waitMs > 0) {
        this.logger.debug(
          `Client rate limit reached (${this.timestamps.length}/${this.config.maxRequests}), ` +
          `waiting ${waitMs}ms`,
        );
        await this.sleep(waitMs);
        this.pruneWindow();
      }
    }

    this.timestamps.push(Date.now());
  }

  /**
   * Notify the limiter of a 429 response with an optional `Retry-After` header.
   * The limiter will block subsequent `acquire()` calls until the specified time.
   *
   * @param retryAfterHeader - Value of the `Retry-After` response header (seconds or HTTP-date).
   */
  onRateLimited(retryAfterHeader?: string): void {
    let delayMs = 1000; // default 1s backoff if no header

    if (retryAfterHeader) {
      const seconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(seconds)) {
        delayMs = seconds * 1000;
      } else {
        // Try parsing as HTTP-date
        const date = new Date(retryAfterHeader).getTime();
        if (!isNaN(date)) {
          delayMs = Math.max(date - Date.now(), 0);
        }
      }
    }

    this.retryAfterUntil = Date.now() + delayMs;
    this.logger.debug(`Server rate limit received, backing off for ${delayMs}ms`);
  }

  /** Number of requests remaining in the current window. */
  get remaining(): number {
    this.pruneWindow();
    return Math.max(this.config.maxRequests - this.timestamps.length, 0);
  }

  /** Whether the limiter is currently blocked by a server Retry-After. */
  get isBlocked(): boolean {
    return Date.now() < this.retryAfterUntil;
  }

  private pruneWindow(): void {
    const cutoff = Date.now() - this.config.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0] <= cutoff) {
      this.timestamps.shift();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
