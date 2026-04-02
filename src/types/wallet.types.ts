/**
 * Represents a Stellar asset balance.
 */
export interface Balance {
  asset: string;
  code: string;
  issuer?: string;
  balance: string;
}

/**
 * Core wallet interface — implemented by all wallet types.
 */
export interface Wallet {
  /** Stellar public key (G...) */
  readonly publicKey: string;

  /** Sign a Stellar transaction XDR and return the signed XDR */
  sign(transactionXDR: string, networkPassphrase: string): Promise<string>;

  /** Query balances for this wallet's account */
  getBalances(): Promise<Balance[]>;
}

/**
 * Keypair-based wallet that holds the secret key in memory.
 */
export interface ManagedWallet extends Wallet {
  /** Export the raw secret key (S...) */
  exportSecret(): string;

  /** Export the secret key encrypted with a password. Returns a JSON string. */
  exportEncrypted(password: string): string;

  /**
   * Build a signed transaction that adds a co-signer to this account.
   * Returns the signed transaction XDR ready for submission.
   */
  addSigner(signerPublicKey: string, weight: number): Promise<string>;
}

/**
 * Encrypted wallet export payload.
 */
export interface EncryptedWalletExport {
  version: 1;
  publicKey: string;
  ciphertext: string;
  nonce: string;
  salt: string;
}

/**
 * HD wallet that derives child accounts from a mnemonic.
 */
export interface HDWalletInterface extends Wallet {
  /** Derive a child account at the given index */
  deriveAccount(index: number): ManagedWallet;

  /** Export the mnemonic phrase */
  exportMnemonic(): string;
}

/**
 * External wallet (Freighter, Lobstr) — signing is delegated to the browser extension.
 */
export interface ExternalWalletInterface extends Wallet {
  /** Check if the wallet extension is available */
  isAvailable(): Promise<boolean>;

  /** Connect to the wallet extension and retrieve the public key */
  connect(): Promise<string>;
}

/**
 * Supported external wallet providers.
 */
export type ExternalWalletProvider = 'freighter' | 'lobstr';

/**
 * Options for wallet creation / import.
 */
export interface WalletImportOptions {
  /** Secret key (S...) for direct import */
  secretKey?: string;

  /** BIP39 mnemonic phrase */
  mnemonic?: string;

  /** HD derivation index (default 0) */
  index?: number;
}
