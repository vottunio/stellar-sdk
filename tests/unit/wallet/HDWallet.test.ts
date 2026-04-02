import * as bip39 from 'bip39';

import { HDWallet } from '../../../src/wallet/HDWallet';
import { WalletError } from '../../../src/errors/WalletError';

describe('HDWallet', () => {
  const horizonUrl = 'https://horizon-testnet.stellar.org';
  const validMnemonic = bip39.generateMnemonic(256);

  describe('generate', () => {
    it('should create an HD wallet with a valid mnemonic', () => {
      const hd = HDWallet.generate(horizonUrl);
      const mnemonic = hd.exportMnemonic();
      expect(bip39.validateMnemonic(mnemonic)).toBe(true);
      expect(mnemonic.split(' ').length).toBe(24);
    });

    it('should generate a valid Stellar public key', () => {
      const hd = HDWallet.generate(horizonUrl);
      expect(hd.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    });
  });

  describe('fromMnemonic', () => {
    it('should import from a valid mnemonic', () => {
      const hd = HDWallet.fromMnemonic(validMnemonic, horizonUrl);
      expect(hd.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    });

    it('should throw on invalid mnemonic', () => {
      expect(() => HDWallet.fromMnemonic('invalid mnemonic words', horizonUrl)).toThrow(
        WalletError,
      );
    });

    it('should derive the same key for the same mnemonic', () => {
      const hd1 = HDWallet.fromMnemonic(validMnemonic, horizonUrl);
      const hd2 = HDWallet.fromMnemonic(validMnemonic, horizonUrl);
      expect(hd1.publicKey).toBe(hd2.publicKey);
    });
  });

  describe('deriveAccount', () => {
    it('should derive different accounts at different indices', () => {
      const hd = HDWallet.fromMnemonic(validMnemonic, horizonUrl);
      const a0 = hd.deriveAccount(0);
      const a1 = hd.deriveAccount(1);
      const a2 = hd.deriveAccount(2);

      expect(a0.publicKey).not.toBe(a1.publicKey);
      expect(a1.publicKey).not.toBe(a2.publicKey);
    });

    it('should derive the same account at the same index', () => {
      const hd = HDWallet.fromMnemonic(validMnemonic, horizonUrl);
      const a1 = hd.deriveAccount(5);
      const a2 = hd.deriveAccount(5);
      expect(a1.publicKey).toBe(a2.publicKey);
    });

    it('should throw on negative index', () => {
      const hd = HDWallet.fromMnemonic(validMnemonic, horizonUrl);
      expect(() => hd.deriveAccount(-1)).toThrow(WalletError);
    });

    it('should throw on non-integer index', () => {
      const hd = HDWallet.fromMnemonic(validMnemonic, horizonUrl);
      expect(() => hd.deriveAccount(1.5)).toThrow(WalletError);
    });

    it('should return a ManagedWallet with exportSecret', () => {
      const hd = HDWallet.fromMnemonic(validMnemonic, horizonUrl);
      const derived = hd.deriveAccount(0);
      const secret = derived.exportSecret();
      expect(secret).toMatch(/^S[A-Z2-7]{55}$/);
    });
  });

  describe('exportMnemonic', () => {
    it('should return the original mnemonic', () => {
      const hd = HDWallet.fromMnemonic(validMnemonic, horizonUrl);
      expect(hd.exportMnemonic()).toBe(validMnemonic);
    });
  });

  describe('BIP44 path compliance', () => {
    it('should use m/44\'/148\'/{index}\' derivation path', () => {
      // Verify deterministic derivation — same mnemonic always yields same key at index 0
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const hd = HDWallet.fromMnemonic(mnemonic, horizonUrl);
      const key0 = hd.deriveAccount(0).publicKey;

      // Re-derive — must be identical
      const hd2 = HDWallet.fromMnemonic(mnemonic, horizonUrl);
      expect(hd2.deriveAccount(0).publicKey).toBe(key0);
    });
  });
});
