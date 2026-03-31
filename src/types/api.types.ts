/**
 * Standardized API response wrapper for Horizon and Soroban responses.
 */
export interface ApiResponse<T> {
  data: T;
  pagination?: PaginationInfo;
  raw?: unknown;
}

/**
 * Pagination info for list endpoints.
 */
export interface PaginationInfo {
  cursor?: string;
  limit: number;
  order: 'asc' | 'desc';
  hasMore: boolean;
}

/**
 * Standard query parameters for paginated list endpoints.
 */
export interface PaginationParams {
  cursor?: string;
  limit?: number;
  order?: 'asc' | 'desc';
}

/**
 * HTTP request options.
 */
export interface RequestOptions {
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
}

/**
 * API error codes for categorizing failures.
 */
export enum ApiErrorCode {
  // Network / transport
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',

  // Horizon errors
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  SERVER_ERROR = 'SERVER_ERROR',

  // Transaction errors
  TX_FAILED = 'TX_FAILED',
  TX_BAD_SEQ = 'TX_BAD_SEQ',
  TX_INSUFFICIENT_BALANCE = 'TX_INSUFFICIENT_BALANCE',

  // Soroban errors
  SIMULATION_FAILED = 'SIMULATION_FAILED',
  INVOKE_FAILED = 'INVOKE_FAILED',

  // Generic
  UNKNOWN = 'UNKNOWN',
}
