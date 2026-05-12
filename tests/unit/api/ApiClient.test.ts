import axios from 'axios';

import { ConfigManager } from '../../../src/config/ConfigManager';
import { ApiClient } from '../../../src/api/ApiClient';
import { ApiError } from '../../../src/errors/ApiError';
import { ApiErrorCode } from '../../../src/types/api.types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ApiClient', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  let mockRequest: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockRequest = jest.fn();
    mockedAxios.create.mockReturnValue({
      request: mockRequest,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    } as unknown as ReturnType<typeof axios.create>);

    mockedAxios.isAxiosError.mockImplementation((error) => {
      return error != null && typeof error === 'object' && 'isAxiosError' in error;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create an axios instance with correct config', () => {
    new ApiClient(config, 'https://horizon-testnet.stellar.org');
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://horizon-testnet.stellar.org',
        timeout: config.timeout.api,
      }),
    );
  });

  it('should use custom timeout when provided', () => {
    new ApiClient(config, 'https://horizon-testnet.stellar.org', 5000);
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  describe('get', () => {
    it('should perform a GET request', async () => {
      const client = new ApiClient(config, 'https://horizon-testnet.stellar.org');
      mockRequest.mockResolvedValue({ data: { id: 'test' }, status: 200 });

      const result = await client.get('/accounts/G...');
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'GET', url: '/accounts/G...' }),
      );
      expect(result.data).toEqual({ id: 'test' });
    });

    it('should pass query params', async () => {
      const client = new ApiClient(config, 'https://horizon-testnet.stellar.org');
      mockRequest.mockResolvedValue({ data: {}, status: 200 });

      await client.get('/transactions', { limit: 5, order: 'desc' });
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ params: { limit: 5, order: 'desc' } }),
      );
    });
  });

  describe('post', () => {
    it('should perform a POST request', async () => {
      const client = new ApiClient(config, 'https://soroban-testnet.stellar.org');
      mockRequest.mockResolvedValue({ data: { result: 'ok' }, status: 200 });

      const result = await client.post('/', { method: 'getHealth' });
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'POST', data: { method: 'getHealth' } }),
      );
      expect(result.data).toEqual({ result: 'ok' });
    });
  });

  describe('error mapping', () => {
    it('should map 404 to ApiError NOT_FOUND', async () => {
      const client = new ApiClient(config, 'https://horizon-testnet.stellar.org');
      mockRequest.mockRejectedValue({
        isAxiosError: true,
        response: { status: 404, data: { detail: 'Not found' } },
        message: 'Request failed with status 404',
        config: {},
      });

      await expect(client.get('/accounts/BAD')).rejects.toThrow(ApiError);
      try {
        await client.get('/accounts/BAD');
      } catch (e) {
        expect((e as ApiError).code).toBe(ApiErrorCode.NOT_FOUND);
      }
    });

    it('should map network error (no response) to NETWORK_ERROR', async () => {
      const client = new ApiClient(config, 'https://horizon-testnet.stellar.org');
      mockRequest.mockRejectedValue({
        isAxiosError: true,
        response: undefined,
        message: 'Network Error',
        code: 'ERR_NETWORK',
        config: {},
      });

      // With default maxAttempts=3 it will retry, so mock all attempts
      try {
        await client.get('/');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).code).toBe(ApiErrorCode.NETWORK_ERROR);
      }
    });

    it('should map timeout to TIMEOUT', async () => {
      const client = new ApiClient(config, 'https://horizon-testnet.stellar.org');
      mockRequest.mockRejectedValue({
        isAxiosError: true,
        response: undefined,
        message: 'timeout of 30000ms exceeded',
        code: 'ECONNABORTED',
        config: {},
      });

      try {
        await client.get('/');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).code).toBe(ApiErrorCode.TIMEOUT);
      }
    });

    it('should map 400 to BAD_REQUEST', async () => {
      const client = new ApiClient(config, 'https://horizon-testnet.stellar.org');
      mockRequest.mockRejectedValue({
        isAxiosError: true,
        response: { status: 400, data: { title: 'Bad Request' } },
        message: 'Request failed',
        config: {},
      });

      try {
        await client.get('/transactions');
      } catch (e) {
        expect((e as ApiError).code).toBe(ApiErrorCode.BAD_REQUEST);
      }
    });

    it('should map 429 to RATE_LIMITED', async () => {
      const client = new ApiClient(config, 'https://horizon-testnet.stellar.org');
      // 429 is retryable, so it will retry maxAttempts times
      mockRequest.mockRejectedValue({
        isAxiosError: true,
        response: { status: 429, data: {} },
        message: 'Too Many Requests',
        config: {},
      });

      try {
        await client.get('/');
      } catch (e) {
        expect((e as ApiError).code).toBe(ApiErrorCode.RATE_LIMITED);
      }
    });

    it('should map 500+ to SERVER_ERROR', async () => {
      const client = new ApiClient(config, 'https://horizon-testnet.stellar.org');
      // 502 is retryable
      mockRequest.mockRejectedValue({
        isAxiosError: true,
        response: { status: 502, data: {} },
        message: 'Bad Gateway',
        config: {},
      });

      try {
        await client.get('/');
      } catch (e) {
        expect((e as ApiError).code).toBe(ApiErrorCode.SERVER_ERROR);
      }
    });

    it('should map non-axios errors to UNKNOWN', async () => {
      const client = new ApiClient(config, 'https://horizon-testnet.stellar.org');
      mockRequest.mockRejectedValue(new Error('Something unexpected'));

      try {
        await client.get('/');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).code).toBe(ApiErrorCode.UNKNOWN);
      }
    });
  });

  describe('retry', () => {
    it('should retry on 503 and succeed on second attempt', async () => {
      const client = new ApiClient(config, 'https://horizon-testnet.stellar.org');

      mockRequest
        .mockRejectedValueOnce({
          isAxiosError: true,
          response: { status: 503, data: {} },
          message: 'Service Unavailable',
          config: {},
        })
        .mockResolvedValueOnce({ data: { ok: true }, status: 200 });

      const result = await client.get('/');
      expect(result.data).toEqual({ ok: true });
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 400', async () => {
      const client = new ApiClient(config, 'https://horizon-testnet.stellar.org');

      mockRequest.mockRejectedValue({
        isAxiosError: true,
        response: { status: 400, data: {} },
        message: 'Bad Request',
        config: {},
      });

      await expect(client.get('/')).rejects.toThrow(ApiError);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 404', async () => {
      const client = new ApiClient(config, 'https://horizon-testnet.stellar.org');

      mockRequest.mockRejectedValue({
        isAxiosError: true,
        response: { status: 404, data: {} },
        message: 'Not Found',
        config: {},
      });

      await expect(client.get('/')).rejects.toThrow(ApiError);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });
  });
});
