import { Logger } from '../../../src/config/Logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('level filtering', () => {
    it('should suppress all output when level is "none"', () => {
      logger = new Logger('none');
      logger.error('e');
      logger.warn('w');
      logger.info('i');
      logger.debug('d');

      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.debug).not.toHaveBeenCalled();
    });

    it('should only emit error when level is "error"', () => {
      logger = new Logger('error');
      logger.error('e');
      logger.warn('w');
      logger.info('i');
      logger.debug('d');

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.debug).not.toHaveBeenCalled();
    });

    it('should emit error and warn when level is "warn"', () => {
      logger = new Logger('warn');
      logger.error('e');
      logger.warn('w');
      logger.info('i');
      logger.debug('d');

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.info).not.toHaveBeenCalled();
      expect(console.debug).not.toHaveBeenCalled();
    });

    it('should emit error, warn, and info when level is "info"', () => {
      logger = new Logger('info');
      logger.error('e');
      logger.warn('w');
      logger.info('i');
      logger.debug('d');

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.info).toHaveBeenCalledTimes(1);
      expect(console.debug).not.toHaveBeenCalled();
    });

    it('should emit all levels when level is "debug"', () => {
      logger = new Logger('debug');
      logger.error('e');
      logger.warn('w');
      logger.info('i');
      logger.debug('d');

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.info).toHaveBeenCalledTimes(1);
      expect(console.debug).toHaveBeenCalledTimes(1);
    });
  });

  describe('message formatting', () => {
    it('should prefix messages with the SDK name', () => {
      logger = new Logger('debug');
      logger.info('hello');

      expect(console.info).toHaveBeenCalledWith('[@vottun/stellar-sdk] hello');
    });

    it('should support custom prefix', () => {
      logger = new Logger('debug', 'CustomModule');
      logger.info('test');

      expect(console.info).toHaveBeenCalledWith('[CustomModule] test');
    });

    it('should pass additional arguments to console', () => {
      logger = new Logger('debug');
      const extra = { key: 'value' };
      logger.error('failed', extra);

      expect(console.error).toHaveBeenCalledWith('[@vottun/stellar-sdk] failed', extra);
    });
  });

  describe('setLevel', () => {
    it('should change the log level at runtime', () => {
      logger = new Logger('none');
      logger.error('should not appear');
      expect(console.error).not.toHaveBeenCalled();

      logger.setLevel('error');
      logger.error('should appear');
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLevel', () => {
    it('should return the current log level', () => {
      logger = new Logger('warn');
      expect(logger.getLevel()).toBe('warn');

      logger.setLevel('debug');
      expect(logger.getLevel()).toBe('debug');
    });
  });

  describe('isEnabled', () => {
    it('should return true for levels at or below current level', () => {
      logger = new Logger('warn');
      expect(logger.isEnabled('error')).toBe(true);
      expect(logger.isEnabled('warn')).toBe(true);
      expect(logger.isEnabled('info')).toBe(false);
      expect(logger.isEnabled('debug')).toBe(false);
    });

    it('should return false for all levels when "none"', () => {
      logger = new Logger('none');
      expect(logger.isEnabled('error')).toBe(false);
      expect(logger.isEnabled('warn')).toBe(false);
      expect(logger.isEnabled('info')).toBe(false);
      expect(logger.isEnabled('debug')).toBe(false);
    });
  });
});
