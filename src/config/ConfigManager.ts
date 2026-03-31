import { ConfigError, ConfigErrorCode } from '../errors/ConfigError';
import {
  LogLevel,
  NetworkType,
  ResolvedConfig,
  WirexSDKConfig,
} from '../types/config.types';

import { DEFAULT_LOGGING, DEFAULT_RETRY, DEFAULT_TIMEOUT } from './defaults';
import { NETWORK_PRESETS } from './networks';

const VALID_NETWORKS: NetworkType[] = ['testnet', 'mainnet'];
const VALID_LOG_LEVELS: LogLevel[] = ['none', 'error', 'warn', 'info', 'debug'];

/**
 * Manages SDK configuration with validation, defaults, and hot-switching.
 */
export class ConfigManager {
  private config: ResolvedConfig;

  constructor(options: WirexSDKConfig) {
    this.config = this.resolve(options);
  }

  /** Get the current resolved configuration. */
  getConfig(): Readonly<ResolvedConfig> {
    return this.config;
  }

  /** Hot-switch the active network. Re-resolves URLs and passphrase. */
  setNetwork(network: NetworkType): void {
    this.validateNetwork(network);
    const preset = NETWORK_PRESETS[network];
    this.config = {
      ...this.config,
      network,
      horizonUrl: preset.horizonUrl,
      sorobanRpcUrl: preset.sorobanRpcUrl,
      networkPassphrase: preset.networkPassphrase,
    };
  }

  /** Resolve user options into a fully populated config. */
  private resolve(options: WirexSDKConfig): ResolvedConfig {
    this.validate(options);

    const preset = NETWORK_PRESETS[options.network];

    return {
      network: options.network,
      horizonUrl: options.horizonUrl ?? preset.horizonUrl,
      sorobanRpcUrl: options.sorobanRpcUrl ?? preset.sorobanRpcUrl,
      externalApiUrl: options.externalApiUrl,
      networkPassphrase: preset.networkPassphrase,
      logging: {
        ...DEFAULT_LOGGING,
        ...options.logging,
      },
      timeout: {
        ...DEFAULT_TIMEOUT,
        ...options.timeout,
      },
      retry: {
        ...DEFAULT_RETRY,
        ...options.retry,
      },
    };
  }

  /** Validate all config options. */
  private validate(options: WirexSDKConfig): void {
    if (!options.network) {
      throw new ConfigError(
        'Network is required',
        ConfigErrorCode.MISSING_REQUIRED,
        { field: 'network' },
      );
    }
    this.validateNetwork(options.network);

    if (options.horizonUrl !== undefined) {
      this.validateUrl(options.horizonUrl, 'horizonUrl');
    }
    if (options.sorobanRpcUrl !== undefined) {
      this.validateUrl(options.sorobanRpcUrl, 'sorobanRpcUrl');
    }
    if (options.externalApiUrl !== undefined) {
      this.validateUrl(options.externalApiUrl, 'externalApiUrl');
    }
    if (options.logging?.level !== undefined) {
      this.validateLogLevel(options.logging.level);
    }
    if (options.timeout) {
      this.validateTimeouts(options.timeout);
    }
    if (options.retry) {
      this.validateRetry(options.retry);
    }
  }

  private validateNetwork(network: string): void {
    if (!VALID_NETWORKS.includes(network as NetworkType)) {
      throw new ConfigError(
        `Invalid network: "${network}". Must be one of: ${VALID_NETWORKS.join(', ')}`,
        ConfigErrorCode.INVALID_NETWORK,
        { network, validNetworks: VALID_NETWORKS },
      );
    }
  }

  private validateUrl(url: string, field: string): void {
    try {
      new URL(url);
    } catch {
      throw new ConfigError(
        `Invalid URL for ${field}: "${url}"`,
        ConfigErrorCode.INVALID_URL,
        { field, url },
      );
    }
  }

  private validateLogLevel(level: string): void {
    if (!VALID_LOG_LEVELS.includes(level as LogLevel)) {
      throw new ConfigError(
        `Invalid log level: "${level}". Must be one of: ${VALID_LOG_LEVELS.join(', ')}`,
        ConfigErrorCode.INVALID_LOG_LEVEL,
        { level, validLevels: VALID_LOG_LEVELS },
      );
    }
  }

  private validateTimeouts(timeout: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(timeout)) {
      if (typeof value !== 'number' || value <= 0) {
        throw new ConfigError(
          `Invalid timeout for ${key}: must be a positive number`,
          ConfigErrorCode.INVALID_TIMEOUT,
          { field: key, value },
        );
      }
    }
  }

  private validateRetry(retry: Record<string, unknown>): void {
    if (retry.maxAttempts !== undefined) {
      if (typeof retry.maxAttempts !== 'number' || retry.maxAttempts < 1) {
        throw new ConfigError(
          'retry.maxAttempts must be a positive integer',
          ConfigErrorCode.INVALID_RETRY,
          { field: 'maxAttempts', value: retry.maxAttempts },
        );
      }
    }
    if (retry.backoffMultiplier !== undefined) {
      if (typeof retry.backoffMultiplier !== 'number' || retry.backoffMultiplier < 1) {
        throw new ConfigError(
          'retry.backoffMultiplier must be >= 1',
          ConfigErrorCode.INVALID_RETRY,
          { field: 'backoffMultiplier', value: retry.backoffMultiplier },
        );
      }
    }
  }
}
