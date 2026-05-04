import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

import { Logger } from '../config/Logger';
import { ApiError } from '../errors/ApiError';
import { ResolvedConfig } from '../types/config.types';
import { ApiErrorCode } from '../types/api.types';
import { RateLimiter } from './RateLimiter';

/**
 * Base HTTP client built on axios. Provides interceptors for logging,
 * automatic retry with exponential backoff, and standardized error mapping.
 *
 * Used internally by HorizonClient and SorobanRpcClient.
 *
 * @example
 * ```typescript
 * const client = new ApiClient(config, config.horizonUrl);
 * const response = await client.get('/accounts/G...');
 * ```
 */
export class ApiClient {
  private readonly instance: AxiosInstance;
  private readonly logger: Logger;
  private readonly config: ResolvedConfig;
  private readonly rateLimiter: RateLimiter;

  constructor(config: ResolvedConfig, baseURL: string, timeout?: number) {
    this.config = config;
    this.logger = new Logger(config.logging.level, 'ApiClient');
    this.rateLimiter = new RateLimiter(undefined, this.logger);

    this.instance = axios.create({
      baseURL,
      timeout: timeout ?? config.timeout.api,
      headers: { 'Content-Type': 'application/json' },
    });

    this.setupInterceptors();
  }

  /**
   * Perform a GET request.
   * @param path - URL path relative to baseURL.
   * @param params - Query parameters.
   * @returns Axios response.
   */
  async get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<AxiosResponse<T>> {
    return this.requestWithRetry<T>({ method: 'GET', url: path, params });
  }

  /**
   * Perform a POST request.
   * @param path - URL path relative to baseURL.
   * @param data - Request body.
   * @returns Axios response.
   */
  async post<T = unknown>(path: string, data?: unknown): Promise<AxiosResponse<T>> {
    return this.requestWithRetry<T>({ method: 'POST', url: path, data });
  }

  /** Get the underlying axios instance for advanced usage. */
  getAxiosInstance(): AxiosInstance {
    return this.instance;
  }

  // ─── Retry Logic ──────────────────────────────────────────────────────────

  private async requestWithRetry<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const { maxAttempts, backoffMultiplier } = this.config.retry;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Wait for rate limiter before each attempt
        await this.rateLimiter.acquire();
        return await this.instance.request<T>(config);
      } catch (error: unknown) {
        lastError = error;

        // Feed Retry-After back to the rate limiter on 429
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          const retryAfter = error.response.headers?.['retry-after'] as string | undefined;
          this.rateLimiter.onRateLimited(retryAfter);
        }

        if (!this.isRetryable(error) || attempt === maxAttempts) {
          break;
        }

        const delay = Math.pow(backoffMultiplier, attempt - 1) * 1000;
        this.logger.debug(
          `Request failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`,
        );
        await this.sleep(delay);
      }
    }

    throw this.mapError(lastError, config.url ?? '');
  }

  private isRetryable(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return false;

    // Retry on network errors (no response)
    if (!error.response) return true;

    const status = error.response.status;
    // Retry on 429 (rate limited), 502, 503, 504 (server overload)
    return status === 429 || status === 502 || status === 503 || status === 504;
  }

  // ─── Error Mapping ────────────────────────────────────────────────────────

  private mapError(error: unknown, endpoint: string): ApiError {
    if (error instanceof ApiError) return error;

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const responseData = error.response?.data as Record<string, unknown> | undefined;

      if (!error.response) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          return new ApiError('Request timed out', ApiErrorCode.TIMEOUT, {
            endpoint,
            details: { message: error.message },
          });
        }
        return new ApiError(
          `Network error: ${error.message}`,
          ApiErrorCode.NETWORK_ERROR,
          { endpoint, details: { message: error.message } },
        );
      }

      if (status === 404) {
        return new ApiError(
          `Not found: ${endpoint}`,
          ApiErrorCode.NOT_FOUND,
          { statusCode: 404, endpoint, details: responseData },
        );
      }
      if (status === 400) {
        return new ApiError(
          `Bad request: ${responseData?.detail ?? responseData?.title ?? endpoint}`,
          ApiErrorCode.BAD_REQUEST,
          { statusCode: 400, endpoint, details: responseData },
        );
      }
      if (status === 429) {
        return new ApiError(
          'Rate limited by Horizon',
          ApiErrorCode.RATE_LIMITED,
          { statusCode: 429, endpoint },
        );
      }
      if (status && status >= 500) {
        return new ApiError(
          `Server error (${status})`,
          ApiErrorCode.SERVER_ERROR,
          { statusCode: status, endpoint, details: responseData },
        );
      }

      return new ApiError(
        `HTTP ${status}: ${error.message}`,
        ApiErrorCode.UNKNOWN,
        { statusCode: status, endpoint, details: responseData },
      );
    }

    return new ApiError(
      `Request failed: ${String(error)}`,
      ApiErrorCode.UNKNOWN,
      { endpoint },
    );
  }

  // ─── Interceptors ─────────────────────────────────────────────────────────

  private setupInterceptors(): void {
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        this.logger.debug(`${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        return config;
      },
    );

    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        this.logger.debug(`${response.status} ${response.config.url}`);
        return response;
      },
      (error: unknown) => {
        if (axios.isAxiosError(error)) {
          this.logger.error(
            `HTTP error ${error.response?.status ?? 'NETWORK'}: ${error.config?.url}`,
          );
        }
        return Promise.reject(error);
      },
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
