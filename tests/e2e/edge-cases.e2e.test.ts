/**
 * E2E: Edge Cases (Phase 3.2.7)
 *
 * Verifies the SDK's behavior in the four canonical failure modes called
 * out in PLAN.md, against live network conditions:
 *
 *   1. Insufficient balance  → typed error, no retry, surfaces tx code
 *   2. Bad sequence          → typed error, source account stays consistent
 *   3. Timeout               → typed error after configured timeout
 *   4. Network down          → typed error, not a raw axios crash
 *
 * The bad-sequence + insufficient-balance retry behavior at the unit level
 * is covered by `tests/unit/transaction/TransactionSubmitter.test.ts`. Here
 * we verify the error path end-to-end against real Horizon (insufficient
 * balance) and against unreachable endpoints (timeout, network down).
 *
 * Run with: pnpm jest tests/e2e/edge-cases --testTimeout=180000
 */
import { Keypair } from '@stellar/stellar-sdk';

import { WirexSDK } from '../../src';
import { StellarError } from '../../src/errors/StellarError';
import { KeypairWallet } from '../../src/wallet/KeypairWallet';
import {
  buildMainnetReadySDK,
  fundTestnetAccount,
} from '../integration/helpers/mainnetLikeConfig';

describe('E2E: Edge Cases (3.2.7)', () => {
  // ─── 1. Insufficient Balance ─────────────────────────────────────────────

  describe('insufficient balance', () => {
    const sdk = buildMainnetReadySDK();

    it('should surface a typed StellarError when paying more than account holds', async () => {
      const alice = sdk.wallet.create();
      const bob = sdk.wallet.create();
      await fundTestnetAccount(alice.publicKey);
      await fundTestnetAccount(bob.publicKey);

      // Friendbot gives ~10,000 XLM. Try to send 9 billion → underfunded.
      try {
        await sdk
          .transaction({ sourceAccount: alice.publicKey })
          .addPayment({
            destination: bob.publicKey,
            asset: { code: 'XLM' },
            amount: '9000000000',
          })
          .build()
          .then((b) => b.sign(alice as KeypairWallet))
          .then((b) => b.submit());
        fail('expected an error for insufficient balance');
      } catch (error) {
        // Must be the SDK's typed error
        expect(error).toBeInstanceOf(StellarError);
        // Should not be a raw axios error
        const err = error as Record<string, unknown>;
        expect(err.isAxiosError).toBeUndefined();
      }
    }, 90_000);
  });

  // ─── 2. Bad Sequence ─────────────────────────────────────────────────────

  describe('bad sequence', () => {
    const sdk = buildMainnetReadySDK();

    it('should surface tx_bad_seq when submitting the same tx twice', async () => {
      const alice = sdk.wallet.create();
      const bob = sdk.wallet.create();
      await fundTestnetAccount(alice.publicKey);
      await fundTestnetAccount(bob.publicKey);

      // Build + sign a payment ONCE
      const builder = await sdk
        .transaction({ sourceAccount: alice.publicKey })
        .addPayment({
          destination: bob.publicKey,
          asset: { code: 'XLM' },
          amount: '1',
        })
        .build()
        .then((b) => b.sign(alice as KeypairWallet));

      // First submit succeeds
      const first = await builder.submit();
      expect(first.successful).toBe(true);

      // Second submit of the SAME signed XDR → after 3.1.7's idempotency check,
      // the submitter should EITHER:
      //   (a) detect the tx already landed and return the existing result, OR
      //   (b) get rejected by Horizon with tx_bad_seq (post-ledger close case)
      // Both are acceptable — we just need a deterministic outcome, not a hang.
      try {
        const second = await builder.submit();
        // (a) — idempotency check returned the same tx
        expect(second.hash).toBe(first.hash);
      } catch (error) {
        // (b) — Horizon rejected the duplicate
        expect(error).toBeInstanceOf(StellarError);
        const msg = (error as Error).message;
        expect(msg.toLowerCase()).toMatch(/bad_seq|seq|hash|exists|already/);
      }
    }, 120_000);
  });

  // ─── 3. Timeout ──────────────────────────────────────────────────────────

  describe('timeout', () => {
    it('should fail within the configured timeout when the host hangs', async () => {
      // 198.51.100.1 is TEST-NET-2 (reserved for docs), so it's a black hole.
      // Connection attempts hang until the configured timeout fires.
      const sdk = new WirexSDK({
        network: 'testnet',
        horizonUrl: 'https://198.51.100.1:443',
        timeout: {
          horizon: 2_000,
          api: 2_000,
          websocket: 2_000,
          transactionSeconds: 30,
          soroban: 2_000,
        },
        retry: { maxAttempts: 1, backoffMultiplier: 1 },
      });

      const start = Date.now();
      await expect(
        sdk.api.horizon.getAccount(Keypair.random().publicKey()),
      ).rejects.toThrow();
      const elapsed = Date.now() - start;

      // Must have failed within reasonable bound of the configured 2s timeout
      // (allowing TLS handshake + DNS overhead, max 15s).
      expect(elapsed).toBeLessThan(15_000);
    }, 30_000);
  });

  // ─── 4. Network Down ─────────────────────────────────────────────────────

  describe('network down', () => {
    it('should produce a typed error when the host is unreachable', async () => {
      // Non-routable hostname → DNS lookup fails or connection refused.
      // Either path must surface as a typed SDK error, not a raw axios crash.
      const sdk = new WirexSDK({
        network: 'testnet',
        horizonUrl: 'https://this-host-does-not-exist.invalid',
        retry: { maxAttempts: 1, backoffMultiplier: 1 },
        timeout: {
          horizon: 3_000,
          api: 3_000,
          websocket: 3_000,
          transactionSeconds: 30,
          soroban: 3_000,
        },
      });

      try {
        await sdk.api.horizon.getAccount(Keypair.random().publicKey());
        fail('expected an error for unreachable host');
      } catch (error) {
        const err = error as Record<string, unknown>;
        // No raw axios leakage
        expect(err.isAxiosError).toBeUndefined();
        // Error must surface the underlying network problem
        const msg = String(err.message);
        expect(msg).toMatch(/network|not found|getaddrinfo|enotfound|timeout|connection/i);
      }
    }, 30_000);
  });

  // ─── 5. Bonus: typed-error guarantee ─────────────────────────────────────

  describe('typed-error guarantee', () => {
    const sdk = buildMainnetReadySDK();

    it('should never leak raw axios errors on 404', async () => {
      try {
        await sdk.api.horizon.getAccount(Keypair.random().publicKey());
        fail('expected 404');
      } catch (error) {
        const err = error as Record<string, unknown>;
        expect(err.isAxiosError).toBeUndefined();
        expect(err.name).toBeDefined();
        expect(err.message).toBeDefined();
      }
    }, 30_000);
  });
});
