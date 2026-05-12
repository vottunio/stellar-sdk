import { ConfigManager } from '../../../src/config/ConfigManager';

describe('Network-Aware Timeouts (3.1.6)', () => {
  describe('testnet defaults', () => {
    it('should use tighter testnet timeouts', () => {
      const cm = new ConfigManager({ network: 'testnet' });
      const t = cm.getConfig().timeout;

      expect(t.horizon).toBe(30_000);
      expect(t.api).toBe(15_000);
      expect(t.websocket).toBe(10_000);
      expect(t.transactionSeconds).toBe(30);
      expect(t.soroban).toBe(30_000);
    });
  });

  describe('mainnet defaults', () => {
    it('should use wider mainnet timeouts', () => {
      const cm = new ConfigManager({ network: 'mainnet' });
      const t = cm.getConfig().timeout;

      expect(t.horizon).toBe(60_000);
      expect(t.api).toBe(30_000);
      expect(t.websocket).toBe(15_000);
      expect(t.transactionSeconds).toBe(180);
      expect(t.soroban).toBe(60_000);
    });
  });

  describe('user overrides', () => {
    it('should preserve user-specified horizon timeout on testnet', () => {
      const cm = new ConfigManager({
        network: 'testnet',
        timeout: { horizon: 99_000 },
      });
      const t = cm.getConfig().timeout;

      expect(t.horizon).toBe(99_000);
      // Other fields fall through to testnet defaults
      expect(t.api).toBe(15_000);
      expect(t.transactionSeconds).toBe(30);
    });

    it('should preserve user-specified transactionSeconds on mainnet', () => {
      const cm = new ConfigManager({
        network: 'mainnet',
        timeout: { transactionSeconds: 600 },
      });
      const t = cm.getConfig().timeout;

      expect(t.transactionSeconds).toBe(600);
      // Other mainnet defaults still applied
      expect(t.horizon).toBe(60_000);
    });

    it('should allow overriding all five timeout fields', () => {
      const cm = new ConfigManager({
        network: 'mainnet',
        timeout: {
          horizon: 1,
          api: 2,
          websocket: 3,
          transactionSeconds: 4,
          soroban: 5,
        },
      });
      expect(cm.getConfig().timeout).toEqual({
        horizon: 1,
        api: 2,
        websocket: 3,
        transactionSeconds: 4,
        soroban: 5,
      });
    });
  });
});
