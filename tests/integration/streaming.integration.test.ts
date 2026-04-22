import { WirexSDK } from '../../src';
import { Keypair } from '@stellar/stellar-sdk';

/**
 * Integration test for Horizon SSE streaming.
 * Streams transactions for an account while sending a payment,
 * then verifies the stream captured the transaction.
 */
describe('Streaming Integration (Testnet)', () => {
  const sdk = new WirexSDK({ network: 'testnet', logging: { level: 'none' } });

  async function fundAccount(publicKey: string): Promise<void> {
    const response = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
    );
    if (!response.ok) throw new Error(`Friendbot failed: ${response.status}`);
  }

  it('should stream a transaction in real-time', async () => {
    // Create and fund accounts
    const alice = sdk.wallet.create();
    const bob = sdk.wallet.create();
    await fundAccount(alice.publicKey);
    await fundAccount(bob.publicKey);

    // Start streaming transactions for Alice
    const received: unknown[] = [];
    const close = sdk.stellar.stream.transactions(alice.publicKey, (tx) => {
      received.push(tx);
    });

    // Wait a moment for stream to establish
    await new Promise((r) => setTimeout(r, 2000));

    // Send a payment from Alice to Bob
    const result = await sdk.stellar.sendPayment(
      {
        sourceAccount: alice.publicKey,
        destination: bob.publicKey,
        asset: { code: 'XLM' },
        amount: '5',
      },
      alice,
    );
    expect(result.successful).toBe(true);

    // Wait for the stream to pick up the transaction
    await new Promise((r) => setTimeout(r, 5000));

    // Close the stream
    close();

    // Verify stream captured at least one transaction
    expect(received.length).toBeGreaterThanOrEqual(1);

    // Verify cursor was saved
    const cursor = sdk.stellar.stream.getCursor(`transactions:${alice.publicKey}`);
    expect(cursor).toBeDefined();
  }, 30000); // 30s timeout for testnet
});
