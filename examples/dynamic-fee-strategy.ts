/**
 * Dynamic Fee Strategy Example
 *
 * Demonstrates the SDK's congestion-aware fee escalation (Tranche 3.1.2).
 *
 * - Reads Horizon's /fee_stats endpoint to see current network percentiles
 * - Asks the SDK to suggest a strategy based on real-time capacity
 * - Sends transactions with each of the four strategies (low/medium/high/aggressive)
 *   and compares the resulting fees
 *
 * Run: npx ts-node examples/dynamic-fee-strategy.ts
 */
/* eslint-disable no-console */
import { WirexSDK, FeeEstimator, FeeStrategy } from '../src';

const sdk = new WirexSDK({ network: 'testnet', logging: { level: 'info' } });

async function fund(addr: string) {
  const r = await fetch(`https://friendbot.stellar.org?addr=${addr}`);
  if (!r.ok) throw new Error(`Friendbot ${r.status}`);
}

async function main(): Promise<void> {
  // ─── Inspect raw fee_stats ───────────────────────────────────────────────
  console.log('1. Raw /fee_stats from Horizon:\n');
  const stats = await sdk.api.horizon.getFeeStats();
  console.log('  last_ledger      :', stats.data.last_ledger);
  console.log('  base_fee         :', stats.data.last_ledger_base_fee, 'stroops');
  console.log('  capacity_usage   :', stats.data.ledger_capacity_usage);
  console.log('  fee p10 / p50 / p90 / p99:');
  console.log('    ', stats.data.fee_charged.p10, '/', stats.data.fee_charged.p50, '/');
  console.log('    ', stats.data.fee_charged.p90, '/', stats.data.fee_charged.p99);
  console.log();

  // ─── Ask the SDK to suggest a strategy ───────────────────────────────────
  console.log('2. SDK-suggested strategy:\n');
  const estimator = new FeeEstimator(sdk.config);
  const suggestion = await estimator.suggestStrategy();
  console.log('  suggested strategy:', suggestion.strategy);
  console.log('  capacity usage    :', `${(suggestion.capacityUsage * 100).toFixed(1)}%`);
  console.log();

  // ─── Per-strategy estimates ──────────────────────────────────────────────
  console.log('3. Per-strategy estimates for a 1-op transaction:\n');
  const strategies: FeeStrategy[] = ['low', 'medium', 'high', 'aggressive'];
  for (const strategy of strategies) {
    const est = await estimator.estimateDynamic(1, strategy);
    console.log(`  ${strategy.padEnd(12)} → ${est.estimatedFee.padStart(7)} stroops`);
  }
  console.log();

  // ─── Send a real tx with each strategy ───────────────────────────────────
  console.log('4. Sending real transactions with each strategy...\n');
  const alice = sdk.wallet.create();
  const bob = sdk.wallet.create();
  await Promise.all([fund(alice.publicKey), fund(bob.publicKey)]);

  for (const strategy of strategies) {
    const result = await sdk
      .transaction({ sourceAccount: alice.publicKey })
      .addPayment({
        destination: bob.publicKey,
        asset: { code: 'XLM' },
        amount: '0.1',
      })
      .setFeeStrategy(strategy)
      .build()
      .then((b) => b.sign(alice))
      .then((b) => b.submit());

    // Fetch the tx back to inspect fee actually charged
    const onChain = await sdk.api.horizon.getTransaction(result.hash);
    console.log(`  ${strategy.padEnd(12)} → fee_charged: ${onChain.data.fee_charged} stroops, hash: ${result.hash.slice(0, 12)}…`);
  }
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
