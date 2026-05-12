import { WalletError } from '../../../src/errors/WalletError';
import { ExternalWallet } from '../../../src/wallet/ExternalWallet';

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
    it('should return false in Node.js (no window) for freighter', async () => {
      const ext = new ExternalWallet('freighter', horizonUrl);
      const available = await ext.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false in Node.js (no window) for lobstr', async () => {
      const ext = new ExternalWallet('lobstr', horizonUrl);
      const available = await ext.isAvailable();
      expect(available).toBe(false);
    });

    it('should return true when freighter is present on window', async () => {
      const originalWindow = (global as unknown as Record<string, unknown>).window;
      (global as unknown as Record<string, unknown>).window = { freighter: {} };

      try {
        const ext = new ExternalWallet('freighter', horizonUrl);
        const available = await ext.isAvailable();
        expect(available).toBe(true);
      } finally {
        if (originalWindow === undefined) {
          delete (global as unknown as Record<string, unknown>).window;
        } else {
          (global as unknown as Record<string, unknown>).window = originalWindow;
        }
      }
    });

    it('should return true when lobstrSigner is present on window', async () => {
      const originalWindow = (global as unknown as Record<string, unknown>).window;
      (global as unknown as Record<string, unknown>).window = { lobstrSigner: {} };

      try {
        const ext = new ExternalWallet('lobstr', horizonUrl);
        const available = await ext.isAvailable();
        expect(available).toBe(true);
      } finally {
        if (originalWindow === undefined) {
          delete (global as unknown as Record<string, unknown>).window;
        } else {
          (global as unknown as Record<string, unknown>).window = originalWindow;
        }
      }
    });
  });

  describe('connect', () => {
    it('should throw if wallet is not available', async () => {
      const ext = new ExternalWallet('freighter', horizonUrl);
      await expect(ext.connect()).rejects.toThrow(WalletError);
      await expect(ext.connect()).rejects.toThrow(/not available/);
    });

    it('should connect to freighter and return public key', async () => {
      const mockPublicKey = 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEFGH';
      const originalWindow = (global as unknown as Record<string, unknown>).window;
      (global as unknown as Record<string, unknown>).window = {
        freighter: {
          getPublicKey: jest.fn().mockResolvedValue(mockPublicKey),
        },
      };

      try {
        const ext = new ExternalWallet('freighter', horizonUrl);
        const pubKey = await ext.connect();
        expect(pubKey).toBe(mockPublicKey);
        expect(ext.publicKey).toBe(mockPublicKey);
      } finally {
        if (originalWindow === undefined) {
          delete (global as unknown as Record<string, unknown>).window;
        } else {
          (global as unknown as Record<string, unknown>).window = originalWindow;
        }
      }
    });

    it('should connect to lobstr and return public key', async () => {
      const mockPublicKey = 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEFGH';
      const originalWindow = (global as unknown as Record<string, unknown>).window;
      (global as unknown as Record<string, unknown>).window = {
        lobstrSigner: {
          getPublicKey: jest.fn().mockResolvedValue(mockPublicKey),
        },
      };

      try {
        const ext = new ExternalWallet('lobstr', horizonUrl);
        const pubKey = await ext.connect();
        expect(pubKey).toBe(mockPublicKey);
        expect(ext.publicKey).toBe(mockPublicKey);
      } finally {
        if (originalWindow === undefined) {
          delete (global as unknown as Record<string, unknown>).window;
        } else {
          (global as unknown as Record<string, unknown>).window = originalWindow;
        }
      }
    });

    it('should throw if freighter returns null public key', async () => {
      const originalWindow = (global as unknown as Record<string, unknown>).window;
      (global as unknown as Record<string, unknown>).window = {
        freighter: {
          getPublicKey: jest.fn().mockResolvedValue(null),
        },
      };

      try {
        const ext = new ExternalWallet('freighter', horizonUrl);
        await expect(ext.connect()).rejects.toThrow(WalletError);
      } finally {
        if (originalWindow === undefined) {
          delete (global as unknown as Record<string, unknown>).window;
        } else {
          (global as unknown as Record<string, unknown>).window = originalWindow;
        }
      }
    });

    it('should throw WalletError if freighter.getPublicKey rejects', async () => {
      const originalWindow = (global as unknown as Record<string, unknown>).window;
      (global as unknown as Record<string, unknown>).window = {
        freighter: {
          getPublicKey: jest.fn().mockRejectedValue(new Error('user denied')),
        },
      };

      try {
        const ext = new ExternalWallet('freighter', horizonUrl);
        await expect(ext.connect()).rejects.toThrow(WalletError);
        await expect(ext.connect()).rejects.toThrow(/Failed to connect/);
      } finally {
        if (originalWindow === undefined) {
          delete (global as unknown as Record<string, unknown>).window;
        } else {
          (global as unknown as Record<string, unknown>).window = originalWindow;
        }
      }
    });
  });

  describe('sign', () => {
    it('should throw if not connected', async () => {
      const ext = new ExternalWallet('freighter', horizonUrl);
      await expect(ext.sign('xdr', 'passphrase')).rejects.toThrow(WalletError);
      await expect(ext.sign('xdr', 'passphrase')).rejects.toThrow(/not connected/);
    });

    it('should sign via freighter when connected', async () => {
      const mockPublicKey = 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEFGH';
      const signedXdr = 'signed-xdr-data';
      const originalWindow = (global as unknown as Record<string, unknown>).window;
      (global as unknown as Record<string, unknown>).window = {
        freighter: {
          getPublicKey: jest.fn().mockResolvedValue(mockPublicKey),
          signTransaction: jest.fn().mockResolvedValue(signedXdr),
        },
      };

      try {
        const ext = new ExternalWallet('freighter', horizonUrl);
        await ext.connect();
        const result = await ext.sign('test-xdr', 'Test SDF Network');
        expect(result).toBe(signedXdr);
      } finally {
        if (originalWindow === undefined) {
          delete (global as unknown as Record<string, unknown>).window;
        } else {
          (global as unknown as Record<string, unknown>).window = originalWindow;
        }
      }
    });

    it('should sign via lobstr when connected', async () => {
      const mockPublicKey = 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEFGH';
      const signedXdr = 'lobstr-signed-xdr';
      const originalWindow = (global as unknown as Record<string, unknown>).window;
      (global as unknown as Record<string, unknown>).window = {
        lobstrSigner: {
          getPublicKey: jest.fn().mockResolvedValue(mockPublicKey),
          signTransaction: jest.fn().mockResolvedValue(signedXdr),
        },
      };

      try {
        const ext = new ExternalWallet('lobstr', horizonUrl);
        await ext.connect();
        const result = await ext.sign('test-xdr', 'Test SDF Network');
        expect(result).toBe(signedXdr);
      } finally {
        if (originalWindow === undefined) {
          delete (global as unknown as Record<string, unknown>).window;
        } else {
          (global as unknown as Record<string, unknown>).window = originalWindow;
        }
      }
    });

    it('should throw WalletError if signing is rejected', async () => {
      const mockPublicKey = 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEFGH';
      const originalWindow = (global as unknown as Record<string, unknown>).window;
      (global as unknown as Record<string, unknown>).window = {
        freighter: {
          getPublicKey: jest.fn().mockResolvedValue(mockPublicKey),
          signTransaction: jest.fn().mockRejectedValue(new Error('user rejected')),
        },
      };

      try {
        const ext = new ExternalWallet('freighter', horizonUrl);
        await ext.connect();
        await expect(ext.sign('xdr', 'passphrase')).rejects.toThrow(WalletError);
        await expect(ext.sign('xdr', 'passphrase')).rejects.toThrow(/rejected/i);
      } finally {
        if (originalWindow === undefined) {
          delete (global as unknown as Record<string, unknown>).window;
        } else {
          (global as unknown as Record<string, unknown>).window = originalWindow;
        }
      }
    });
  });

  describe('getBalances', () => {
    it('should throw if not connected', async () => {
      const ext = new ExternalWallet('freighter', horizonUrl);
      expect(() => ext.publicKey).toThrow(WalletError);
    });

    it('should fetch balances when connected', async () => {
      const mockPublicKey = 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEFGH';
      const originalWindow = (global as unknown as Record<string, unknown>).window;
      const originalFetch = global.fetch;
      (global as unknown as Record<string, unknown>).window = {
        freighter: {
          getPublicKey: jest.fn().mockResolvedValue(mockPublicKey),
        },
      };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          balances: [
            { asset_type: 'native', balance: '99.0000000' },
          ],
        }),
      }) as jest.Mock;

      try {
        const ext = new ExternalWallet('freighter', horizonUrl);
        await ext.connect();
        const balances = await ext.getBalances();
        expect(balances).toHaveLength(1);
        expect(balances[0].code).toBe('XLM');
      } finally {
        global.fetch = originalFetch;
        if (originalWindow === undefined) {
          delete (global as unknown as Record<string, unknown>).window;
        } else {
          (global as unknown as Record<string, unknown>).window = originalWindow;
        }
      }
    });

    it('should throw WalletError on 404', async () => {
      const mockPublicKey = 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEFGH';
      const originalWindow = (global as unknown as Record<string, unknown>).window;
      const originalFetch = global.fetch;
      (global as unknown as Record<string, unknown>).window = {
        freighter: {
          getPublicKey: jest.fn().mockResolvedValue(mockPublicKey),
        },
      };
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as jest.Mock;

      try {
        const ext = new ExternalWallet('freighter', horizonUrl);
        await ext.connect();
        await expect(ext.getBalances()).rejects.toThrow(WalletError);
        await expect(ext.getBalances()).rejects.toThrow(/not found/i);
      } finally {
        global.fetch = originalFetch;
        if (originalWindow === undefined) {
          delete (global as unknown as Record<string, unknown>).window;
        } else {
          (global as unknown as Record<string, unknown>).window = originalWindow;
        }
      }
    });

    it('should throw WalletError on non-404 HTTP error', async () => {
      const mockPublicKey = 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEFGH';
      const originalWindow = (global as unknown as Record<string, unknown>).window;
      const originalFetch = global.fetch;
      (global as unknown as Record<string, unknown>).window = {
        freighter: {
          getPublicKey: jest.fn().mockResolvedValue(mockPublicKey),
        },
      };
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as jest.Mock;

      try {
        const ext = new ExternalWallet('freighter', horizonUrl);
        await ext.connect();
        await expect(ext.getBalances()).rejects.toThrow(WalletError);
      } finally {
        global.fetch = originalFetch;
        if (originalWindow === undefined) {
          delete (global as unknown as Record<string, unknown>).window;
        } else {
          (global as unknown as Record<string, unknown>).window = originalWindow;
        }
      }
    });
  });
});
