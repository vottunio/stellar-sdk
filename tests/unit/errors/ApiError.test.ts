import { ApiError } from '../../../src/errors/ApiError';
import { StellarError } from '../../../src/errors/StellarError';
import { ApiErrorCode } from '../../../src/types/api.types';

describe('ApiError', () => {
  it('should extend StellarError', () => {
    const error = new ApiError('Not found', ApiErrorCode.NOT_FOUND);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(StellarError);
    expect(error.name).toBe('ApiError');
    expect(error.code).toBe('NOT_FOUND');
  });

  it('should include statusCode and endpoint', () => {
    const error = new ApiError('Server error', ApiErrorCode.SERVER_ERROR, {
      statusCode: 500,
      endpoint: '/accounts/G...',
    });

    expect(error.statusCode).toBe(500);
    expect(error.endpoint).toBe('/accounts/G...');
  });

  it('should serialize to JSON with extended fields', () => {
    const error = new ApiError('Timeout', ApiErrorCode.TIMEOUT, {
      statusCode: 408,
      endpoint: '/transactions',
      details: { elapsed: 30000 },
    });

    const json = error.toJSON();
    expect(json.statusCode).toBe(408);
    expect(json.endpoint).toBe('/transactions');
    expect(json.details).toEqual({ elapsed: 30000 });
  });
});
