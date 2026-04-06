import { Keypair, Networks, Account, TransactionBuilder as StellarTxBuilder, Operation, Horizon } from '@stellar/stellar-sdk';

import { ConfigManager } from '../../../src/config/ConfigManager';
import { WirexTransactionBuilder } from '../../../src/transaction/TransactionBuilder';
import { KeypairWallet } from '../../../src/wallet/KeypairWallet';

// Mock Horizon.Server
jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: jest.fn(),
    },
  };
});

describe('WirexTransactionBuilder', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  const sourceKeypair = Keypair.random();
  const destKeypair = Keypair.random();

  const mockAccount = new Account(sourceKeypair.publicKey(), '100');

  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});

    (Horizon.Server as unknown as jest.Mock).mockImplementation(() => ({
      loadAccount: jest.fn().mockResolvedValue(mockAccount),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: jest.fn().mockResolvedValue({
        hash: 'abc123',
        ledger: 42,
        successful: true,
        result_xdr: 'resultXdr',
        envelope_xdr: 'envelopeXdr',
      }),
    }));
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

    it('should support method chaining for addPathPayment', () => {
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

    it('should support method chaining for setTimeBounds', () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      const result = builder.setTimeBounds(0, 1700000000);
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

  describe('build', () => {
    it('should build a transaction with a payment operation', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      builder.addPayment({
        destination: destKeypair.publicKey(),
        asset: { code: 'XLM' },
        amount: '10',
      });

      await builder.build();
      const xdr = builder.getXDR();
      expect(xdr).toBeDefined();
      expect(typeof xdr).toBe('string');
      expect(xdr.length).toBeGreaterThan(0);
    });

    it('should build a transaction with createAccount operation', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      builder.addCreateAccount({
        destination: destKeypair.publicKey(),
        startingBalance: '100',
      });

      await builder.build();
      expect(builder.getXDR()).toBeDefined();
    });

    it('should build a transaction with changeTrust operation', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      builder.changeTrust({
        asset: { code: 'USDC', issuer: destKeypair.publicKey() },
      });

      await builder.build();
      expect(builder.getXDR()).toBeDefined();
    });

    it('should build with manage data operation', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      builder.addManageData({ name: 'testKey', value: 'testValue' });
      await builder.build();
      expect(builder.getXDR()).toBeDefined();
    });

    it('should build with manage data (delete entry, value=undefined)', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      builder.addManageData({ name: 'testKey' });
      await builder.build();
      expect(builder.getXDR()).toBeDefined();
    });

    it('should build with path payment operation', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      builder.addPathPayment({
        sendAsset: { code: 'XLM' },
        sendAmount: '10',
        destination: destKeypair.publicKey(),
        destAsset: { code: 'USDC', issuer: destKeypair.publicKey() },
        destMin: '5',
        path: [{ code: 'XLM' }],
      });

      await builder.build();
      expect(builder.getXDR()).toBeDefined();
    });

    it('should build with multiple operations', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      builder
        .addPayment({
          destination: destKeypair.publicKey(),
          asset: { code: 'XLM' },
          amount: '10',
        })
        .addManageData({ name: 'key', value: 'val' });

      await builder.build();
      expect(builder.getXDR()).toBeDefined();
    });

    it('should build with time bounds', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      builder
        .addPayment({
          destination: destKeypair.publicKey(),
          asset: { code: 'XLM' },
          amount: '10',
        })
        .setTimeBounds(0, 1800000000);

      await builder.build();
      expect(builder.getXDR()).toBeDefined();
    });
  });

  describe('memo types', () => {
    it('should build with text memo', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      builder
        .addPayment({ destination: destKeypair.publicKey(), asset: { code: 'XLM' }, amount: '1' })
        .addMemo({ type: 'text', value: 'hello' });

      await builder.build();
      expect(builder.getXDR()).toBeDefined();
    });

    it('should build with id memo', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      builder
        .addPayment({ destination: destKeypair.publicKey(), asset: { code: 'XLM' }, amount: '1' })
        .addMemo({ type: 'id', value: '12345' });

      await builder.build();
      expect(builder.getXDR()).toBeDefined();
    });

    it('should build with none memo', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      builder
        .addPayment({ destination: destKeypair.publicKey(), asset: { code: 'XLM' }, amount: '1' })
        .addMemo({ type: 'none' });

      await builder.build();
      expect(builder.getXDR()).toBeDefined();
    });

    it('should build with memo from constructor options', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
        memo: { type: 'text', value: 'from-options' },
      });

      builder.addPayment({ destination: destKeypair.publicKey(), asset: { code: 'XLM' }, amount: '1' });

      await builder.build();
      expect(builder.getXDR()).toBeDefined();
    });
  });

  describe('estimateFees', () => {
    it('should estimate fees based on operation count', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      builder
        .addPayment({ destination: destKeypair.publicKey(), asset: { code: 'XLM' }, amount: '10' })
        .addPayment({ destination: destKeypair.publicKey(), asset: { code: 'XLM' }, amount: '5' });

      const estimate = await builder.estimateFees();
      expect(estimate.baseFee).toBe('100');
      expect(estimate.operationCount).toBe(2);
      expect(estimate.estimatedFee).toBe('200');
    });

    it('should estimate at least 1 operation when no ops added', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      const estimate = await builder.estimateFees();
      expect(estimate.operationCount).toBe(1);
      expect(estimate.estimatedFee).toBe('100');
    });
  });

  describe('sign and submit', () => {
    it('should sign a built transaction', async () => {
      const wallet = KeypairWallet.create(config.horizonUrl);
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      builder.addPayment({
        destination: destKeypair.publicKey(),
        asset: { code: 'XLM' },
        amount: '10',
      });

      await builder.build();
      await builder.sign(wallet);

      const signedXdr = builder.getSignedXDR();
      expect(signedXdr).toBeDefined();
      expect(signedXdr.length).toBeGreaterThan(0);
    });

    it('should auto-build when signing without explicit build', async () => {
      const wallet = KeypairWallet.create(config.horizonUrl);
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      builder.addPayment({
        destination: destKeypair.publicKey(),
        asset: { code: 'XLM' },
        amount: '10',
      });

      // sign() should call build() internally
      await builder.sign(wallet);
      expect(builder.getSignedXDR()).toBeDefined();
    });
  });

  describe('error cases', () => {
    it('should throw if getXDR called before build', () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });
      expect(() => builder.getXDR()).toThrow(/not built/);
    });

    it('should throw if getSignedXDR called before sign', () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });
      expect(() => builder.getSignedXDR()).toThrow(/not signed/);
    });

    it('should throw if submit called before sign', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });
      await expect(builder.submit()).rejects.toThrow(/must be signed/);
    });

    it('should throw for non-native asset without issuer', async () => {
      const builder = new WirexTransactionBuilder(config, {
        sourceAccount: sourceKeypair.publicKey(),
      });

      builder.addPayment({
        destination: destKeypair.publicKey(),
        asset: { code: 'USDC' }, // missing issuer
        amount: '10',
      });

      await expect(builder.build()).rejects.toThrow(/requires an issuer/);
    });
  });
});
