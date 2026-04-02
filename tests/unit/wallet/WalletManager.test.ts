import * as bip39 from 'bip39';

import { ConfigManager } from '../../../src/config/ConfigManager';
import { WalletManager } from '../../../src/wallet/WalletManager';
import { ExternalWallet } from '../../../src/wallet/ExternalWallet';
import { WalletError } from '../../../src/errors/WalletError';

describe('WalletManager', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  let manager: WalletManager;

  beforeEach(() => {
    manager = new WalletManager(config);
  });

  describe('create', () => {
    it('should create a new random wallet', () => {
      const wallet = manager.create();
      expect(wallet.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    });

    it('should create wallets that can export secret keys', () => {
      const wallet = manager.create();
      expect(wallet.exportSecret()).toMatch(/^S[A-Z2-7]{55}$/);
    });
  });

  describe('importFromSecret', () => {
    it('should import a wallet from a valid secret', () => {
      const created = manager.create();
      const secret = created.exportSecret();
      const imported = manager.importFromSecret(secret);
      expect(imported.publicKey).toBe(created.publicKey);
    });

    it('should throw on invalid secret', () => {
      expect(() => manager.importFromSecret('INVALID')).toThrow(WalletError);
    });
  });

  describe('importFromMnemonic', () => {
    it('should import a wallet from a mnemonic', () => {
      const mnemonic = bip39.generateMnemonic(256);
      const wallet = manager.importFromMnemonic(mnemonic);
      expect(wallet.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    });

    it('should import different accounts at different indices', () => {
      const mnemonic = bip39.generateMnemonic(256);
      const w0 = manager.importFromMnemonic(mnemonic, 0);
      const w1 = manager.importFromMnemonic(mnemonic, 1);
      expect(w0.publicKey).not.toBe(w1.publicKey);
    });
  });

  describe('createHD', () => {
    it('should create an HD wallet with a new mnemonic', () => {
      const hd = manager.createHD();
      const mnemonic = hd.exportMnemonic();
      expect(bip39.validateMnemonic(mnemonic)).toBe(true);
    });

    it('should create an HD wallet from a provided mnemonic', () => {
      const mnemonic = bip39.generateMnemonic(256);
      const hd = manager.createHD(mnemonic);
      expect(hd.exportMnemonic()).toBe(mnemonic);
    });
  });

  describe('connectExternal', () => {
    it('should return an ExternalWallet for freighter', () => {
      const ext = manager.connectExternal('freighter');
      expect(ext).toBeInstanceOf(ExternalWallet);
    });

    it('should return an ExternalWallet for lobstr', () => {
      const ext = manager.connectExternal('lobstr');
      expect(ext).toBeInstanceOf(ExternalWallet);
    });
  });
});
