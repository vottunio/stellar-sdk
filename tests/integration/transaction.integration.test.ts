/**
 * Transaction Lifecycle Integration Tests
 *
 * These tests run against the Stellar testnet and require network access.
 * They exercise the full flow: create wallet → fund via Friendbot → build tx → sign → submit → confirm.
 *
 * Run with: pnpm jest tests/integration/transaction --testTimeout=60000
 */
import { Keypair } from '@stellar/stellar-sdk';

import { WirexSDK } from '../../src';
import { KeypairWallet } from '../../src/wallet/KeypairWallet';

// Fund a testnet account via Friendbot
async function fundTestAccount(publicKey: string): Promise<void> {
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
  );
  if (!response.ok) {
    throw new Error(`Friendbot failed: ${response.status} ${await response.text()}`);
  }
}

describe('Transaction Lifecycle Integration (Testnet)', () => {
  const sdk = new WirexSDK({ network: 'testnet' });

  let sourceWallet: KeypairWallet;
  let destKeypair: Keypair;

  beforeAll(async () => {
    // Create and fund the source account
    sourceWallet = sdk.wallet.create() as KeypairWallet;
    destKeypair = Keypair.random();

    await fundTestAccount(sourceWallet.publicKey);
  }, 30000);

  it('should create a new account on testnet via createAccount operation', async () => {
    const result = await sdk
      .transaction({ sourceAccount: sourceWallet.publicKey })
      .addCreateAccount({
        destination: destKeypair.publicKey(),
        startingBalance: '10',
      })
      .addMemo({ type: 'text', value: 'integration-test' })
      .build()
      .then((b) => b.sign(sourceWallet))
      .then((b) => b.submit());

    expect(result.successful).toBe(true);
    expect(result.hash).toBeDefined();
    expect(result.ledger).toBeGreaterThan(0);
  }, 30000);

  it('should send an XLM payment on testnet', async () => {
    const result = await sdk
      .transaction({ sourceAccount: sourceWallet.publicKey })
      .addPayment({
        destination: destKeypair.publicKey(),
        asset: { code: 'XLM' },
        amount: '1.5',
      })
      .addMemo({ type: 'text', value: 'payment-test' })
      .build()
      .then((b) => b.sign(sourceWallet))
      .then((b) => b.submit());

    expect(result.successful).toBe(true);
    expect(result.hash).toBeDefined();
  }, 30000);

  it('should track a submitted transaction to confirmation', async () => {
    const builder = sdk
      .transaction({ sourceAccount: sourceWallet.publicKey })
      .addPayment({
        destination: destKeypair.publicKey(),
        asset: { code: 'XLM' },
        amount: '0.5',
      });

    await builder.build();
    await builder.sign(sourceWallet);
    const result = await builder.submit();

    expect(result.successful).toBe(true);

    // Track the transaction
    const confirmation = await sdk.trackTransaction(result.hash);
    expect(confirmation.status).toBe('confirmed');
    expect(confirmation.ledger).toBeGreaterThan(0);
  }, 30000);

  it('should build a transaction with manage data operation', async () => {
    const result = await sdk
      .transaction({ sourceAccount: sourceWallet.publicKey })
      .addManageData({ name: 'sdk-test', value: 'hello-wirex' })
      .build()
      .then((b) => b.sign(sourceWallet))
      .then((b) => b.submit());

    expect(result.successful).toBe(true);
  }, 30000);

  it('should estimate fees before building', async () => {
    const estimate = await sdk.estimateFees(2);

    expect(Number(estimate.baseFee)).toBeGreaterThan(0);
    expect(estimate.operationCount).toBe(2);
    expect(Number(estimate.estimatedFee)).toBe(
      Number(estimate.baseFee) * 2,
    );
  }, 15000);

  it('should support multiple operations in a single transaction', async () => {
    const dest2 = Keypair.random();

    const result = await sdk
      .transaction({ sourceAccount: sourceWallet.publicKey })
      .addCreateAccount({
        destination: dest2.publicKey(),
        startingBalance: '5',
      })
      .addManageData({ name: 'multi-op', value: 'test' })
      .addMemo({ type: 'text', value: 'multi-op-test' })
      .build()
      .then((b) => b.sign(sourceWallet))
      .then((b) => b.submit());

    expect(result.successful).toBe(true);
  }, 30000);
});
