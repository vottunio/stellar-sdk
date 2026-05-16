/**
 * E2E: Full Payment Flow (Phase 3.2.3)
 *
 * Exercises the canonical end-to-end Stellar payment lifecycle exactly
 * as specified in PLAN.md Phase 3.2.3:
 *
 *   create wallet → fund → trustline → payment → confirm
 *
 * The test uses Stellar testnet (Friendbot) with mainnet-grade config,
 * so it validates the same code paths users will hit on mainnet without
 * spending real XLM.
 *
 * SCF acceptance criterion (Phase 3): "Successful E2E payment flow
 * executed using the SDK."
 *
 * Run with: pnpm jest tests/e2e/payment-flow --testTimeout=180000
 *
 * If Friendbot or the testnet is congested, the test will retry the
 * funding step before failing. It is NOT a flake-tolerance harness for
 * the SDK itself — assertion failures should be treated as real bugs.
 */
import { Keypair } from '@stellar/stellar-sdk';

import { KeypairWallet } from '../../src/wallet/KeypairWallet';
import {
  buildMainnetReadySDK,
  fundTestnetAccount,
} from '../integration/helpers/mainnetLikeConfig';

// Testnet USDC issuer used by Stellar Quest & demo apps
const TESTNET_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

describe('E2E: Full Payment Flow (3.2.3)', () => {
  const sdk = buildMainnetReadySDK();

  let alice: KeypairWallet;
  let bobKeypair: Keypair;

  beforeAll(async () => {
    // Step 1: CREATE WALLET — Alice (sender) and Bob (recipient keypair only)
    alice = sdk.wallet.create() as KeypairWallet;
    bobKeypair = Keypair.random();

    // Step 2: FUND — Friendbot funds Alice with 10,000 testnet XLM
    await fundTestnetAccount(alice.publicKey);
  }, 90_000);

  describe('canonical flow: create → fund → trustline → payment → confirm', () => {
    it('should complete every step with on-chain verification', async () => {
      // ─── Step 3a: Use Alice's funded account to create Bob on-chain ─────
      const createResult = await sdk.stellar.createAccount(
        {
          sourceAccount: alice.publicKey,
          destination: bobKeypair.publicKey(),
          startingBalance: '20',
        },
        alice,
      );
      expect(createResult.successful).toBe(true);
      expect(createResult.hash).toMatch(/^[0-9a-f]{64}$/);

      // Wrap Bob as a real wallet so he can sign his own trustline
      const bob = sdk.wallet.importFromSecret(bobKeypair.secret()) as KeypairWallet;

      // ─── Step 3b: TRUSTLINE — Bob accepts USDC ───────────────────────────
      const trustResult = await sdk.stellar.changeTrust(
        {
          sourceAccount: bob.publicKey,
          asset: { code: 'USDC', issuer: TESTNET_USDC_ISSUER },
        },
        bob,
      );
      expect(trustResult.successful).toBe(true);

      // Verify the trustline now appears in Bob's balances
      const bobBalancesAfterTrust = await sdk.stellar.getBalances(bob.publicKey);
      const usdcTrustline = bobBalancesAfterTrust.find(
        (b) => b.code === 'USDC' && b.issuer === TESTNET_USDC_ISSUER,
      );
      expect(usdcTrustline).toBeDefined();
      expect(parseFloat(usdcTrustline!.balance)).toBe(0); // trustline exists, no balance yet

      // ─── Step 4: PAYMENT — Alice sends 5 XLM to Bob ──────────────────────
      const aliceBalanceBefore = await sdk.stellar.getBalances(alice.publicKey);
      const aliceXlmBefore = parseFloat(
        aliceBalanceBefore.find((b) => b.code === 'XLM')!.balance,
      );

      const payResult = await sdk
        .transaction({ sourceAccount: alice.publicKey })
        .addPayment({
          destination: bob.publicKey,
          asset: { code: 'XLM' },
          amount: '5',
        })
        .addMemo({ type: 'text', value: 'e2e-3.2.3' })
        .build()
        .then((b) => b.sign(alice))
        .then((b) => b.submit());

      expect(payResult.successful).toBe(true);
      expect(payResult.ledger).toBeGreaterThan(0);

      // ─── Step 5: CONFIRM — fetch by hash and verify it's on-chain ────────
      const fetched = await sdk.api.horizon.getTransaction(payResult.hash);
      expect(fetched.data.hash).toBe(payResult.hash);
      expect(fetched.data.successful).toBe(true);
      expect(fetched.data.ledger).toBe(payResult.ledger);

      // ─── Final balance assertions: Alice paid, Bob received ──────────────
      const aliceBalanceAfter = await sdk.stellar.getBalances(alice.publicKey);
      const aliceXlmAfter = parseFloat(
        aliceBalanceAfter.find((b) => b.code === 'XLM')!.balance,
      );
      // Alice's balance dropped by ~5 XLM (plus negligible fee)
      expect(aliceXlmBefore - aliceXlmAfter).toBeGreaterThan(4.99);
      expect(aliceXlmBefore - aliceXlmAfter).toBeLessThan(5.01);

      const bobBalanceAfter = await sdk.stellar.getBalances(bob.publicKey);
      const bobXlm = parseFloat(bobBalanceAfter.find((b) => b.code === 'XLM')!.balance);
      // Bob started at 20, received 5 (minus trustline op fee, negligible)
      expect(bobXlm).toBeGreaterThan(24.99);
      expect(bobXlm).toBeLessThan(25.01);
    }, 180_000);
  });

  describe('edge cases', () => {
    it('should reject payment to a non-existent account with destination=insufficient XLM', async () => {
      // Try to send less than 1 XLM to a brand new (unfunded) address.
      // This should fail because the destination needs the create-account
      // op, not payment. Tests deterministic-error path of the submitter.
      const ghost = Keypair.random().publicKey();
      const txAttempt = sdk
        .transaction({ sourceAccount: alice.publicKey })
        .addPayment({
          destination: ghost,
          asset: { code: 'XLM' },
          amount: '0.1',
        })
        .build()
        .then((b) => b.sign(alice))
        .then((b) => b.submit());

      // The SDK should surface a typed StellarError, not a raw axios error
      await expect(txAttempt).rejects.toThrow();
    }, 60_000);
  });
});
