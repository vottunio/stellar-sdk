/**
 * Phase 2.2 Demo — Stellar Blockchain Interaction (Extended)
 *
 * Tests all Phase 2.2 features on the real Stellar testnet:
 * 1. Account existence check
 * 2. Friendbot funding
 * 3. Create account on-chain
 * 4. Send XLM payment via sdk.stellar
 * 5. Add/remove USDC trustline
 * 6. Manage data (set + delete)
 * 7. Get account info
 * 8. Asset wrapper
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' examples/phase-2.2-demo.ts
 */

import { WirexSDK } from '../src';

async function main() {
  console.log('=== Phase 2.2 — Stellar Extended Demo ===\n');

  const sdk = new WirexSDK({ network: 'testnet', logging: { level: 'info' } });

  // --- 1. Create wallets ---
  const alice = sdk.wallet.create();
  const bob = sdk.wallet.create();
  console.log('Alice:', alice.publicKey);
  console.log('Bob:  ', bob.publicKey);

  // --- 2. Account existence check (should be false) ---
  const existsBefore = await sdk.stellar.accountExists(alice.publicKey);
  console.log(`\n[2.2.1] Alice exists before funding: ${existsBefore}`);

  // --- 3. Fund via Friendbot ---
  console.log('\n[2.2.2] Funding Alice via Friendbot...');
  await sdk.stellar.fundTestAccount(alice.publicKey);
  console.log('Alice funded.');

  const existsAfter = await sdk.stellar.accountExists(alice.publicKey);
  console.log(`Alice exists after funding: ${existsAfter}`);

  // --- 4. Create Bob's account on-chain ---
  console.log('\n[2.2.4] Creating Bob\'s account on-chain...');
  const createResult = await sdk.stellar.createAccount(
    { sourceAccount: alice.publicKey, destination: bob.publicKey, startingBalance: '50' },
    alice,
  );
  console.log(`  Hash: ${createResult.hash}`);
  console.log(`  Ledger: ${createResult.ledger}`);
  console.log(`  Successful: ${createResult.successful}`);

  // --- 5. Send XLM payment ---
  console.log('\n[2.2.3] Sending 10 XLM from Alice to Bob...');
  const payResult = await sdk.stellar.sendPayment(
    {
      sourceAccount: alice.publicKey,
      destination: bob.publicKey,
      asset: { code: 'XLM' },
      amount: '10',
      memo: { type: 'text', value: 'phase-2.2-test' },
    },
    alice,
  );
  console.log(`  Hash: ${payResult.hash}`);
  console.log(`  Successful: ${payResult.successful}`);

  // --- 6. Add USDC trustline ---
  // Using a known testnet issuer
  const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
  console.log('\n[2.2.5] Adding USDC trustline for Bob...');
  const trustResult = await sdk.stellar.changeTrust(
    { sourceAccount: bob.publicKey, asset: { code: 'USDC', issuer: USDC_ISSUER } },
    bob,
  );
  console.log(`  Hash: ${trustResult.hash}`);
  console.log(`  Successful: ${trustResult.successful}`);

  // Remove the trustline
  console.log('Removing USDC trustline...');
  const removeTrust = await sdk.stellar.changeTrust(
    { sourceAccount: bob.publicKey, asset: { code: 'USDC', issuer: USDC_ISSUER }, limit: '0' },
    bob,
  );
  console.log(`  Hash: ${removeTrust.hash}`);
  console.log(`  Successful: ${removeTrust.successful}`);

  // --- 7. Manage data ---
  console.log('\n[2.2.11] Setting data entry on Alice...');
  const dataResult = await sdk.stellar.manageData(
    { sourceAccount: alice.publicKey, name: 'phase-2.2', value: 'completed' },
    alice,
  );
  console.log(`  Hash: ${dataResult.hash}`);
  console.log(`  Successful: ${dataResult.successful}`);

  // Delete the data entry
  console.log('Deleting data entry...');
  const deleteData = await sdk.stellar.manageData(
    { sourceAccount: alice.publicKey, name: 'phase-2.2', value: null },
    alice,
  );
  console.log(`  Hash: ${deleteData.hash}`);
  console.log(`  Successful: ${deleteData.successful}`);

  // --- 8. Get account info ---
  console.log('\n[2.2.1+] Getting Alice account info...');
  const info = await sdk.stellar.getAccountInfo(alice.publicKey);
  console.log(`  Account ID: ${info.accountId}`);
  console.log(`  Sequence: ${info.sequence}`);
  console.log(`  Signers: ${info.signers.length}`);
  console.log(`  Balances:`);
  for (const b of info.balances) {
    console.log(`    ${b.code}: ${b.balance}`);
  }

  // --- 9. Get balances (shortcut) ---
  console.log('\n[2.2.1+] Bob balances:');
  const bobBalances = await sdk.stellar.getBalances(bob.publicKey);
  for (const b of bobBalances) {
    console.log(`  ${b.code}: ${b.balance}`);
  }

  // --- 10. Asset wrapper ---
  console.log('\n[2.2.12] Asset wrapper:');
  const xlm = sdk.stellar.Asset.native();
  const usdc = sdk.stellar.Asset.custom('USDC', USDC_ISSUER);
  console.log(`  XLM native: ${xlm.isNative()}`);
  console.log(`  USDC code: ${usdc.getCode()}, issuer: ${usdc.getIssuer()}`);

  console.log('\n=== Phase 2.2 Demo Complete ===');
  console.log('All features verified on Stellar testnet.');
}

main().catch((error) => {
  console.error('\nDemo failed:', error);
  process.exit(1);
});
