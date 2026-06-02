import {
  LoggingConfig,
  NetworkType,
  RetryConfig,
  TimeoutConfig,
} from '../types/config.types';

/**
 * Default logging configuration.
 */
export const DEFAULT_LOGGING: LoggingConfig = {
  level: 'none',
};

/**
 * Network-specific default timeout configurations (in milliseconds).
 *
 * Tuned for production reliability:
 * - **Mainnet** values are conservative — wider windows tolerate congestion-induced
 *   latency without false-failing legitimate operations. Stellar mainnet can see
 *   p99 Horizon latencies up to ~10s during peak load.
 * - **Testnet** values are tighter — testnet is lightly loaded and we want fast
 *   failure on connectivity issues during development.
 *
 * `transactionSeconds` is the value passed to Stellar's `Transaction.setTimeout()`,
 * controlling how long a transaction can sit in the mempool before expiring.
 */
const TIMEOUTS_TESTNET: TimeoutConfig = {
  horizon: 30_000,
  api: 15_000,
  websocket: 10_000,
  transactionSeconds: 30,
  soroban: 30_000,
};

const TIMEOUTS_MAINNET: TimeoutConfig = {
  horizon: 60_000,
  api: 30_000,
  websocket: 15_000,
  transactionSeconds: 180,
  soroban: 60_000,
};

/** Default timeout configuration for a given network. */
export function getDefaultTimeouts(network: NetworkType): TimeoutConfig {
  return network === 'mainnet' ? { ...TIMEOUTS_MAINNET } : { ...TIMEOUTS_TESTNET };
}

/**
 * Default timeout configuration (testnet — preserved for backward compatibility).
 * @deprecated Prefer {@link getDefaultTimeouts} for network-aware defaults.
 */
export const DEFAULT_TIMEOUT: TimeoutConfig = TIMEOUTS_TESTNET;

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 3,
  backoffMultiplier: 1.5,
};
