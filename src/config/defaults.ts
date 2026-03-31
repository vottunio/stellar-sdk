import { LoggingConfig, RetryConfig, TimeoutConfig } from '../types/config.types';

/**
 * Default logging configuration.
 */
export const DEFAULT_LOGGING: LoggingConfig = {
  level: 'none',
};

/**
 * Default timeout configuration (in milliseconds).
 */
export const DEFAULT_TIMEOUT: TimeoutConfig = {
  horizon: 30_000,
  api: 15_000,
  websocket: 10_000,
};

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 3,
  backoffMultiplier: 1.5,
};
