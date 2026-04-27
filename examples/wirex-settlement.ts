/**
 * Wirex Settlement Demo — Phase 2.5
 *
 * Demonstrates the full settlement flow for XLM, USDC, and EURC on Stellar
 * Testnet. This example uses the **non-custodial pattern**: wallets sign
 * transactions client-side and no private keys are transmitted to any server.
 *
 * Flow per settlement:
 *   1. Validate source account exists on-chain
 *   2. Validate destination account exists on-chain
 *   3. Check / establish trustline (non-native assets only)
 *   4. Build, sign, and submit the payment transaction
 *   5. Confirm ledger inclusion
 *
 * Prerequisites:
 *   - Node.js 18+
 *   - pnpm install
 *
 * Run:
 *   npx ts-node examples/wirex-settlement.ts
 */

import { WirexSDK } from '../src';
import { SettlementResult } from '../src/types/reference.types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function printResult(label: string, result: SettlementResult): void {
  console.log(`\n=== ${label} ===`);
  console.log(`Success: ${result.successful}`);
  if (result.transaction) {
    console.log(`Tx hash: ${result.transaction.hash}`);
    console.log(`Ledger:  ${result.transaction.ledger}`);
  }
  console.log('Steps:');
  for (const step of result.steps) {
    const detail = step.hash ? ` (${step.hash.slice(0, 8)}…)` : '';
    const timing = step.durationMs != null ? ` [${step.durationMs}ms]` : '';
    const err = step.error ? ` — ${step.error}` : '';
    console.log(`  ${step.name}: ${step.status}${detail}${timing}${err}`);
  }
  console.log(`Total: ${result.totalDurationMs}ms`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const sdk = new WirexSDK({ network: 'testnet', logging: { level: 'info' } });

  const TESTNET_ASSET_ISSUER =
    'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

  // ─── 1. Create & Fund Wallets ─────────────────────────────────────────

  console.log('=== Creating wallets ===');
  const alice = sdk.wallet.create();
  const bob = sdk.wallet.create();
  console.log(`Alice: ${alice.publicKey}`);
  console.log(`Bob:   ${bob.publicKey}`);

  console.log('\n=== Funding wallets via Friendbot ===');
  await sdk.stellar.fundTestAccount(alice.publicKey);
  await sdk.stellar.fundTestAccount(bob.publicKey);
  console.log('Both accounts funded on testnet.');

  // ─── 2. XLM Settlement (Phase 2.5.2) ─────────────────────────────────

  const xlmResult = await sdk.reference.createSettlement(
    {
      asset: 'XLM',
      amount: '100',
      destination: bob.publicKey,
      memo: { type: 'text', value: 'xlm-settlement-001' },
    },
    alice,
  );
  printResult('XLM Settlement: 100 XLM Alice → Bob', xlmResult);

  // ─── 3. USDC Settlement (Phase 2.5.3) ────────────────────────────────

  console.log('\n=== Adding USDC trustlines ===');
  await sdk.stellar.changeTrust(
    { sourceAccount: alice.publicKey, asset: { code: 'USDC', issuer: TESTNET_ASSET_ISSUER } },
    alice,
  );
  await sdk.stellar.changeTrust(
    { sourceAccount: bob.publicKey, asset: { code: 'USDC', issuer: TESTNET_ASSET_ISSUER } },
    bob,
  );
  console.log('USDC trustlines established for Alice and Bob.');

  // Note: On testnet the accounts will not have USDC balance unless funded
  // from a testnet issuer. The settlement flow still demonstrates the full
  // orchestration (validate → trustline check → build → sign → submit → confirm).

  const usdcResult = await sdk.reference.createSettlement(
    {
      asset: 'USDC',
      amount: '25.50',
      destination: bob.publicKey,
      memo: { type: 'text', value: 'usdc-settlement-002' },
    },
    alice,
  );
  printResult('USDC Settlement: 25.50 USDC Alice → Bob', usdcResult);

  // ─── 4. EURC Settlement (Phase 2.5.4) ────────────────────────────────

  console.log('\n=== Adding EURC trustlines ===');
  await sdk.stellar.changeTrust(
    { sourceAccount: alice.publicKey, asset: { code: 'EURC', issuer: TESTNET_ASSET_ISSUER } },
    alice,
  );
  await sdk.stellar.changeTrust(
    { sourceAccount: bob.publicKey, asset: { code: 'EURC', issuer: TESTNET_ASSET_ISSUER } },
    bob,
  );
  console.log('EURC trustlines established for Alice and Bob.');

  const eurcResult = await sdk.reference.createSettlement(
    {
      asset: 'EURC',
      amount: '50.00',
      destination: bob.publicKey,
      memo: { type: 'text', value: 'eurc-settlement-003' },
    },
    alice,
  );
  printResult('EURC Settlement: 50.00 EURC Alice → Bob', eurcResult);

  // ─── 5. Verify Final Balances ─────────────────────────────────────────

  console.log('\n=== Final Balances ===');
  const aliceBalances = await sdk.stellar.getBalances(alice.publicKey);
  const bobBalances = await sdk.stellar.getBalances(bob.publicKey);
  console.log('Alice:', aliceBalances.map((b) => `${b.code}: ${b.balance}`).join(', '));
  console.log('Bob:  ', bobBalances.map((b) => `${b.code}: ${b.balance}`).join(', '));

  // ─── Summary ──────────────────────────────────────────────────────────

  console.log('\n=== Settlement Summary ===');
  console.log(`XLM:  ${xlmResult.successful ? 'SUCCESS' : 'FAILED'}`);
  console.log(`USDC: ${usdcResult.successful ? 'SUCCESS' : 'FAILED'}`);
  console.log(`EURC: ${eurcResult.successful ? 'SUCCESS' : 'FAILED'}`);
}

main().catch((err) => {
  console.error('Settlement demo failed:', err);
  process.exit(1);
});
