import {
  Account,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import nacl from 'tweetnacl';

import { WalletError, WalletErrorCode } from '../errors/WalletError';
import { Balance, EncryptedWalletExport, ManagedWallet } from '../types/wallet.types';

/**
 * Keypair-based wallet that holds a Stellar secret key in memory.
 * Supports signing transactions and querying balances via a Horizon URL.
 */
export class KeypairWallet implements ManagedWallet {
  private readonly keypair: Keypair;
  private readonly horizonUrl: string;

  constructor(keypair: Keypair, horizonUrl: string) {
    this.keypair = keypair;
    this.horizonUrl = horizonUrl;
  }

  /** Create a new random wallet. */
  static create(horizonUrl: string): KeypairWallet {
    return new KeypairWallet(Keypair.random(), horizonUrl);
  }

  /** Import a wallet from a Stellar secret key (S...). */
  static fromSecret(secret: string, horizonUrl: string): KeypairWallet {
    try {
      const keypair = Keypair.fromSecret(secret);
      return new KeypairWallet(keypair, horizonUrl);
    } catch {
      throw new WalletError(
        'Invalid secret key',
        WalletErrorCode.INVALID_SECRET_KEY,
        { secret: `${secret.substring(0, 4)}...` },
      );
    }
  }

  /** Import a wallet from an encrypted export (produced by exportEncrypted). */
  static fromEncrypted(encryptedJson: string, password: string, horizonUrl: string): KeypairWallet {
    try {
      const payload = JSON.parse(encryptedJson) as EncryptedWalletExport;
      const salt = Buffer.from(payload.salt, 'base64');
      const nonce = Buffer.from(payload.nonce, 'base64');
      const ciphertext = Buffer.from(payload.ciphertext, 'base64');

      const passBytes = new TextEncoder().encode(password);
      const combined = new Uint8Array(passBytes.length + salt.length);
      combined.set(passBytes);
      combined.set(salt, passBytes.length);
      const key = nacl.hash(combined).slice(0, nacl.secretbox.keyLength);

      const decrypted = nacl.secretbox.open(ciphertext, nonce, key);
      if (!decrypted) {
        throw new WalletError(
          'Decryption failed — wrong password or corrupted data',
          WalletErrorCode.INVALID_SECRET_KEY,
        );
      }

      const secret = new TextDecoder().decode(decrypted);
      return KeypairWallet.fromSecret(secret, horizonUrl);
    } catch (error) {
      if (error instanceof WalletError) throw error;
      throw new WalletError(
        'Failed to decrypt wallet export',
        WalletErrorCode.INVALID_SECRET_KEY,
        { error: String(error) },
      );
    }
  }

  get publicKey(): string {
    return this.keypair.publicKey();
  }

  exportSecret(): string {
    return this.keypair.secret();
  }

  async sign(transactionXDR: string, networkPassphrase: string): Promise<string> {
    try {
      const tx = TransactionBuilder.fromXDR(transactionXDR, networkPassphrase);
      tx.sign(this.keypair);
      return tx.toXDR();
    } catch (error) {
      throw new WalletError(
        'Failed to sign transaction',
        WalletErrorCode.SIGNING_FAILED,
        { publicKey: this.publicKey, error: String(error) },
      );
    }
  }

  exportEncrypted(password: string): string {
    try {
      const salt = nacl.randomBytes(16);
      const key = this.deriveKey(password, salt);
      const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
      const secretBytes = new TextEncoder().encode(this.keypair.secret());
      const ciphertext = nacl.secretbox(secretBytes, nonce, key);

      if (!ciphertext) {
        throw new Error('Encryption failed');
      }

      const payload: EncryptedWalletExport = {
        version: 1,
        publicKey: this.keypair.publicKey(),
        ciphertext: Buffer.from(ciphertext).toString('base64'),
        nonce: Buffer.from(nonce).toString('base64'),
        salt: Buffer.from(salt).toString('base64'),
      };

      return JSON.stringify(payload);
    } catch (error) {
      if (error instanceof WalletError) throw error;
      throw new WalletError(
        'Failed to export encrypted wallet',
        WalletErrorCode.EXPORT_FAILED,
        { error: String(error) },
      );
    }
  }

  async addSigner(signerPublicKey: string, weight: number): Promise<string> {
    try {
      const response = await fetch(`${this.horizonUrl}/accounts/${this.publicKey}`);
      if (!response.ok) {
        throw new WalletError(
          `Account not found: ${this.publicKey}`,
          WalletErrorCode.ACCOUNT_NOT_FOUND,
          { publicKey: this.publicKey },
        );
      }
      const data = await response.json();
      const account = new Account(this.publicKey, data.sequence as string);

      const networkPassphrase = this.horizonUrl.includes('testnet')
        ? Networks.TESTNET
        : Networks.PUBLIC;

      const tx = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase,
      })
        .addOperation(
          Operation.setOptions({
            signer: {
              ed25519PublicKey: signerPublicKey,
              weight,
            },
          }),
        )
        .setTimeout(30)
        .build();

      tx.sign(this.keypair);
      return tx.toXDR();
    } catch (error) {
      if (error instanceof WalletError) throw error;
      throw new WalletError(
        'Failed to add signer',
        WalletErrorCode.SIGNING_FAILED,
        { signerPublicKey, weight, error: String(error) },
      );
    }
  }

  /**
   * Derive an encryption key from a password and salt using PBKDF2-like stretching via SHA-512.
   */
  private deriveKey(password: string, salt: Uint8Array): Uint8Array {
    const passBytes = new TextEncoder().encode(password);
    const combined = new Uint8Array(passBytes.length + salt.length);
    combined.set(passBytes);
    combined.set(salt, passBytes.length);
    return nacl.hash(combined).slice(0, nacl.secretbox.keyLength);
  }

  async getBalances(): Promise<Balance[]> {
    try {
      const response = await fetch(`${this.horizonUrl}/accounts/${this.publicKey}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new WalletError(
            `Account not found: ${this.publicKey}`,
            WalletErrorCode.ACCOUNT_NOT_FOUND,
            { publicKey: this.publicKey },
          );
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      return (data.balances as Array<Record<string, string>>).map((b) => ({
        asset: b.asset_type === 'native' ? 'native' : `${b.asset_code}:${b.asset_issuer}`,
        code: b.asset_type === 'native' ? 'XLM' : b.asset_code,
        issuer: b.asset_type === 'native' ? undefined : b.asset_issuer,
        balance: b.balance,
      }));
    } catch (error) {
      if (error instanceof WalletError) throw error;
      throw new WalletError(
        'Failed to fetch balances',
        WalletErrorCode.ACCOUNT_NOT_FOUND,
        { publicKey: this.publicKey, error: String(error) },
      );
    }
  }
}
