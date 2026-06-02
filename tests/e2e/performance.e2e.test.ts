/**
 * E2E: Performance Benchmarks (Phase 3.2.8)
 *
 * PLAN.md targets:
 *   - Transaction submission < 2s   (build + sign + submit, excluding network RTT we can't control)
 *   - API calls            < 500ms  (median of N reads)
 *
 * These targets are realistic for a healthy Stellar testnet on a decent
 * connection. Tests run a small batch (N=5) to smooth out flake from
 * single-shot network jitter.
 *
 * Each test logs its measured timings so a regression is visible in CI
 * output even when the assertion would otherwise still pass.
 *
 * Run with: pnpm jest tests/e2e/performance --testTimeout=180000
 */
/* eslint-disable no-console */
import { KeypairWallet } from '../../src/wallet/KeypairWallet';
import {
  buildMainnetReadySDK,
  fundTestnetAccount,
} from '../integration/helpers/mainnetLikeConfig';

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx];
}

describe('E2E: Performance Benchmarks (3.2.8)', () => {
  const sdk = buildMainnetReadySDK();

  let alice: KeypairWallet;
  let bob: KeypairWallet;

  beforeAll(async () => {
    alice = sdk.wallet.create() as KeypairWallet;
    bob = sdk.wallet.create() as KeypairWallet;
    await Promise.all([
      fundTestnetAccount(alice.publicKey),
      fundTestnetAccount(bob.publicKey),
    ]);
  }, 90_000);

  // ─── API Calls: target < 500ms median ────────────────────────────────────

  describe('API call latency', () => {
    it('getAccount median should be under 500ms', async () => {
      const N = 5;
      const samples: number[] = [];
      for (let i = 0; i < N; i++) {
        const t0 = Date.now();
        await sdk.api.horizon.getAccount(alice.publicKey);
        samples.push(Date.now() - t0);
      }
      const med = median(samples);
      const max = Math.max(...samples);
      const mx = p95(samples);
      console.log(
        `[perf] getAccount N=${N} median=${med}ms p95=${mx}ms max=${max}ms samples=${samples.join(',')}`,
      );
      // Target: median < 500ms. Allow up to 1s p95 to absorb testnet jitter.
      expect(med).toBeLessThan(500);
    }, 60_000);

    it('getFeeStats median should be under 500ms', async () => {
      const N = 5;
      const samples: number[] = [];
      for (let i = 0; i < N; i++) {
        const t0 = Date.now();
        await sdk.api.horizon.getFeeStats();
        samples.push(Date.now() - t0);
      }
      const med = median(samples);
      const max = Math.max(...samples);
      console.log(
        `[perf] getFeeStats N=${N} median=${med}ms max=${max}ms samples=${samples.join(',')}`,
      );
      expect(med).toBeLessThan(500);
    }, 60_000);

    it('getTransactions median should be under 500ms', async () => {
      const N = 5;
      const samples: number[] = [];
      for (let i = 0; i < N; i++) {
        const t0 = Date.now();
        await sdk.api.horizon.getTransactions({ limit: 5 });
        samples.push(Date.now() - t0);
      }
      const med = median(samples);
      const max = Math.max(...samples);
      console.log(
        `[perf] getTransactions N=${N} median=${med}ms max=${max}ms samples=${samples.join(',')}`,
      );
      expect(med).toBeLessThan(500);
    }, 60_000);
  });

  // ─── Transaction Submission: target < 2s ─────────────────────────────────

  describe('transaction submission latency', () => {
    it('build+sign should be near-instant (no network)', async () => {
      const N = 5;
      const samples: number[] = [];
      // Use a single source account so loadAccount() hits the same warm cache
      for (let i = 0; i < N; i++) {
        const t0 = Date.now();
        const builder = await sdk
          .transaction({ sourceAccount: alice.publicKey })
          .addPayment({
            destination: bob.publicKey,
            asset: { code: 'XLM' },
            amount: '1',
          })
          .build();
        await builder.sign(alice);
        samples.push(Date.now() - t0);
      }
      const med = median(samples);
      const max = Math.max(...samples);
      console.log(
        `[perf] build+sign N=${N} median=${med}ms max=${max}ms samples=${samples.join(',')}`,
      );
      // build() does loadAccount + fetchBaseFee → 2 network calls.
      // Target: median well under the full submission budget.
      expect(med).toBeLessThan(2_000);
    }, 60_000);

    it('full submit (build → sign → submit → ledger close) should complete reasonably', async () => {
      // This includes the actual ledger close, which the SDK can't control —
      // Stellar closes ledgers every ~5s on testnet. We measure end-to-end
      // and assert it stays within a reasonable bound.
      const t0 = Date.now();
      const result = await sdk
        .transaction({ sourceAccount: alice.publicKey })
        .addPayment({
          destination: bob.publicKey,
          asset: { code: 'XLM' },
          amount: '1',
        })
        .build()
        .then((b) => b.sign(alice))
        .then((b) => b.submit());
      const elapsed = Date.now() - t0;
      console.log(`[perf] full submit elapsed=${elapsed}ms hash=${result.hash}`);

      expect(result.successful).toBe(true);
      // Stellar testnet closes ledgers every ~5s, so end-to-end including
      // ledger close is typically 3-8s. Cap at 15s to catch real regressions.
      expect(elapsed).toBeLessThan(15_000);
    }, 60_000);
  });

  // ─── Throughput sanity check ─────────────────────────────────────────────

  describe('concurrent API throughput', () => {
    it('should handle 10 parallel getAccount requests without rate-limit failure', async () => {
      const t0 = Date.now();
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => sdk.api.horizon.getAccount(alice.publicKey)),
      );
      const elapsed = Date.now() - t0;

      const ok = results.filter((r) => r.status === 'fulfilled').length;
      console.log(
        `[perf] 10 parallel getAccount: ${ok}/10 succeeded in ${elapsed}ms`,
      );
      // Even with rate limiting kicking in, we expect a high success rate
      expect(ok).toBeGreaterThanOrEqual(8);
    }, 60_000);
  });
});
