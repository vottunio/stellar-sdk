import { Keypair, TransactionBuilder, Networks, Account, Operation, Asset } from '@stellar/stellar-sdk';

import { KeypairWallet } from '../../../src/wallet/KeypairWallet';
import { WalletError } from '../../../src/errors/WalletError';

describe('KeypairWallet', () => {
  const horizonUrl = 'https://horizon-testnet.stellar.org';

  describe('create', () => {
    it('should create a wallet with a valid Stellar public key', () => {
      const wallet = KeypairWallet.create(horizonUrl);
      expect(wallet.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
    });

    it('should create unique wallets each time', () => {
      const w1 = KeypairWallet.create(horizonUrl);
      const w2 = KeypairWallet.create(horizonUrl);
      expect(w1.publicKey).not.toBe(w2.publicKey);
    });
  });

  describe('fromSecret', () => {
    it('should import a wallet from a valid secret key', () => {
      const keypair = Keypair.random();
      const wallet = KeypairWallet.fromSecret(keypair.secret(), horizonUrl);
      expect(wallet.publicKey).toBe(keypair.publicKey());
    });

    it('should throw WalletError on invalid secret key', () => {
      expect(() => KeypairWallet.fromSecret('INVALID', horizonUrl)).toThrow(WalletError);
    });
  });

  describe('exportSecret', () => {
    it('should return the secret key', () => {
      const keypair = Keypair.random();
      const wallet = KeypairWallet.fromSecret(keypair.secret(), horizonUrl);
      expect(wallet.exportSecret()).toBe(keypair.secret());
    });
  });

  describe('sign', () => {
    it('should sign a transaction XDR', async () => {
      const sourceKeypair = Keypair.random();
      const wallet = KeypairWallet.fromSecret(sourceKeypair.secret(), horizonUrl);

      const account = new Account(sourceKeypair.publicKey(), '100');
      const tx = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '10',
          }),
        )
        .setTimeout(30)
        .build();

      const unsignedXdr = tx.toXDR();
      const signedXdr = await wallet.sign(unsignedXdr, Networks.TESTNET);

      expect(signedXdr).toBeDefined();
      expect(signedXdr).not.toBe(unsignedXdr);

      // Verify the signed XDR can be parsed back
      const signedTx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
      expect(signedTx.signatures.length).toBe(1);
    });

    it('should throw WalletError on invalid XDR', async () => {
      const wallet = KeypairWallet.create(horizonUrl);
      await expect(wallet.sign('invalid-xdr', Networks.TESTNET)).rejects.toThrow(WalletError);
    });
  });

  describe('publicKey', () => {
    it('should return a G... formatted Stellar public key', () => {
      const wallet = KeypairWallet.create(horizonUrl);
      expect(wallet.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    });
  });

  describe('exportEncrypted / fromEncrypted (Task 1.2.10)', () => {
    it('should encrypt and decrypt a wallet with a password', () => {
      const wallet = KeypairWallet.create(horizonUrl);
      const originalSecret = wallet.exportSecret();
      const password = 'strong-password-123';

      const encrypted = wallet.exportEncrypted(password);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');

      // The encrypted output should be valid JSON
      const parsed = JSON.parse(encrypted);
      expect(parsed.version).toBe(1);
      expect(parsed.publicKey).toBe(wallet.publicKey);
      expect(parsed.ciphertext).toBeDefined();
      expect(parsed.nonce).toBeDefined();
      expect(parsed.salt).toBeDefined();

      // Decrypt and verify the secret key round-trips
      const restored = KeypairWallet.fromEncrypted(encrypted, password, horizonUrl);
      expect(restored.publicKey).toBe(wallet.publicKey);
      expect(restored.exportSecret()).toBe(originalSecret);
    });

    it('should fail decryption with wrong password', () => {
      const wallet = KeypairWallet.create(horizonUrl);
      const encrypted = wallet.exportEncrypted('correct-password');

      expect(() =>
        KeypairWallet.fromEncrypted(encrypted, 'wrong-password', horizonUrl),
      ).toThrow(WalletError);
    });

    it('should produce different ciphertexts for the same wallet (random salt/nonce)', () => {
      const wallet = KeypairWallet.create(horizonUrl);
      const enc1 = wallet.exportEncrypted('pass');
      const enc2 = wallet.exportEncrypted('pass');
      expect(enc1).not.toBe(enc2);
    });

    it('should throw on invalid encrypted JSON', () => {
      expect(() =>
        KeypairWallet.fromEncrypted('not-json', 'pass', horizonUrl),
      ).toThrow(WalletError);
    });
  });

  describe('getBalances', () => {
    it('should return balances for a funded account', async () => {
      const wallet = KeypairWallet.create(horizonUrl);
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          balances: [
            { asset_type: 'native', balance: '100.0000000' },
            { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GA5ZSE...', balance: '50.0000000' },
          ],
        }),
      }) as jest.Mock;

      try {
        const balances = await wallet.getBalances();
        expect(balances).toHaveLength(2);
        expect(balances[0]).toEqual({
          asset: 'native',
          code: 'XLM',
          issuer: undefined,
          balance: '100.0000000',
        });
        expect(balances[1]).toEqual({
          asset: 'USDC:GA5ZSE...',
          code: 'USDC',
          issuer: 'GA5ZSE...',
          balance: '50.0000000',
        });
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should throw WalletError for 404 (account not found)', async () => {
      const wallet = KeypairWallet.create(horizonUrl);
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as jest.Mock;

      try {
        await expect(wallet.getBalances()).rejects.toThrow(WalletError);
        await expect(wallet.getBalances()).rejects.toThrow(/not found/i);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should throw WalletError for non-404 HTTP errors', async () => {
      const wallet = KeypairWallet.create(horizonUrl);
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as jest.Mock;

      try {
        await expect(wallet.getBalances()).rejects.toThrow(WalletError);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should throw WalletError on network error', async () => {
      const wallet = KeypairWallet.create(horizonUrl);
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as jest.Mock;

      try {
        await expect(wallet.getBalances()).rejects.toThrow(WalletError);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('addSigner (Task 1.2.9)', () => {
    it('should build a signed setOptions transaction XDR', async () => {
      const wallet = KeypairWallet.create(horizonUrl);
      const signerKeypair = Keypair.random();

      // Mock the Horizon account fetch
      const mockAccount = {
        sequence: '100',
        id: wallet.publicKey,
      };
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAccount,
      }) as jest.Mock;

      try {
        const signedXdr = await wallet.addSigner(signerKeypair.publicKey(), 1);
        expect(signedXdr).toBeDefined();

        // Parse the XDR and verify it contains a setOptions operation
        const tx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
        expect(tx.operations.length).toBe(1);
        expect(tx.operations[0].type).toBe('setOptions');
        expect(tx.signatures.length).toBe(1);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should throw WalletError when account is not found', async () => {
      const wallet = KeypairWallet.create(horizonUrl);
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as jest.Mock;

      try {
        await expect(
          wallet.addSigner(Keypair.random().publicKey(), 1),
        ).rejects.toThrow(WalletError);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
