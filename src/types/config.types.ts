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
 */
export interface TimeoutConfig {
  horizon: number;
  api: number;
  websocket: number;
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
