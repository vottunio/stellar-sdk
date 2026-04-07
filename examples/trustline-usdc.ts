/**
 * Trustline Example — Create USDC trustline on Stellar Testnet
 *
 * Demonstrates:
 * - SDK initialization
 * - Wallet creation and funding
 * - Adding a USDC trustline via changeTrust operation
 * - Querying balances to verify the trustline
 *
 * Run: npx ts-node examples/trustline-usdc.ts
 */

import { WirexSDK } from '../src';

// Circle's USDC issuer on Stellar mainnet (for testnet, use testnet issuer or a test asset)
const USDC_ISSUER_TESTNET = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

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
  // 1. Initialize SDK
  const sdk = new WirexSDK({
    network: 'testnet',
    logging: { level: 'info' },
  });

  // 2. Create and fund a wallet
  const wallet = sdk.wallet.create();
  console.log('Wallet public key:', wallet.publicKey);

  await fundTestAccount(wallet.publicKey);

  // 3. Check initial balances (only XLM)
  const beforeBalances = await wallet.getBalances();
  console.log('Balances before trustline:', beforeBalances);

  // 4. Add USDC trustline
  console.log('Adding USDC trustline...');
  const result = await sdk
    .transaction({ sourceAccount: wallet.publicKey })
    .changeTrust({
      asset: { code: 'USDC', issuer: USDC_ISSUER_TESTNET },
    })
    .addMemo({ type: 'text', value: 'Add USDC trustline' })
    .build()
    .then((tx) => tx.sign(wallet))
    .then((tx) => tx.submit());

  console.log('Trustline transaction submitted!');
  console.log('  Hash:', result.hash);
  console.log('  Ledger:', result.ledger);
  console.log('  Successful:', result.successful);

  // 5. Wait for confirmation
  const confirmation = await sdk.trackTransaction(result.hash);
  console.log('Status:', confirmation.status);

  // 6. Check balances after (should now include USDC with 0 balance)
  const afterBalances = await wallet.getBalances();
  console.log('Balances after trustline:', afterBalances);

  // 7. Optionally remove the trustline (set limit to 0)
  console.log('\nRemoving USDC trustline...');
  const removeResult = await sdk
    .transaction({ sourceAccount: wallet.publicKey })
    .changeTrust({
      asset: { code: 'USDC', issuer: USDC_ISSUER_TESTNET },
      limit: '0',
    })
    .build()
    .then((tx) => tx.sign(wallet))
    .then((tx) => tx.submit());

  console.log('Trustline removed!');
  console.log('  Hash:', removeResult.hash);
  console.log('  Successful:', removeResult.successful);

  const finalBalances = await wallet.getBalances();
  console.log('Final balances:', finalBalances);
}

main().catch(console.error);
