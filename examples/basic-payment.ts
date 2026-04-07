/**
 * Basic Payment Example — XLM transfer on Stellar Testnet
 *
 * Demonstrates:
 * - SDK initialization with testnet config
 * - Wallet creation
 * - Funding via Friendbot
 * - Building, signing, and submitting a payment transaction
 * - Tracking transaction confirmation
 *
 * Run: npx ts-node examples/basic-payment.ts
 */

import { WirexSDK } from '../src';

async function fundTestAccount(publicKey: string): Promise<void> {
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
  );
  if (!response.ok) {
    throw new Error(`Friendbot failed: ${response.status}`);
  }
  console.log(`Funded account: ${publicKey}`);
}

async function main() {
  // 1. Initialize the SDK for testnet
  const sdk = new WirexSDK({
    network: 'testnet',
    logging: { level: 'info' },
  });

  // 2. Create sender and receiver wallets
  const sender = sdk.wallet.create();
  const receiver = sdk.wallet.create();

  console.log('Sender:', sender.publicKey);
  console.log('Receiver:', receiver.publicKey);

  // 3. Fund both accounts via Friendbot
  await fundTestAccount(sender.publicKey);
  await fundTestAccount(receiver.publicKey);

  // 4. Estimate fees
  const fees = await sdk.estimateFees(1);
  console.log('Estimated fee:', fees.estimatedFee, 'stroops');

  // 5. Build, sign, and submit a 25 XLM payment
  const result = await sdk
    .transaction({ sourceAccount: sender.publicKey })
    .addPayment({
      destination: receiver.publicKey,
      asset: { code: 'XLM' },
      amount: '25',
    })
    .addMemo({ type: 'text', value: 'Hello from Wirex SDK!' })
    .build()
    .then((tx) => tx.sign(sender))
    .then((tx) => tx.submit());

  console.log('Transaction submitted!');
  console.log('  Hash:', result.hash);
  console.log('  Ledger:', result.ledger);
  console.log('  Successful:', result.successful);

  // 6. Track confirmation
  const confirmation = await sdk.trackTransaction(result.hash);
  console.log('Confirmation status:', confirmation.status);
  console.log('Confirmed at ledger:', confirmation.ledger);

  // 7. Check receiver balance
  const balances = await receiver.getBalances();
  console.log('Receiver balances:', balances);
}

main().catch(console.error);
