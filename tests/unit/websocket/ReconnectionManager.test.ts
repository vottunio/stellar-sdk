import { ReconnectionManager } from '../../../src/websocket/ReconnectionManager';
import { Logger } from '../../../src/config/Logger';

describe('ReconnectionManager', () => {
  const retryConfig = { maxAttempts: 3, backoffMultiplier: 2 };
  let manager: ReconnectionManager;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const logger = new Logger('none');
    manager = new ReconnectionManager(retryConfig, logger);
  });

  afterEach(() => {
    manager.cancelPending();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should schedule a reconnect with exponential backoff', () => {
    const callback = jest.fn();

    // Attempt 1: delay = 1000 * 2^0 = 1000ms
    const scheduled = manager.scheduleReconnect(callback);
    expect(scheduled).toBe(true);
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should increase delay with each attempt', () => {
    const callback = jest.fn();

    // Attempt 1: 1000ms
    manager.scheduleReconnect(callback);
    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    // Attempt 2: 1000 * 2^1 = 2000ms
    manager.scheduleReconnect(callback);
    jest.advanceTimersByTime(1999);
    expect(callback).toHaveBeenCalledTimes(1); // not yet
    jest.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should return false when max attempts exhausted', () => {
    const callback = jest.fn();

    for (let i = 0; i < retryConfig.maxAttempts; i++) {
      expect(manager.scheduleReconnect(callback)).toBe(true);
      jest.advanceTimersByTime(30001); // advance past any delay
    }

    // 4th attempt — should fail
    expect(manager.scheduleReconnect(callback)).toBe(false);
  });

  it('should reset attempt count', () => {
    const callback = jest.fn();

    manager.scheduleReconnect(callback);
    jest.advanceTimersByTime(1000);
    manager.scheduleReconnect(callback);
    jest.advanceTimersByTime(2000);
    expect(manager.getAttemptCount()).toBe(2);

    manager.reset();
    expect(manager.getAttemptCount()).toBe(0);

    // Should allow full maxAttempts again
    for (let i = 0; i < retryConfig.maxAttempts; i++) {
      expect(manager.scheduleReconnect(callback)).toBe(true);
      jest.advanceTimersByTime(30001);
    }
  });

  it('should cancel pending reconnect timer', () => {
    const callback = jest.fn();

    manager.scheduleReconnect(callback);
    manager.cancelPending();

    jest.advanceTimersByTime(30001);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should cap delay at 30 seconds', () => {
    // With multiplier=2, attempt 6 = 1000 * 2^5 = 32000 → capped to 30000
    const bigConfig = { maxAttempts: 10, backoffMultiplier: 2 };
    const logger = new Logger('none');
    const bigManager = new ReconnectionManager(bigConfig, logger);
    const callback = jest.fn();

    // Burn through attempts to get high delay
    for (let i = 0; i < 6; i++) {
      bigManager.scheduleReconnect(callback);
      jest.advanceTimersByTime(30001);
    }

    // Next attempt should still fire within 30 seconds
    bigManager.scheduleReconnect(callback);
    jest.advanceTimersByTime(30001);
    expect(callback).toHaveBeenCalledTimes(7);

    bigManager.cancelPending();
  });
});
