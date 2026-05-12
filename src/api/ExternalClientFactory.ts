import { ApiClient } from './ApiClient';
import { ResolvedConfig } from '../types/config.types';

/**
 * Options for creating an external API client.
 */
export interface ExternalClientOptions {
  /** Request timeout in milliseconds (default: config.timeout.api). */
  timeout?: number;
  /** Default headers to include in every request. */
  headers?: Record<string, string>;
}

/**
 * Factory for creating API clients that connect to partner backend APIs.
 *
 * Partners (e.g. Wirex) can use this to create type-safe HTTP clients
 * for their own backend services, reusing the SDK's retry logic,
 * interceptors, and error mapping.
 *
 * Accessed via `sdk.api.external(baseUrl, options?)`.
 *
 * @example
 * ```typescript
 * // Connect to Wirex BaaS sandbox
 * const wirexClient = sdk.api.external('https://api-baas.wirexapp.tech', {
 *   headers: { 'Authorization': 'Bearer <token>' },
 *   timeout: 10000,
 * });
 *
 * // Use standard GET/POST with retry + error mapping
 * const accounts = await wirexClient.get('/v1/accounts');
 * const result = await wirexClient.post('/v1/transfers', { amount: '100', currency: 'XLM' });
 * ```
 */
export class ExternalClientFactory {
  private readonly config: ResolvedConfig;

  constructor(config: ResolvedConfig) {
    this.config = config;
  }

  /**
   * Create a new API client for an external service.
   *
   * The returned client has the same interface as the internal ApiClient:
   * - `get<T>(path, params?)` — GET request with query params
   * - `post<T>(path, data?)` — POST request with JSON body
   * - Automatic retry on 429/502/503/504 and network errors
   * - Error mapping to typed `ApiError`
   *
   * @param baseUrl - Base URL of the external API.
   * @param options - Optional timeout and default headers.
   * @returns An ApiClient instance configured for the external service.
   */
  create(baseUrl: string, options?: ExternalClientOptions): ApiClient {
    const client = new ApiClient(
      this.config,
      baseUrl,
      options?.timeout,
    );

    if (options?.headers) {
      const axiosInstance = client.getAxiosInstance();
      for (const [key, value] of Object.entries(options.headers)) {
        axiosInstance.defaults.headers.common[key] = value;
      }
    }

    return client;
  }
}
