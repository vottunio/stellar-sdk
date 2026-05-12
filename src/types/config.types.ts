/**
 * Supported Stellar networks.
 */
export type NetworkType = 'testnet' | 'mainnet';

/**
 * Logging severity levels.
 */
export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

/**
 * Network-specific configuration preset.
 */
export interface NetworkConfig {
  horizonUrl: string;
  sorobanRpcUrl: string;
  networkPassphrase: string;
}

/**
 * Logging configuration.
 */
export interface LoggingConfig {
  level: LogLevel;
}

/**
 * Per-service timeout configuration (in milliseconds).
 *
 * Defaults differ between testnet and mainnet:
 * - **Testnet** uses lower timeouts (faster fail) since the network is lightly loaded.
 * - **Mainnet** uses higher timeouts to tolerate congestion-induced latency
 *   without false-failing legitimate operations.
 */
export interface TimeoutConfig {
  /** Timeout for direct Horizon REST calls (ms). */
  horizon: number;
  /** Timeout for the underlying HTTP API client (ms). */
  api: number;
  /** Timeout for WebSocket connection establishment (ms). */
  websocket: number;
  /**
   * Stellar transaction `setTimeout()` value, in **seconds**.
   * Sets the maximum amount of time a transaction can wait in the
   * mempool before expiring. Stellar best practice: 30s for testnet,
   * 180s for mainnet to handle congestion.
   */
  transactionSeconds: number;
  /** Timeout for Soroban RPC calls (ms). Soroban operations are slower than Horizon. */
  soroban: number;
}

/**
 * Retry policy configuration.
 */
export interface RetryConfig {
  maxAttempts: number;
  backoffMultiplier: number;
}

/**
 * Main SDK configuration interface.
 */
export interface WirexSDKConfig {
  network: NetworkType;
  horizonUrl?: string;
  sorobanRpcUrl?: string;
  externalApiUrl?: string;
  logging?: Partial<LoggingConfig>;
  timeout?: Partial<TimeoutConfig>;
  retry?: Partial<RetryConfig>;
}

/**
 * Fully resolved SDK configuration (all defaults applied).
 */
export interface ResolvedConfig {
  network: NetworkType;
  horizonUrl: string;
  sorobanRpcUrl: string;
  externalApiUrl?: string;
  networkPassphrase: string;
  logging: LoggingConfig;
  timeout: TimeoutConfig;
  retry: RetryConfig;
}
