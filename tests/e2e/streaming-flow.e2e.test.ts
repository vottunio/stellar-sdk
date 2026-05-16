/**
 * E2E: Streaming Flow (Phase 3.2.5)
 *
 * Exercises the canonical real-time event flow exactly as the plan specifies:
 *
 *   subscribe → trigger tx → receive event
 *
 * Uses Horizon SSE streaming via `sdk.stellar.stream.*`. SSE works in every
 * runtime (Node 18+, browsers, React Native) — no WebSocket polyfill required.
 *
 * Test strategy:
 *   1. Create + fund two accounts (Alice, Bob)
 *   2. Subscribe Alice's transactions stream BEFORE sending any tx
 *   3. Send a payment from Alice → Bob
 *   4. Wait for the stream to surface the new tx
 *   5. Verify hash + ledger match the submitted tx
 *
 * Run with: pnpm jest tests/e2e/streaming-flow --testTimeout=120000
 */
import {
  buildMainnetReadySDK,
  fundTestnetAccount,
} from '../integration/helpers/mainnetLikeConfig';

describe('E2E: Streaming Flow (3.2.5)', () => {
  const sdk = buildMainnetReadySDK();

  it('should subscribe → trigger tx → receive event', async () => {
    // ─── Setup: create + fund Alice and Bob ─────────────────────────────
    const alice = sdk.wallet.create();
    const bob = sdk.wallet.create();
    await fundTestnetAccount(alice.publicKey);
    await fundTestnetAccount(bob.publicKey);

    // ─── Step 1: Subscribe to Alice's tx stream BEFORE sending ──────────
    // Horizon's TransactionRecord exposes `ledger` as a HAL link (callable)
    // and `ledger_attr` as the numeric value. We extract what we need.
    interface StreamTx { hash: string; ledger_attr: number; successful: boolean }
    const received: StreamTx[] = [];
    const close = sdk.stellar.stream.transactions(alice.publicKey, (tx) => {
      received.push(tx as unknown as StreamTx);
    });

    // Give the SSE connection a moment to establish
    await new Promise((r) => setTimeout(r, 2_000));

    try {
      // ─── Step 2: Send a payment that the stream should pick up ────────
      const payResult = await sdk.stellar.sendPayment(
        {
          sourceAccount: alice.publicKey,
          destination: bob.publicKey,
          asset: { code: 'XLM' },
          amount: '3',
          memo: { type: 'text', value: 'e2e-stream' },
        },
        alice,
      );

      expect(payResult.successful).toBe(true);
      expect(payResult.hash).toMatch(/^[0-9a-f]{64}$/);

      // ─── Step 3: Wait for the stream to deliver the event ─────────────
      // Poll up to ~30s for the new tx to appear in the stream.
      const deadline = Date.now() + 30_000;
      let found: StreamTx | undefined;
      while (Date.now() < deadline) {
        found = received.find((t) => t.hash === payResult.hash);
        if (found) break;
        await new Promise((r) => setTimeout(r, 500));
      }

      expect(found).toBeDefined();
      expect(found!.successful).toBe(true);
      expect(found!.ledger_attr).toBe(payResult.ledger);
    } finally {
      // Always close the stream to free the SSE connection
      close();
    }
  }, 120_000);

  it('should manage cursors via the public API', async () => {
    // Verify the cursor API surface is callable end-to-end. Cursors are
    // keyed by a single string (e.g. `transactions:G…`), not by separate
    // stream type + account args.
    const key = `transactions:${sdk.wallet.create().publicKey}`;

    // Initially undefined
    expect(sdk.stellar.stream.getCursor(key)).toBeUndefined();

    // Set + read back
    sdk.stellar.stream.setCursor(key, 'cursor-value');
    expect(sdk.stellar.stream.getCursor(key)).toBe('cursor-value');

    // Clear all
    sdk.stellar.stream.clearCursors();
    expect(sdk.stellar.stream.getCursor(key)).toBeUndefined();
  });
});
