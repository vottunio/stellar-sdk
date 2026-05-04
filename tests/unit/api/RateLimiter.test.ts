import { RateLimiter } from '../../../src/api/RateLimiter';

describe('RateLimiter (3.1.3)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('acquire', () => {
    it('should allow requests under the limit', async () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });

      // Should not throw or wait
      await limiter.acquire();
      await limiter.acquire();
      await limiter.acquire();

      expect(limiter.remaining).toBe(2);
    });

    it('should report correct remaining count', async () => {
      const limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });

      expect(limiter.remaining).toBe(3);
      await limiter.acquire();
      expect(limiter.remaining).toBe(2);
      await limiter.acquire();
      expect(limiter.remaining).toBe(1);
      await limiter.acquire();
      expect(limiter.remaining).toBe(0);
    });

    it('should throttle when limit is reached', async () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

      await limiter.acquire();
      await limiter.acquire();

      // Third acquire should wait
      let resolved = false;
      const promise = limiter.acquire().then(() => { resolved = true; });

      // Not resolved yet
      expect(resolved).toBe(false);

      // Advance time past the window so oldest request expires
      jest.advanceTimersByTime(1002);
      await promise;

      expect(resolved).toBe(true);
    });

    it('should prune old timestamps from the window', async () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 500 });

      await limiter.acquire();
      await limiter.acquire();
      expect(limiter.remaining).toBe(0);

      // Advance past the window
      jest.advanceTimersByTime(600);

      // Old timestamps should be pruned
      expect(limiter.remaining).toBe(2);
    });
  });

  describe('onRateLimited', () => {
    it('should block acquire for Retry-After seconds', async () => {
      const limiter = new RateLimiter({ maxRequests: 100, windowMs: 10000 });

      limiter.onRateLimited('2'); // 2 seconds

      expect(limiter.isBlocked).toBe(true);

      let resolved = false;
      const promise = limiter.acquire().then(() => { resolved = true; });

      // Not resolved after 1s
      jest.advanceTimersByTime(1000);
      expect(resolved).toBe(false);

      // Resolved after 2s
      jest.advanceTimersByTime(1001);
      await promise;
      expect(resolved).toBe(true);
    });

    it('should handle Retry-After as HTTP-date', async () => {
      const limiter = new RateLimiter({ maxRequests: 100, windowMs: 10000 });

      const futureDate = new Date(Date.now() + 3000).toUTCString();
      limiter.onRateLimited(futureDate);

      expect(limiter.isBlocked).toBe(true);

      jest.advanceTimersByTime(3001);
      expect(limiter.isBlocked).toBe(false);
    });

    it('should default to 1s backoff if no Retry-After header', async () => {
      const limiter = new RateLimiter({ maxRequests: 100, windowMs: 10000 });

      limiter.onRateLimited(undefined);
      expect(limiter.isBlocked).toBe(true);

      jest.advanceTimersByTime(500);
      expect(limiter.isBlocked).toBe(true);

      jest.advanceTimersByTime(501);
      expect(limiter.isBlocked).toBe(false);
    });
  });

  describe('isBlocked', () => {
    it('should be false initially', () => {
      const limiter = new RateLimiter({ maxRequests: 100, windowMs: 10000 });
      expect(limiter.isBlocked).toBe(false);
    });

    it('should be true after onRateLimited and false after the period', () => {
      const limiter = new RateLimiter({ maxRequests: 100, windowMs: 10000 });

      limiter.onRateLimited('1');
      expect(limiter.isBlocked).toBe(true);

      jest.advanceTimersByTime(1001);
      expect(limiter.isBlocked).toBe(false);
    });
  });

  describe('default configuration', () => {
    it('should use defaults when no config is provided', () => {
      const limiter = new RateLimiter();
      // Default: 100 requests per 10s window
      expect(limiter.remaining).toBe(100);
    });

    it('should allow partial config override', () => {
      const limiter = new RateLimiter({ maxRequests: 50, windowMs: 5000 });
      expect(limiter.remaining).toBe(50);
    });
  });
});
