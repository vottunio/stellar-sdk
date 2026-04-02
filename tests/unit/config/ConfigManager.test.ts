import { ConfigManager } from '../../../src/config/ConfigManager';
import { ConfigError } from '../../../src/errors/ConfigError';

describe('ConfigManager', () => {
  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create with minimal testnet config', () => {
      const cm = new ConfigManager({ network: 'testnet' });
      const config = cm.getConfig();

      expect(config.network).toBe('testnet');
      expect(config.horizonUrl).toBe('https://horizon-testnet.stellar.org');
      expect(config.sorobanRpcUrl).toBe('https://soroban-testnet.stellar.org');
      expect(config.networkPassphrase).toBe('Test SDF Network ; September 2015');
    });

    it('should create with mainnet config', () => {
      const cm = new ConfigManager({ network: 'mainnet' });
      const config = cm.getConfig();

      expect(config.network).toBe('mainnet');
      expect(config.horizonUrl).toBe('https://horizon.stellar.org');
      expect(config.networkPassphrase).toBe('Public Global Stellar Network ; September 2015');
    });

    it('should apply default logging, timeout, and retry', () => {
      const cm = new ConfigManager({ network: 'testnet' });
      const config = cm.getConfig();

      expect(config.logging.level).toBe('none');
      expect(config.timeout.horizon).toBe(30_000);
      expect(config.timeout.api).toBe(15_000);
      expect(config.timeout.websocket).toBe(10_000);
      expect(config.retry.maxAttempts).toBe(3);
      expect(config.retry.backoffMultiplier).toBe(1.5);
    });

    it('should allow overriding URLs', () => {
      const cm = new ConfigManager({
        network: 'testnet',
        horizonUrl: 'https://custom-horizon.example.com',
        sorobanRpcUrl: 'https://custom-soroban.example.com',
      });
      const config = cm.getConfig();

      expect(config.horizonUrl).toBe('https://custom-horizon.example.com');
      expect(config.sorobanRpcUrl).toBe('https://custom-soroban.example.com');
    });

    it('should allow overriding logging, timeout, and retry', () => {
      const cm = new ConfigManager({
        network: 'testnet',
        logging: { level: 'debug' },
        timeout: { horizon: 60_000 },
        retry: { maxAttempts: 5 },
      });
      const config = cm.getConfig();

      expect(config.logging.level).toBe('debug');
      expect(config.timeout.horizon).toBe(60_000);
      expect(config.timeout.api).toBe(15_000); // default preserved
      expect(config.retry.maxAttempts).toBe(5);
      expect(config.retry.backoffMultiplier).toBe(1.5); // default preserved
    });

    it('should store externalApiUrl', () => {
      const cm = new ConfigManager({
        network: 'testnet',
        externalApiUrl: 'https://api.partner.com',
      });

      expect(cm.getConfig().externalApiUrl).toBe('https://api.partner.com');
    });
  });

  describe('validation', () => {
    it('should throw on missing network', () => {
      expect(() => new ConfigManager({} as never)).toThrow(ConfigError);
    });

    it('should throw on invalid network', () => {
      expect(() => new ConfigManager({ network: 'devnet' as never })).toThrow(ConfigError);
      expect(() => new ConfigManager({ network: 'devnet' as never })).toThrow(/Invalid network/);
    });

    it('should throw on invalid URL', () => {
      expect(
        () => new ConfigManager({ network: 'testnet', horizonUrl: 'not-a-url' }),
      ).toThrow(ConfigError);
    });

    it('should throw on invalid log level', () => {
      expect(
        () => new ConfigManager({ network: 'testnet', logging: { level: 'verbose' as never } }),
      ).toThrow(ConfigError);
    });

    it('should throw on invalid timeout (negative)', () => {
      expect(
        () => new ConfigManager({ network: 'testnet', timeout: { horizon: -1 } }),
      ).toThrow(ConfigError);
    });

    it('should throw on invalid retry maxAttempts', () => {
      expect(
        () => new ConfigManager({ network: 'testnet', retry: { maxAttempts: 0 } }),
      ).toThrow(ConfigError);
    });

    it('should throw on invalid retry backoffMultiplier', () => {
      expect(
        () => new ConfigManager({ network: 'testnet', retry: { backoffMultiplier: 0.5 } }),
      ).toThrow(ConfigError);
    });
  });

  describe('setNetwork', () => {
    it('should hot-switch from testnet to mainnet', () => {
      const cm = new ConfigManager({ network: 'testnet' });
      cm.setNetwork('mainnet');
      const config = cm.getConfig();

      expect(config.network).toBe('mainnet');
      expect(config.horizonUrl).toBe('https://horizon.stellar.org');
      expect(config.networkPassphrase).toBe('Public Global Stellar Network ; September 2015');
    });

    it('should hot-switch from mainnet to testnet', () => {
      const cm = new ConfigManager({ network: 'mainnet' });
      cm.setNetwork('testnet');

      expect(cm.getConfig().network).toBe('testnet');
      expect(cm.getConfig().horizonUrl).toBe('https://horizon-testnet.stellar.org');
    });

    it('should throw on invalid network', () => {
      const cm = new ConfigManager({ network: 'testnet' });
      expect(() => cm.setNetwork('invalid' as never)).toThrow(ConfigError);
    });

    it('should log a message when switching networks', () => {
      const cm = new ConfigManager({ network: 'testnet', logging: { level: 'info' } });
      cm.setNetwork('mainnet');
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Network switched to mainnet'),
      );
    });

    it('should preserve non-network config after switching', () => {
      const cm = new ConfigManager({
        network: 'testnet',
        logging: { level: 'debug' },
        timeout: { horizon: 60_000 },
      });

      cm.setNetwork('mainnet');
      const config = cm.getConfig();

      expect(config.logging.level).toBe('debug');
      expect(config.timeout.horizon).toBe(60_000);
    });
  });

  describe('getLogger', () => {
    it('should return a Logger instance with the configured level', () => {
      const cm = new ConfigManager({ network: 'testnet', logging: { level: 'debug' } });
      const logger = cm.getLogger();

      expect(logger).toBeDefined();
      expect(logger.getLevel()).toBe('debug');
    });

    it('should default logger to "none" level', () => {
      const cm = new ConfigManager({ network: 'testnet' });
      expect(cm.getLogger().getLevel()).toBe('none');
    });
  });
});
