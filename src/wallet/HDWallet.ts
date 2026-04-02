import { Keypair } from '@stellar/stellar-sdk';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';

import { WalletError, WalletErrorCode } from '../errors/WalletError';
import { HDWalletInterface, ManagedWallet } from '../types/wallet.types';

import { KeypairWallet } from './KeypairWallet';

const STELLAR_BIP44_PATH = "m/44'/148'";

/**
 * HD wallet that derives Stellar accounts from a BIP39 mnemonic.
 * Uses BIP44 path m/44'/148'/{index}' for derivation.
 */
export class HDWallet implements HDWalletInterface {
  private readonly mnemonic: string;
  private readonly seed: Buffer;
  private readonly primaryWallet: KeypairWallet;
  private readonly horizonUrl: string;

  constructor(mnemonic: string, horizonUrl: string, index = 0) {
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new WalletError(
        'Invalid mnemonic phrase',
        WalletErrorCode.INVALID_MNEMONIC,
      );
    }

    this.mnemonic = mnemonic;
    this.horizonUrl = horizonUrl;
    this.seed = bip39.mnemonicToSeedSync(mnemonic);
    this.primaryWallet = this.deriveWallet(index);
  }

  /** Generate a new HD wallet with a random 24-word mnemonic. */
  static generate(horizonUrl: string): HDWallet {
    const mnemonic = bip39.generateMnemonic(256);
    return new HDWallet(mnemonic, horizonUrl);
  }

  /** Import an HD wallet from an existing mnemonic. */
  static fromMnemonic(mnemonic: string, horizonUrl: string, index = 0): HDWallet {
    return new HDWallet(mnemonic, horizonUrl, index);
  }

  get publicKey(): string {
    return this.primaryWallet.publicKey;
  }

  async sign(transactionXDR: string, networkPassphrase: string): Promise<string> {
    return this.primaryWallet.sign(transactionXDR, networkPassphrase);
  }

  async getBalances() {
    return this.primaryWallet.getBalances();
  }

  deriveAccount(index: number): ManagedWallet {
    if (index < 0 || !Number.isInteger(index)) {
      throw new WalletError(
        `Invalid derivation index: ${index}`,
        WalletErrorCode.INVALID_DERIVATION_PATH,
        { index },
      );
    }
    return this.deriveWallet(index);
  }

  exportMnemonic(): string {
    return this.mnemonic;
  }

  private deriveWallet(index: number): KeypairWallet {
    const path = `${STELLAR_BIP44_PATH}/${index}'`;
    const { key } = derivePath(path, this.seed.toString('hex'));
    const keypair = Keypair.fromRawEd25519Seed(key);
    return new KeypairWallet(keypair, this.horizonUrl);
  }
}
