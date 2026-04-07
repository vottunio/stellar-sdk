/**
 * Testnet Demo — Acceptance proof for Tranche 1
 *
 * Executes a complete sequence of Stellar testnet transactions using the SDK:
 * 1. Create and fund wallets
 * 2. Create a new account via createAccount operation
 * 3. Send XLM payment
 * 4. Add manage data entry
 * 5. Multi-operation transaction
 * 6. Track transaction confirmation
 *
 * Run: npx ts-node examples/testnet-demo.ts
 */

import { WirexSDK } from '../src';
import { Keypair } from '@stellar/stellar-sdk';

async function fundTestAccount(publicKey: string): Promise<void> {
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
  );
  if (!response.ok) {
    throw new Error(`Friendbot failed for ${publicKey}: ${response.status}`);
  }
}

function printResult(label: string, result: { hash: string; ledger: number; successful: boolean }) {
  console.log(`\n${label}`);
  console.log(`  Hash:       ${result.hash}`);
  console.log(`  Ledger:     ${result.ledger}`);
  console.log(`  Successful: ${result.successful}`);
}

async function main() {
  console.log('=== @wirex/stellar-sdk — Testnet Demo ===\n');

  const sdk = new WirexSDK({
    network: 'testnet',
    logging: { level: 'info' },
  });

  // --- Step 1: Create wallets ---
  const alice = sdk.wallet.create();
  const bobKeypair = Keypair.random();

  console.log('Alice (source):', alice.publicKey);
  console.log('Bob (destination):', bobKeypair.publicKey());

  console.log('\nFunding Alice via Friendbot...');
  await fundTestAccount(alice.publicKey);
  console.log('Alice funded.');

  // --- Step 2: Create Bob's account on-chain ---
  const createResult = await sdk
    .transaction({ sourceAccount: alice.publicKey })
    .addCreateAccount({
      destination: bobKeypair.publicKey(),
      startingBalance: '50',
    })
    .addMemo({ type: 'text', value: 'demo:create-account' })
    .build()
    .then((tx) => tx.sign(alice))
    .then((tx) => tx.submit());

  printResult('Step 2 — Create Account', createResult);

  // --- Step 3: Send XLM payment ---
  const paymentResult = await sdk
    .transaction({ sourceAccount: alice.publicKey })
    .addPayment({
      destination: bobKeypair.publicKey(),
      asset: { code: 'XLM' },
      amount: '25.5',
    })
    .addMemo({ type: 'text', value: 'demo:payment' })
    .build()
    .then((tx) => tx.sign(alice))
    .then((tx) => tx.submit());

  printResult('Step 3 — XLM Payment', paymentResult);

  // --- Step 4: Manage Data ---
  const dataResult = await sdk
    .transaction({ sourceAccount: alice.publicKey })
    .addManageData({ name: 'wirex-sdk-demo', value: 'tranche-1-acceptance' })
    .addMemo({ type: 'text', value: 'demo:manage-data' })
    .build()
    .then((tx) => tx.sign(alice))
    .then((tx) => tx.submit());

  printResult('Step 4 — Manage Data', dataResult);

  // --- Step 5: Multi-operation transaction ---
  const multiResult = await sdk
    .transaction({ sourceAccount: alice.publicKey })
    .addPayment({
      destination: bobKeypair.publicKey(),
      asset: { code: 'XLM' },
      amount: '5',
    })
    .addManageData({ name: 'multi-op-test', value: 'true' })
    .addMemo({ type: 'text', value: 'demo:multi-op' })
    .build()
    .then((tx) => tx.sign(alice))
    .then((tx) => tx.submit());

  printResult('Step 5 — Multi-op Transaction', multiResult);

  // --- Step 6: Fee estimation ---
  const fees = await sdk.estimateFees(3);
  console.log('\nStep 6 — Fee Estimation (3 ops)');
  console.log(`  Base fee:      ${fees.baseFee} stroops`);
  console.log(`  Estimated fee: ${fees.estimatedFee} stroops`);
  console.log(`  Operations:    ${fees.operationCount}`);

  // --- Step 7: Transaction tracking ---
  console.log('\nStep 7 — Transaction Tracking');
  const confirmation = await sdk.trackTransaction(multiResult.hash);
  console.log(`  Hash:   ${confirmation.hash}`);
  console.log(`  Status: ${confirmation.status}`);
  console.log(`  Ledger: ${confirmation.ledger}`);

  // --- Step 8: Check balances ---
  const aliceBalances = await alice.getBalances();
  console.log('\nStep 8 — Alice Balances:', aliceBalances);

  console.log('\n=== Testnet Demo Complete — All transactions successful ===');
}

main().catch((error) => {
  console.error('\nDemo failed:', error);
  process.exit(1);
});
