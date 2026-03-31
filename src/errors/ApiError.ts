import { ApiErrorCode } from '../types/api.types';

import { StellarError } from './StellarError';

/**
 * Error class for API-related failures (Horizon, Soroban RPC, external APIs).
 */
export class ApiError extends StellarError {
  public readonly statusCode?: number;
  public readonly endpoint?: string;

  constructor(
    message: string,
    code: ApiErrorCode,
    options?: {
      statusCode?: number;
      endpoint?: string;
      details?: Record<string, unknown>;
    },
  ) {
    super(message, code, options?.details);
    this.name = 'ApiError';
    this.statusCode = options?.statusCode;
    this.endpoint = options?.endpoint;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      statusCode: this.statusCode,
      endpoint: this.endpoint,
    };
  }
}
