import { Keypair } from '@stellar/stellar-sdk';

import { ConfigManager } from '../../../src/config/ConfigManager';
import { StellarError } from '../../../src/errors/StellarError';
import { WirexTransactionBuilder } from '../../../src/transaction/TransactionBuilder';

describe('WirexTransactionBuilder — Input Validation (3.1.5)', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  const validSource = Keypair.random().publicKey();
  const validDest = Keypair.random().publicKey();

  describe('addPayment validation', () => {
    it('should throw on invalid destination address', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addPayment({ destination: 'NOT_AN_ADDRESS', asset: { code: 'XLM' }, amount: '10' }),
      ).toThrow(StellarError);
    });

    it('should throw on empty destination', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addPayment({ destination: '', asset: { code: 'XLM' }, amount: '10' }),
      ).toThrow(/destination/);
    });

    it('should throw on negative amount', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addPayment({ destination: validDest, asset: { code: 'XLM' }, amount: '-5' }),
      ).toThrow(/amount/);
    });

    it('should throw on zero amount', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addPayment({ destination: validDest, asset: { code: 'XLM' }, amount: '0' }),
      ).toThrow(/greater than 0/);
    });

    it('should throw on non-numeric amount', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addPayment({ destination: validDest, asset: { code: 'XLM' }, amount: 'abc' }),
      ).toThrow(/amount/);
    });

    it('should throw on amount with too many decimals', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addPayment({ destination: validDest, asset: { code: 'XLM' }, amount: '1.12345678' }),
      ).toThrow(/fractional digits/);
    });

    it('should accept valid 7-decimal amount', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addPayment({ destination: validDest, asset: { code: 'XLM' }, amount: '1.1234567' }),
      ).not.toThrow();
    });

    it('should throw on asset code longer than 12 chars', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addPayment({
          destination: validDest,
          asset: { code: 'TOOLONG_ASSET_CODE', issuer: validSource },
          amount: '10',
        }),
      ).toThrow(/12 character limit/);
    });

    it('should throw on non-alphanumeric asset code', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addPayment({
          destination: validDest,
          asset: { code: 'BAD-CODE', issuer: validSource },
          amount: '10',
        }),
      ).toThrow(/alphanumeric/);
    });

    it('should throw on invalid issuer', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addPayment({
          destination: validDest,
          asset: { code: 'USDC', issuer: 'NOT_A_VALID_ISSUER' },
          amount: '10',
        }),
      ).toThrow(/issuer/);
    });

    it('should accept native XLM with no issuer', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addPayment({ destination: validDest, asset: { code: 'XLM' }, amount: '10' }),
      ).not.toThrow();
    });

    it('should accept valid custom asset', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addPayment({
          destination: validDest,
          asset: { code: 'USDC', issuer: validSource },
          amount: '10',
        }),
      ).not.toThrow();
    });
  });

  describe('addCreateAccount validation', () => {
    it('should throw on invalid destination', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addCreateAccount({ destination: 'BAD', startingBalance: '10' }),
      ).toThrow(StellarError);
    });

    it('should throw on zero startingBalance', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addCreateAccount({ destination: validDest, startingBalance: '0' }),
      ).toThrow(/startingBalance/);
    });
  });

  describe('changeTrust validation', () => {
    it('should throw on invalid asset code', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.changeTrust({ asset: { code: '$BAD', issuer: validSource } }),
      ).toThrow(StellarError);
    });

    it('should accept limit of 0 (revoke trustline)', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.changeTrust({ asset: { code: 'USDC', issuer: validSource }, limit: '0' }),
      ).not.toThrow();
    });
  });

  describe('addManageData validation', () => {
    it('should throw on empty name', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() => b.addManageData({ name: '', value: 'foo' })).toThrow(/data name/);
    });

    it('should throw on name longer than 64 chars', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addManageData({ name: 'a'.repeat(65), value: 'foo' }),
      ).toThrow(/64/);
    });

    it('should accept 64-char name', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addManageData({ name: 'a'.repeat(64), value: 'foo' }),
      ).not.toThrow();
    });
  });

  describe('addPathPayment validation', () => {
    it('should throw on invalid destination', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addPathPayment({
          sendAsset: { code: 'XLM' },
          sendAmount: '10',
          destination: 'BAD',
          destAsset: { code: 'XLM' },
          destMin: '5',
        }),
      ).toThrow(StellarError);
    });

    it('should validate path assets', () => {
      const b = new WirexTransactionBuilder(config, { sourceAccount: validSource });
      expect(() =>
        b.addPathPayment({
          sendAsset: { code: 'XLM' },
          sendAmount: '10',
          destination: validDest,
          destAsset: { code: 'XLM' },
          destMin: '5',
          path: [{ code: 'TOOLONG_ASSET_CODE', issuer: validSource }],
        }),
      ).toThrow(/12 character limit/);
    });
  });
});
