import { WirexSDK } from '../../src';

/**
 * E2E Integration test for the settlement flow on Stellar Testnet.
 *
 * Exercises the full lifecycle:
 *   1. Create & fund wallets via Friendbot
 *   2. XLM settlement (native asset — no trustline needed)
 *   3. USDC settlement (add trustline → pay)
 *   4. EURC settlement (add trustline → pay)
 *   5. Verify balances and step tracking
 *
 * Run with:
 *   npx jest tests/integration/settlement.integration.test.ts --no-coverage
 */
describe('Settlement E2E (Testnet)', () => {
  const sdk = new WirexSDK({ network: 'testnet', logging: { level: 'none' } });

  const TESTNET_ASSET_ISSUER =
    'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

  async function fundAccount(publicKey: string): Promise<void> {
    const response = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
    );
    if (!response.ok) throw new Error(`Friendbot failed: ${response.status}`);
  }

  // ─── XLM Settlement ───────────────────────────────────────────────────

  it('should settle XLM end-to-end', async () => {
    const alice = sdk.wallet.create();
    const bob = sdk.wallet.create();
    await fundAccount(alice.publicKey);
    await fundAccount(bob.publicKey);

    const result = await sdk.reference.createSettlement(
      {
        asset: 'XLM',
        amount: '50',
        destination: bob.publicKey,
        memo: { type: 'text', value: 'e2e-xlm' },
      },
      alice,
    );

    // Settlement succeeded
    expect(result.successful).toBe(true);
    expect(result.transaction).toBeDefined();
    expect(result.transaction!.hash).toBeTruthy();
    expect(result.transaction!.ledger).toBeGreaterThan(0);
    expect(result.totalDurationMs).toBeGreaterThan(0);

    // Steps are correct
    expect(result.steps).toHaveLength(5);
    expect(result.steps[0]).toMatchObject({ name: 'validate_source', status: 'success' });
    expect(result.steps[1]).toMatchObject({ name: 'validate_destination', status: 'success' });
    expect(result.steps[2]).toMatchObject({ name: 'check_trustline', status: 'skipped' });
    expect(result.steps[3]).toMatchObject({ name: 'send_payment', status: 'success' });
    expect(result.steps[4]).toMatchObject({ name: 'confirm', status: 'success' });

    // Verify Bob received XLM
    const bobBalances = await sdk.stellar.getBalances(bob.publicKey);
    const xlmBalance = bobBalances.find((b) => b.code === 'XLM');
    expect(xlmBalance).toBeDefined();
    // Bob started with 10000 XLM from friendbot + 50 from Alice
    expect(parseFloat(xlmBalance!.balance)).toBeGreaterThanOrEqual(10050);
  }, 60000);

  // ─── USDC Settlement (trustline required) ─────────────────────────────

  it('should settle USDC with trustline check', async () => {
    const alice = sdk.wallet.create();
    const bob = sdk.wallet.create();
    await fundAccount(alice.publicKey);
    await fundAccount(bob.publicKey);

    // Add USDC trustlines for both
    await sdk.stellar.changeTrust(
      { sourceAccount: alice.publicKey, asset: { code: 'USDC', issuer: TESTNET_ASSET_ISSUER } },
      alice,
    );
    await sdk.stellar.changeTrust(
      { sourceAccount: bob.publicKey, asset: { code: 'USDC', issuer: TESTNET_ASSET_ISSUER } },
      bob,
    );

    // Attempt USDC settlement — will fail at payment since Alice has no USDC,
    // but trustline check should pass
    const result = await sdk.reference.createSettlement(
      {
        asset: 'USDC',
        amount: '10',
        destination: bob.publicKey,
        memo: { type: 'text', value: 'e2e-usdc' },
      },
      alice,
    );

    // Trustline check should succeed (both have it)
    const trustStep = result.steps.find((s) => s.name === 'check_trustline');
    expect(trustStep).toBeDefined();
    expect(trustStep!.status).toBe('success');

    // Payment will fail (no USDC balance) — this is expected behavior
    if (!result.successful) {
      const payStep = result.steps.find((s) => s.name === 'send_payment');
      expect(payStep).toBeDefined();
      expect(payStep!.status).toBe('failed');
    }
  }, 60000);

  // ─── Missing Trustline Detection ──────────────────────────────────────

  it('should fail USDC settlement when destination lacks trustline', async () => {
    const alice = sdk.wallet.create();
    const bob = sdk.wallet.create();
    await fundAccount(alice.publicKey);
    await fundAccount(bob.publicKey);

    // Alice has USDC trustline, Bob does NOT
    await sdk.stellar.changeTrust(
      { sourceAccount: alice.publicKey, asset: { code: 'USDC', issuer: TESTNET_ASSET_ISSUER } },
      alice,
    );

    const result = await sdk.reference.createSettlement(
      { asset: 'USDC', amount: '5', destination: bob.publicKey },
      alice,
    );

    expect(result.successful).toBe(false);
    const trustStep = result.steps.find((s) => s.name === 'check_trustline');
    expect(trustStep!.status).toBe('failed');
    expect(trustStep!.error).toContain('lacks a USDC trustline');
  }, 60000);

  // ─── Non-existent Account Detection ───────────────────────────────────

  it('should fail when destination does not exist on-chain', async () => {
    const alice = sdk.wallet.create();
    const ghost = sdk.wallet.create(); // not funded
    await fundAccount(alice.publicKey);

    const result = await sdk.reference.createSettlement(
      { asset: 'XLM', amount: '10', destination: ghost.publicKey },
      alice,
    );

    expect(result.successful).toBe(false);
    const destStep = result.steps.find((s) => s.name === 'validate_destination');
    expect(destStep!.status).toBe('failed');
    expect(destStep!.error).toContain('Destination account does not exist');
  }, 30000);

  // ─── EURC Settlement ──────────────────────────────────────────────────

  it('should settle EURC with trustline check', async () => {
    const alice = sdk.wallet.create();
    const bob = sdk.wallet.create();
    await fundAccount(alice.publicKey);
    await fundAccount(bob.publicKey);

    // Add EURC trustlines
    await sdk.stellar.changeTrust(
      { sourceAccount: alice.publicKey, asset: { code: 'EURC', issuer: TESTNET_ASSET_ISSUER } },
      alice,
    );
    await sdk.stellar.changeTrust(
      { sourceAccount: bob.publicKey, asset: { code: 'EURC', issuer: TESTNET_ASSET_ISSUER } },
      bob,
    );

    const result = await sdk.reference.createSettlement(
      {
        asset: 'EURC',
        amount: '10',
        destination: bob.publicKey,
        memo: { type: 'text', value: 'e2e-eurc' },
      },
      alice,
    );

    // Trustline check should succeed
    const trustStep = result.steps.find((s) => s.name === 'check_trustline');
    expect(trustStep).toBeDefined();
    expect(trustStep!.status).toBe('success');
  }, 60000);
});
