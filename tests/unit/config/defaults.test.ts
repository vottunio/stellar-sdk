import { DEFAULT_LOGGING, DEFAULT_RETRY, DEFAULT_TIMEOUT } from '../../../src/config/defaults';

describe('Default Configuration', () => {
  describe('DEFAULT_LOGGING', () => {
    it('should default log level to "none"', () => {
      expect(DEFAULT_LOGGING.level).toBe('none');
    });
  });

  describe('DEFAULT_TIMEOUT', () => {
    it('should set horizon timeout to 30 seconds', () => {
      expect(DEFAULT_TIMEOUT.horizon).toBe(30_000);
    });

    it('should set api timeout to 15 seconds', () => {
      expect(DEFAULT_TIMEOUT.api).toBe(15_000);
    });

    it('should set websocket timeout to 10 seconds', () => {
      expect(DEFAULT_TIMEOUT.websocket).toBe(10_000);
    });

    it('should have all required timeout fields', () => {
      expect(DEFAULT_TIMEOUT).toEqual({
        horizon: 30_000,
        api: 15_000,
        websocket: 10_000,
      });
    });
  });

  describe('DEFAULT_RETRY', () => {
    it('should set maxAttempts to 3', () => {
      expect(DEFAULT_RETRY.maxAttempts).toBe(3);
    });

    it('should set backoffMultiplier to 1.5', () => {
      expect(DEFAULT_RETRY.backoffMultiplier).toBe(1.5);
    });

    it('should have all required retry fields', () => {
      expect(DEFAULT_RETRY).toEqual({
        maxAttempts: 3,
        backoffMultiplier: 1.5,
      });
    });
  });
});
