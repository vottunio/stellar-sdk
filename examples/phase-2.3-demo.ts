/**
 * Phase 2.3 Demo — API Client Module
 *
 * Tests Horizon REST + Soroban RPC + External Client against real Stellar testnet:
 * 1. Horizon: getAccount, getTransactions, getTransaction, getOperations, getPayments
 * 2. Horizon: getEffects, getLedger, getAssets, getFeeStats
 * 3. Soroban RPC: getHealth, getNetwork
 * 4. External client factory
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' examples/phase-2.3-demo.ts
 */

import { WirexSDK } from '../src';

async function main() {
  console.log('=== Phase 2.3 — API Client Demo ===\n');

  const sdk = new WirexSDK({ network: 'testnet', logging: { level: 'none' } });

  // Fund a test account first
  const wallet = sdk.wallet.create();
  console.log(`Test account: ${wallet.publicKey}`);
  console.log('Funding via Friendbot...');
  await sdk.stellar.fundTestAccount(wallet.publicKey);

  // Send a tx so we have data to query
  const bob = sdk.wallet.create();
  await sdk.stellar.fundTestAccount(bob.publicKey);
  const txResult = await sdk.stellar.sendPayment(
    { sourceAccount: wallet.publicKey, destination: bob.publicKey, asset: { code: 'XLM' }, amount: '10' },
    wallet,
  );
  console.log(`Sent tx: ${txResult.hash}\n`);

  // ─── Horizon REST API ──────────────────────────────────────────────

  // 2.3.2: getAccount
  console.log('[2.3.2] getAccount');
  const account = await sdk.api.horizon.getAccount(wallet.publicKey);
  console.log(`  Account: ${account.data.account_id}`);
  console.log(`  Sequence: ${account.data.sequence}`);
  console.log(`  Balances: ${account.data.balances.length} asset(s)`);

  // 2.3.3: getTransactions
  console.log('\n[2.3.3] getTransactions');
  const txs = await sdk.api.horizon.getTransactions({ account: wallet.publicKey, limit: 3 });
  console.log(`  Found ${txs.data.length} transactions`);
  console.log(`  Pagination cursor: ${txs.pagination?.cursor ?? 'none'}`);
  console.log(`  Has more: ${txs.pagination?.hasMore}`);

  // 2.3.4: getTransaction (single)
  console.log('\n[2.3.4] getTransaction');
  const singleTx = await sdk.api.horizon.getTransaction(txResult.hash);
  console.log(`  Hash: ${singleTx.data.hash}`);
  console.log(`  Ledger: ${singleTx.data.ledger}`);
  console.log(`  Successful: ${singleTx.data.successful}`);

  // 2.3.5: getOperations
  console.log('\n[2.3.5] getOperations');
  const ops = await sdk.api.horizon.getOperations({ transaction: txResult.hash });
  console.log(`  Found ${ops.data.length} operation(s)`);
  if (ops.data[0]) console.log(`  Type: ${ops.data[0].type}`);

  // 2.3.6: getPayments
  console.log('\n[2.3.6] getPayments');
  const payments = await sdk.api.horizon.getPayments({ account: wallet.publicKey, limit: 5 });
  console.log(`  Found ${payments.data.length} payment(s)`);

  // 2.3.7: getEffects
  console.log('\n[2.3.7] getEffects');
  const effects = await sdk.api.horizon.getEffects({ account: wallet.publicKey, limit: 3 });
  console.log(`  Found ${effects.data.length} effect(s)`);
  if (effects.data[0]) console.log(`  First: ${effects.data[0].type}`);

  // 2.3.8: getLedger
  console.log('\n[2.3.8] getLedger (latest)');
  const ledger = await sdk.api.horizon.getLedger();
  console.log(`  Sequence: ${ledger.data.sequence}`);
  console.log(`  Closed at: ${ledger.data.closed_at}`);

  // 2.3.9: getAssets
  console.log('\n[2.3.9] getAssets');
  const assets = await sdk.api.horizon.getAssets({ asset_code: 'USDC', limit: 3 });
  console.log(`  Found ${assets.data.length} USDC asset(s)`);

  // 2.3.12: getFeeStats
  console.log('\n[2.3.12] getFeeStats');
  const fees = await sdk.api.horizon.getFeeStats();
  console.log(`  Last ledger: ${fees.data.last_ledger}`);
  console.log(`  Base fee: ${fees.data.last_ledger_base_fee}`);
  console.log(`  Fee p50: ${fees.data.fee_charged.p50}`);
  console.log(`  Fee p99: ${fees.data.fee_charged.p99}`);

  // ─── Soroban RPC ──────────────────────────────────────────────────

  // 2.3.13: getHealth
  console.log('\n[2.3.13] Soroban getHealth');
  const health = await sdk.api.soroban.getHealth();
  console.log(`  Status: ${health.data.status}`);
  console.log(`  Latest ledger: ${health.data.latestLedger}`);

  // 2.3.17: getNetwork
  console.log('\n[2.3.17] Soroban getNetwork');
  const network = await sdk.api.soroban.getNetwork();
  console.log(`  Passphrase: ${network.data.passphrase}`);
  console.log(`  Protocol: ${network.data.protocolVersion}`);

  // ─── External Client Factory ──────────────────────────────────────

  // 2.3.20: external client
  console.log('\n[2.3.20] External client factory');
  const externalClient = sdk.api.external('https://horizon-testnet.stellar.org');
  const extResult = await externalClient.get('/fee_stats');
  console.log(`  External client works: ${(extResult.data as Record<string, unknown>).last_ledger !== undefined}`);

  console.log('\n=== Phase 2.3 Demo Complete ===');
}

main().catch((error) => {
  console.error('\nDemo failed:', error);
  process.exit(1);
});
