import { ResolvedConfig } from '../types/config.types';
import { ExternalWalletProvider, ManagedWallet, HDWalletInterface } from '../types/wallet.types';

import { ExternalWallet } from './ExternalWallet';
import { HDWallet } from './HDWallet';
import { KeypairWallet } from './KeypairWallet';

/**
 * High-level wallet manager — creates, imports, and connects wallets.
 * Accessed via `sdk.wallet`.
 */
export class WalletManager {
  private readonly config: ResolvedConfig;

  constructor(config: ResolvedConfig) {
    this.config = config;
  }

  /** Create a new random Stellar keypair wallet. */
  create(): ManagedWallet {
    return KeypairWallet.create(this.config.horizonUrl);
  }

  /** Import a wallet from a Stellar secret key (S...). */
  importFromSecret(secret: string): ManagedWallet {
    return KeypairWallet.fromSecret(secret, this.config.horizonUrl);
  }

  /** Import a wallet from a BIP39 mnemonic phrase. */
  importFromMnemonic(mnemonic: string, index = 0): ManagedWallet {
    const hd = HDWallet.fromMnemonic(mnemonic, this.config.horizonUrl, index);
    return hd.deriveAccount(index);
  }

  /** Create a new HD wallet (generates mnemonic if not provided). */
  createHD(mnemonic?: string): HDWalletInterface {
    if (mnemonic) {
      return HDWallet.fromMnemonic(mnemonic, this.config.horizonUrl);
    }
    return HDWallet.generate(this.config.horizonUrl);
  }

  /** Connect to an external browser wallet (Freighter or Lobstr). */
  connectExternal(provider: ExternalWalletProvider): ExternalWallet {
    return new ExternalWallet(provider, this.config.horizonUrl);
  }
}
