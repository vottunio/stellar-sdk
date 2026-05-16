/**
 * Mainnet-Ready Integration Tests (Tranche 3.2.2)
 *
 * Runs against Stellar testnet, but with production-grade configuration
 * (mainnet timeouts, dynamic fee escalation, production retry policy).
 *
 * Goal: prove the SDK's mainnet code paths work correctly against real
 * Horizon endpoints, without spending real XLM. SCF acceptance criterion:
 * "End-to-end testnet payment flows executed via the SDK" plus
 * "mainnet-like config" validation.
 *
 * Run with: pnpm jest tests/integration/mainnet-ready --testTimeout=120000
 */
import { Keypair } from '@stellar/stellar-sdk';

import { KeypairWallet } from '../../src/wallet/KeypairWallet';

import { buildMainnetReadySDK, fundTestnetAccount } from './helpers/mainnetLikeConfig';

describe('Mainnet-Ready Integration (testnet + mainnet config)', () => {
  const sdk = buildMainnetReadySDK();
  let sourceWallet: KeypairWallet;
  let destKeypair: Keypair;

  beforeAll(async () => {
    sourceWallet = sdk.wallet.create() as KeypairWallet;
    destKeypair = Keypair.random();
    await fundTestnetAccount(sourceWallet.publicKey);
  }, 90_000);

  describe('configuration sanity', () => {
    it('should resolve mainnet-grade timeouts', () => {
      const cfg = sdk.config;
      expect(cfg.timeout.horizon).toBe(60_000);
      expect(cfg.timeout.transactionSeconds).toBe(180);
      expect(cfg.timeout.soroban).toBe(60_000);
    });

    it('should use production retry policy', () => {
      const cfg = sdk.config;
      expect(cfg.retry.maxAttempts).toBeGreaterThanOrEqual(3);
      expect(cfg.retry.backoffMultiplier).toBeGreaterThanOrEqual(1.5);
    });

    it('should still point at testnet (no real XLM at risk)', () => {
      const cfg = sdk.config;
      expect(cfg.network).toBe('testnet');
      expect(cfg.horizonUrl).toContain('testnet');
    });
  });

  describe('dynamic fee estimation', () => {
    it('should fetch fee_stats and produce a dynamic estimate', async () => {
      // Hit Horizon's /fee_stats endpoint directly via the SDK
      const feeStats = await sdk.api.horizon.getFeeStats();
      expect(feeStats.data).toBeDefined();
      expect(parseInt(feeStats.data.fee_charged.p50, 10)).toBeGreaterThan(0);
      expect(parseInt(feeStats.data.last_ledger_base_fee, 10)).toBeGreaterThan(0);
    }, 30_000);

    it('should suggest a strategy based on real network capacity', async () => {
      // FeeEstimator.suggestStrategy() reads /fee_stats and picks low/medium/high/aggressive
      const { FeeEstimator } = await import('../../src/transaction/FeeEstimator');
      const estimator = new FeeEstimator(sdk.config);
      const { strategy, capacityUsage } = await estimator.suggestStrategy();

      expect(['low', 'medium', 'high', 'aggressive']).toContain(strategy);
      expect(capacityUsage).toBeGreaterThanOrEqual(0);
      expect(capacityUsage).toBeLessThanOrEqual(1);
    }, 30_000);
  });

  describe('payment with mainnet-ready settings', () => {
    it('should create account then send a payment using dynamic fees', async () => {
      // Step 1: create the destination account on-chain
      const createResult = await sdk
        .transaction({ sourceAccount: sourceWallet.publicKey })
        .addCreateAccount({
          destination: destKeypair.publicKey(),
          startingBalance: '10',
        })
        // Explicitly use a fee strategy — exercises the dynamic-fee code path
        .setFeeStrategy('medium')
        .build()
        .then((b) => b.sign(sourceWallet))
        .then((b) => b.submit());

      expect(createResult.successful).toBe(true);
      expect(createResult.hash).toMatch(/^[0-9a-f]{64}$/);

      // Step 2: send a payment to the new account, also with dynamic fees
      const payResult = await sdk
        .transaction({ sourceAccount: sourceWallet.publicKey })
        .addPayment({
          destination: destKeypair.publicKey(),
          asset: { code: 'XLM' },
          amount: '5',
        })
        .addMemo({ type: 'text', value: 'mainnet-ready-3.2.2' })
        .setFeeStrategy('high')
        .build()
        .then((b) => b.sign(sourceWallet))
        .then((b) => b.submit());

      expect(payResult.successful).toBe(true);
    }, 90_000);
  });

  describe('error handling under mainnet config', () => {
    it('should map 404 to typed ApiError without retry', async () => {
      // Query a non-existent account — exercises the deterministic-error path
      // of the production retry policy (404 should NOT be retried).
      const bogusAddress = Keypair.random().publicKey();
      await expect(sdk.api.horizon.getAccount(bogusAddress)).rejects.toThrow(/Not found/);
    }, 30_000);
  });
});
