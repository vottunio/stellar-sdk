import { ConfigError, ConfigErrorCode } from '../../../src/errors/ConfigError';
import { StellarError } from '../../../src/errors/StellarError';

describe('ConfigError', () => {
  it('should extend StellarError', () => {
    const error = new ConfigError(
      'Invalid network',
      ConfigErrorCode.INVALID_NETWORK,
    );

    expect(error).toBeInstanceOf(ConfigError);
    expect(error).toBeInstanceOf(StellarError);
    expect(error.name).toBe('ConfigError');
    expect(error.code).toBe('CONFIG_INVALID_NETWORK');
  });

  it('should include details', () => {
    const error = new ConfigError(
      'Bad URL',
      ConfigErrorCode.INVALID_URL,
      { field: 'horizonUrl', url: 'not-a-url' },
    );

    expect(error.details).toEqual({ field: 'horizonUrl', url: 'not-a-url' });
  });
});
