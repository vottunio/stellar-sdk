import { Keypair, Networks, Account, TransactionBuilder as StellarTxBuilder, Operation } from '@stellar/stellar-sdk';

import { ConfigManager } from '../../../src/config/ConfigManager';
import { WirexTransactionBuilder } from '../../../src/transaction/TransactionBuilder';
import { KeypairWallet } from '../../../src/wallet/KeypairWallet';

describe('WirexTransactionBuilder', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  const sourceKeypair = Keypair.random();
  const destKeypair = Keypair.random();

  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fluent API', () => {
    it('should support method chaining for addPayment', () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      const result = builder.addPayment({
        destination: destKeypair.publicKey(),
        asset: { code: 'XLM' },
        amount: '10',
      });

      expect(result).toBe(builder);
    });

    it('should support method chaining for addCreateAccount', () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      const result = builder.addCreateAccount({
        destination: destKeypair.publicKey(),
        startingBalance: '10',
      });

      expect(result).toBe(builder);
    });

    it('should support method chaining for changeTrust', () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      const result = builder.changeTrust({
        asset: { code: 'USDC', issuer: destKeypair.publicKey() },
      });

      expect(result).toBe(builder);
    });

    it('should support method chaining for addManageData', () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      const result = builder.addManageData({ name: 'key', value: 'value' });
      expect(result).toBe(builder);
    });

    it('should support method chaining for addMemo', () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      const result = builder.addMemo({ type: 'text', value: 'Hello' });
      expect(result).toBe(builder);
    });

    it('should support method chaining for setTimeout', () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      const result = builder.setTimeout(60);
      expect(result).toBe(builder);
    });

    it('should support full method chain', () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      const result = builder
        .addPayment({
          destination: destKeypair.publicKey(),
          asset: { code: 'XLM' },
          amount: '10',
        })
        .addMemo({ type: 'text', value: 'test' })
        .setTimeout(60);

      expect(result).toBe(builder);
    });
  });

  describe('addPathPayment', () => {
    it('should support method chaining', () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      const result = builder.addPathPayment({
        sendAsset: { code: 'XLM' },
        sendAmount: '10',
        destination: destKeypair.publicKey(),
        destAsset: { code: 'USDC', issuer: destKeypair.publicKey() },
        destMin: '5',
      });

      expect(result).toBe(builder);
    });
  });

  describe('getXDR', () => {
    it('should throw if transaction is not built', () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });
      expect(() => builder.getXDR()).toThrow(/not built/);
    });
  });

  describe('getSignedXDR', () => {
    it('should throw if transaction is not signed', () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });
      expect(() => builder.getSignedXDR()).toThrow(/not signed/);
    });
  });

  describe('submit', () => {
    it('should throw if transaction is not signed', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });
      await expect(builder.submit()).rejects.toThrow(/must be signed/);
    });
  });

  describe('memo types', () => {
    it('should accept all memo types without errors', () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      // These should not throw
      builder.addMemo({ type: 'text', value: 'hello' });
      builder.addMemo({ type: 'id', value: '12345' });
      builder.addMemo({ type: 'none' });
    });
  });
});
