import { ConfigManager } from '../../../src/config/ConfigManager';
import { ConfigError, ConfigErrorCode } from '../../../src/errors/ConfigError';

describe('Mainnet Safety Validation (3.1.1)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('blocks testnet URLs on mainnet', () => {
    it('should reject horizonUrl containing "testnet"', () => {
      expect(
        () =>
          new ConfigManager({
            network: 'mainnet',
            horizonUrl: 'https://horizon-testnet.stellar.org',
          }),
      ).toThrow(ConfigError);

      try {
        new ConfigManager({
          network: 'mainnet',
          horizonUrl: 'https://horizon-testnet.stellar.org',
        });
      } catch (e) {
        expect((e as ConfigError).code).toBe(ConfigErrorCode.MAINNET_SAFETY);
        expect((e as ConfigError).message).toContain('testnet');
        expect((e as ConfigError).message).toContain('horizonUrl');
      }
    });

    it('should reject sorobanRpcUrl containing "testnet"', () => {
      expect(
        () =>
          new ConfigManager({
            network: 'mainnet',
            sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
          }),
      ).toThrow(ConfigError);
    });

    it('should reject externalApiUrl containing "sandbox"', () => {
      expect(
        () =>
          new ConfigManager({
            network: 'mainnet',
            externalApiUrl: 'https://api-sandbox.partner.com',
          }),
      ).toThrow(ConfigError);
    });

    it('should reject URLs containing "friendbot"', () => {
      expect(
        () =>
          new ConfigManager({
            network: 'mainnet',
            horizonUrl: 'https://friendbot.stellar.org',
          }),
      ).toThrow(ConfigError);
    });

    it('should reject URLs containing "futurenet"', () => {
      expect(
        () =>
          new ConfigManager({
            network: 'mainnet',
            horizonUrl: 'https://horizon-futurenet.stellar.org',
          }),
      ).toThrow(ConfigError);
    });

    it('should be case-insensitive', () => {
      expect(
        () =>
          new ConfigManager({
            network: 'mainnet',
            horizonUrl: 'https://horizon-TESTNET.stellar.org',
          }),
      ).toThrow(ConfigError);
    });
  });

  describe('allows valid mainnet URLs', () => {
    it('should allow default mainnet URLs (no custom URLs)', () => {
      const cm = new ConfigManager({ network: 'mainnet' });
      const config = cm.getConfig();
      expect(config.horizonUrl).toBe('https://horizon.stellar.org');
      expect(config.sorobanRpcUrl).toBe('https://soroban.stellar.org');
    });

    it('should allow custom production URLs on mainnet', () => {
      const cm = new ConfigManager({
        network: 'mainnet',
        horizonUrl: 'https://horizon.my-company.com',
        sorobanRpcUrl: 'https://soroban.my-company.com',
      });
      expect(cm.getConfig().horizonUrl).toBe('https://horizon.my-company.com');
    });

    it('should allow externalApiUrl with production domain on mainnet', () => {
      const cm = new ConfigManager({
        network: 'mainnet',
        externalApiUrl: 'https://api.partner.com',
      });
      expect(cm.getConfig().externalApiUrl).toBe('https://api.partner.com');
    });
  });

  describe('does NOT restrict testnet config', () => {
    it('should allow testnet URLs on testnet', () => {
      const cm = new ConfigManager({
        network: 'testnet',
        horizonUrl: 'https://horizon-testnet.stellar.org',
        sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
      });
      expect(cm.getConfig().horizonUrl).toBe('https://horizon-testnet.stellar.org');
    });

    it('should allow sandbox URLs on testnet', () => {
      const cm = new ConfigManager({
        network: 'testnet',
        externalApiUrl: 'https://api-sandbox.partner.com',
      });
      expect(cm.getConfig().externalApiUrl).toBe('https://api-sandbox.partner.com');
    });
  });

  describe('setNetwork safety', () => {
    it('should reset to preset URLs when switching to mainnet (no testnet leakage)', () => {
      const cm = new ConfigManager({
        network: 'testnet',
        horizonUrl: 'https://horizon-testnet.stellar.org',
      });
      expect(cm.getConfig().horizonUrl).toBe('https://horizon-testnet.stellar.org');

      cm.setNetwork('mainnet');
      expect(cm.getConfig().horizonUrl).toBe('https://horizon.stellar.org');
      expect(cm.getConfig().sorobanRpcUrl).toBe('https://soroban.stellar.org');
    });
  });
});
