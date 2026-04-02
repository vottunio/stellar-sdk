import { ExternalWallet } from '../../../src/wallet/ExternalWallet';
import { WalletError } from '../../../src/errors/WalletError';

describe('ExternalWallet', () => {
  const horizonUrl = 'https://horizon-testnet.stellar.org';

  describe('publicKey', () => {
    it('should throw if not connected', () => {
      const ext = new ExternalWallet('freighter', horizonUrl);
      expect(() => ext.publicKey).toThrow(WalletError);
      expect(() => ext.publicKey).toThrow(/not connected/);
    });
  });

  describe('isAvailable', () => {
    it('should return false in Node.js (no window)', async () => {
      const ext = new ExternalWallet('freighter', horizonUrl);
      const available = await ext.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false for lobstr in Node.js', async () => {
      const ext = new ExternalWallet('lobstr', horizonUrl);
      const available = await ext.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('connect', () => {
    it('should throw if wallet is not available', async () => {
      const ext = new ExternalWallet('freighter', horizonUrl);
      await expect(ext.connect()).rejects.toThrow(WalletError);
      await expect(ext.connect()).rejects.toThrow(/not available/);
    });
  });

  describe('sign', () => {
    it('should throw if not connected', async () => {
      const ext = new ExternalWallet('freighter', horizonUrl);
      await expect(ext.sign('xdr', 'passphrase')).rejects.toThrow(WalletError);
      await expect(ext.sign('xdr', 'passphrase')).rejects.toThrow(/not connected/);
    });
  });
});
