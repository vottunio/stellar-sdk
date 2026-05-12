/**
 * Wallet Integration Tests — runs against Stellar Testnet.
 *
 * These tests make real network calls to:
 * - Stellar Friendbot (to fund test accounts)
 * - Horizon Testnet (to query balances and account info)
 *
 * Run with: pnpm test -- --testPathPattern=integration
 *
 * NOTE: These tests are skipped by default in CI. To run them locally,
 * set the environment variable: RUN_INTEGRATION=true
 */
import { Keypair } from '@stellar/stellar-sdk';

import { ConfigManager } from '../../src/config/ConfigManager';
import { HDWallet } from '../../src/wallet/HDWallet';
import { KeypairWallet } from '../../src/wallet/KeypairWallet';
import { WalletManager } from '../../src/wallet/WalletManager';

const SHOULD_RUN = process.env.RUN_INTEGRATION === 'true';
const describeIntegration = SHOULD_RUN ? describe : describe.skip;

const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org';
const FRIENDBOT_URL = 'https://friendbot.stellar.org';

async function fundAccount(publicKey: string): Promise<void> {
  const response = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (!response.ok) {
    const text = await response.text();
    // Friendbot returns 400 if already funded — that's OK
    if (!text.includes('createAccountAlreadyExist')) {
      throw new Error(`Friendbot failed: ${response.status} ${text}`);
    }
  }
}

describeIntegration('Wallet Integration (Stellar Testnet)', () => {
  jest.setTimeout(30_000);

  describe('1.2.1 — Keypair creation + fund on testnet', () => {
    it('should create a wallet and fund it via Friendbot', async () => {
      const wallet = KeypairWallet.create(HORIZON_TESTNET);
      expect(wallet.publicKey).toMatch(/^G[A-Z2-7]{55}$/);

      await fundAccount(wallet.publicKey);

      const balances = await wallet.getBalances();
      expect(balances.length).toBeGreaterThan(0);

      const xlm = balances.find((b) => b.code === 'XLM');
      expect(xlm).toBeDefined();
      expect(parseFloat(xlm!.balance)).toBeGreaterThan(0);
    });
  });

  describe('1.2.2 — Import from secret + verify on testnet', () => {
    it('should import a wallet and query its balances after funding', async () => {
      const kp = Keypair.random();
      const wallet = KeypairWallet.fromSecret(kp.secret(), HORIZON_TESTNET);

      await fundAccount(wallet.publicKey);

      const balances = await wallet.getBalances();
      const xlm = balances.find((b) => b.code === 'XLM');
      expect(xlm).toBeDefined();
      expect(parseFloat(xlm!.balance)).toBeGreaterThan(0);
    });
  });

  describe('1.2.3 — Import from mnemonic', () => {
    it('should create a wallet from mnemonic and fund it', async () => {
      const config = new ConfigManager({ network: 'testnet' }).getConfig();
      const manager = new WalletManager(config);
      const hd = manager.createHD();
      const wallet = manager.importFromMnemonic(hd.exportMnemonic(), 0);

      await fundAccount(wallet.publicKey);

      const balances = await wallet.getBalances();
      expect(balances.find((b) => b.code === 'XLM')).toBeDefined();
    });
  });

  describe('1.2.4 — HD wallet derivation', () => {
    it('should derive multiple accounts and fund the first', async () => {
      const hd = HDWallet.generate(HORIZON_TESTNET);
      const account0 = hd.deriveAccount(0);
      const account1 = hd.deriveAccount(1);

      expect(account0.publicKey).not.toBe(account1.publicKey);

      await fundAccount(account0.publicKey);

      const balances = await account0.getBalances();
      expect(balances.length).toBeGreaterThan(0);
    });
  });

  describe('1.2.9 — Multisig: addSigner', () => {
    it('should add a signer to a funded account', async () => {
      const wallet = KeypairWallet.create(HORIZON_TESTNET);
      await fundAccount(wallet.publicKey);

      const signer = Keypair.random();
      const signedXdr = await wallet.addSigner(signer.publicKey(), 1);
      expect(signedXdr).toBeDefined();

      // Submit the transaction
      const response = await fetch(`${HORIZON_TESTNET}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `tx=${encodeURIComponent(signedXdr)}`,
      });
      const result = await response.json();
      expect(result.successful).toBe(true);

      // Verify the signer was added
      const accountResponse = await fetch(`${HORIZON_TESTNET}/accounts/${wallet.publicKey}`);
      const accountData = await accountResponse.json();
      const signers = accountData.signers as Array<{ key: string; weight: number }>;
      const addedSigner = signers.find((s) => s.key === signer.publicKey());
      expect(addedSigner).toBeDefined();
      expect(addedSigner!.weight).toBe(1);
    });
  });

  describe('1.2.11 — Balance query shortcut', () => {
    it('should return balances for a funded account', async () => {
      const wallet = KeypairWallet.create(HORIZON_TESTNET);
      await fundAccount(wallet.publicKey);

      const balances = await wallet.getBalances();
      expect(balances).toBeInstanceOf(Array);
      expect(balances.length).toBeGreaterThan(0);

      const xlm = balances.find((b) => b.code === 'XLM');
      expect(xlm).toBeDefined();
      expect(xlm!.asset).toBe('native');
      expect(xlm!.issuer).toBeUndefined();
    });
  });
});
