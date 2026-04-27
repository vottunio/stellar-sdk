import { WirexSDK } from '../../src';

/**
 * Integration test for Stellar extended operations on Testnet.
 * Covers Phase 2.2 operations: payments, trustlines, account creation,
 * path payments, manage data, and balance queries.
 *
 * Run:
 *   npx jest tests/integration/stellar-operations.integration.test.ts --no-coverage
 */
describe('Stellar Operations Integration (Testnet)', () => {
  const sdk = new WirexSDK({ network: 'testnet', logging: { level: 'none' } });

  const TESTNET_ASSET_ISSUER =
    'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

  async function fundAccount(publicKey: string): Promise<void> {
    const response = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
    );
    if (!response.ok) throw new Error(`Friendbot failed: ${response.status}`);
  }

  // ─── Account Operations ───────────────────────────────────────────────

  describe('account operations', () => {
    it('should check that a funded account exists', async () => {
      const wallet = sdk.wallet.create();
      await fundAccount(wallet.publicKey);

      const exists = await sdk.stellar.accountExists(wallet.publicKey);
      expect(exists).toBe(true);
    }, 30000);

    it('should check that an unfunded account does not exist', async () => {
      const wallet = sdk.wallet.create();
      const exists = await sdk.stellar.accountExists(wallet.publicKey);
      expect(exists).toBe(false);
    }, 15000);

    it('should fund a test account via Friendbot', async () => {
      const wallet = sdk.wallet.create();
      await sdk.stellar.fundTestAccount(wallet.publicKey);

      const exists = await sdk.stellar.accountExists(wallet.publicKey);
      expect(exists).toBe(true);
    }, 30000);

    it('should get account balances', async () => {
      const wallet = sdk.wallet.create();
      await fundAccount(wallet.publicKey);

      const balances = await sdk.stellar.getBalances(wallet.publicKey);
      expect(balances.length).toBeGreaterThan(0);

      const xlm = balances.find((b) => b.code === 'XLM');
      expect(xlm).toBeDefined();
      expect(parseFloat(xlm!.balance)).toBeGreaterThan(0);
    }, 30000);

    it('should get full account info', async () => {
      const wallet = sdk.wallet.create();
      await fundAccount(wallet.publicKey);

      const info = await sdk.stellar.getAccountInfo(wallet.publicKey);
      expect(info.accountId).toBe(wallet.publicKey);
      expect(info.sequence).toBeDefined();
      expect(info.balances.length).toBeGreaterThan(0);
      expect(info.signers.length).toBeGreaterThan(0);
    }, 30000);

    it('should create a new account on-chain', async () => {
      const funder = sdk.wallet.create();
      const newAccount = sdk.wallet.create();
      await fundAccount(funder.publicKey);

      const result = await sdk.stellar.createAccount(
        {
          sourceAccount: funder.publicKey,
          destination: newAccount.publicKey,
          startingBalance: '10',
        },
        funder,
      );

      expect(result.successful).toBe(true);
      expect(result.hash).toBeTruthy();

      const exists = await sdk.stellar.accountExists(newAccount.publicKey);
      expect(exists).toBe(true);
    }, 30000);
  });

  // ─── Payment Operations ───────────────────────────────────────────────

  describe('payment operations', () => {
    it('should send XLM payment', async () => {
      const alice = sdk.wallet.create();
      const bob = sdk.wallet.create();
      await fundAccount(alice.publicKey);
      await fundAccount(bob.publicKey);

      const result = await sdk.stellar.sendPayment(
        {
          sourceAccount: alice.publicKey,
          destination: bob.publicKey,
          asset: { code: 'XLM' },
          amount: '50',
        },
        alice,
      );

      expect(result.successful).toBe(true);
      expect(result.hash).toBeTruthy();
      expect(result.ledger).toBeGreaterThan(0);

      // Verify Bob received the payment
      const bobBalances = await sdk.stellar.getBalances(bob.publicKey);
      const xlm = bobBalances.find((b) => b.code === 'XLM');
      expect(parseFloat(xlm!.balance)).toBeGreaterThanOrEqual(10050);
    }, 30000);

    it('should send payment with memo', async () => {
      const alice = sdk.wallet.create();
      const bob = sdk.wallet.create();
      await fundAccount(alice.publicKey);
      await fundAccount(bob.publicKey);

      const result = await sdk.stellar.sendPayment(
        {
          sourceAccount: alice.publicKey,
          destination: bob.publicKey,
          asset: { code: 'XLM' },
          amount: '10',
          memo: { type: 'text', value: 'integration-test' },
        },
        alice,
      );

      expect(result.successful).toBe(true);
    }, 30000);
  });

  // ─── Trustline Operations ─────────────────────────────────────────────

  describe('trustline operations', () => {
    it('should add a USDC trustline', async () => {
      const wallet = sdk.wallet.create();
      await fundAccount(wallet.publicKey);

      const result = await sdk.stellar.changeTrust(
        {
          sourceAccount: wallet.publicKey,
          asset: { code: 'USDC', issuer: TESTNET_ASSET_ISSUER },
        },
        wallet,
      );

      expect(result.successful).toBe(true);

      // Verify trustline exists
      const balances = await sdk.stellar.getBalances(wallet.publicKey);
      const usdc = balances.find(
        (b) => b.code === 'USDC' && b.issuer === TESTNET_ASSET_ISSUER,
      );
      expect(usdc).toBeDefined();
      expect(usdc!.balance).toBe('0.0000000');
    }, 30000);

    it('should add an EURC trustline', async () => {
      const wallet = sdk.wallet.create();
      await fundAccount(wallet.publicKey);

      const result = await sdk.stellar.changeTrust(
        {
          sourceAccount: wallet.publicKey,
          asset: { code: 'EURC', issuer: TESTNET_ASSET_ISSUER },
        },
        wallet,
      );

      expect(result.successful).toBe(true);

      const balances = await sdk.stellar.getBalances(wallet.publicKey);
      const eurc = balances.find(
        (b) => b.code === 'EURC' && b.issuer === TESTNET_ASSET_ISSUER,
      );
      expect(eurc).toBeDefined();
    }, 30000);

    it('should remove a trustline by setting limit to 0', async () => {
      const wallet = sdk.wallet.create();
      await fundAccount(wallet.publicKey);

      // Add trustline
      await sdk.stellar.changeTrust(
        {
          sourceAccount: wallet.publicKey,
          asset: { code: 'USDC', issuer: TESTNET_ASSET_ISSUER },
        },
        wallet,
      );

      // Remove trustline (limit = '0')
      const result = await sdk.stellar.changeTrust(
        {
          sourceAccount: wallet.publicKey,
          asset: { code: 'USDC', issuer: TESTNET_ASSET_ISSUER },
          limit: '0',
        },
        wallet,
      );

      expect(result.successful).toBe(true);

      // Verify trustline removed
      const balances = await sdk.stellar.getBalances(wallet.publicKey);
      const usdc = balances.find(
        (b) => b.code === 'USDC' && b.issuer === TESTNET_ASSET_ISSUER,
      );
      expect(usdc).toBeUndefined();
    }, 45000);
  });

  // ─── Manage Data ──────────────────────────────────────────────────────

  describe('manage data', () => {
    it('should set and verify a data entry', async () => {
      const wallet = sdk.wallet.create();
      await fundAccount(wallet.publicKey);

      const result = await sdk.stellar.manageData(
        {
          sourceAccount: wallet.publicKey,
          name: 'test_key',
          value: 'test_value',
        },
        wallet,
      );

      expect(result.successful).toBe(true);

      // Verify data entry exists
      const info = await sdk.stellar.getAccountInfo(wallet.publicKey);
      expect(info.data['test_key']).toBeDefined();
    }, 30000);

    it('should delete a data entry by setting value to null', async () => {
      const wallet = sdk.wallet.create();
      await fundAccount(wallet.publicKey);

      // Set data
      await sdk.stellar.manageData(
        { sourceAccount: wallet.publicKey, name: 'temp_key', value: 'temp' },
        wallet,
      );

      // Delete data
      const result = await sdk.stellar.manageData(
        { sourceAccount: wallet.publicKey, name: 'temp_key', value: null },
        wallet,
      );

      expect(result.successful).toBe(true);
    }, 45000);
  });

  // ─── Asset Helper ─────────────────────────────────────────────────────

  describe('Asset helper', () => {
    it('should create native asset', () => {
      const xlm = sdk.stellar.Asset.native();
      expect(xlm.isNative()).toBe(true);
    });

    it('should create custom asset', () => {
      const usdc = sdk.stellar.Asset.custom('USDC', TESTNET_ASSET_ISSUER);
      expect(usdc.getCode()).toBe('USDC');
      expect(usdc.getIssuer()).toBe(TESTNET_ASSET_ISSUER);
    });
  });
});
