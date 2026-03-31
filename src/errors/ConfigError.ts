import { StellarError } from './StellarError';

export enum ConfigErrorCode {
  INVALID_NETWORK = 'CONFIG_INVALID_NETWORK',
  INVALID_URL = 'CONFIG_INVALID_URL',
  INVALID_TIMEOUT = 'CONFIG_INVALID_TIMEOUT',
  INVALID_RETRY = 'CONFIG_INVALID_RETRY',
  INVALID_LOG_LEVEL = 'CONFIG_INVALID_LOG_LEVEL',
  MISSING_REQUIRED = 'CONFIG_MISSING_REQUIRED',
}

/**
 * Error class for configuration validation failures.
 */
export class ConfigError extends StellarError {
  constructor(
    message: string,
    code: ConfigErrorCode,
    details?: Record<string, unknown>,
  ) {
    super(message, code, details);
    this.name = 'ConfigError';
  }
}
