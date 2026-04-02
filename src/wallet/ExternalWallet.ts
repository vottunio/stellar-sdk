import { WalletError, WalletErrorCode } from '../errors/WalletError';
import { Balance, ExternalWalletInterface, ExternalWalletProvider } from '../types/wallet.types';

/**
 * External wallet adapter for browser-based wallets (Freighter, Lobstr).
 * Delegates signing to the wallet extension; requires a browser environment.
 */
export class ExternalWallet implements ExternalWalletInterface {
  private connectedPublicKey: string | null = null;
  private readonly provider: ExternalWalletProvider;
  private readonly horizonUrl: string;

  constructor(provider: ExternalWalletProvider, horizonUrl: string) {
    this.provider = provider;
    this.horizonUrl = horizonUrl;
  }

  get publicKey(): string {
    if (!this.connectedPublicKey) {
      throw new WalletError(
        'External wallet not connected. Call connect() first.',
        WalletErrorCode.EXTERNAL_CONNECTION_FAILED,
      );
    }
    return this.connectedPublicKey;
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (this.provider === 'freighter') {
        return typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).freighter;
      }
      if (this.provider === 'lobstr') {
        return typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).lobstrSigner;
      }
      return false;
    } catch {
      return false;
    }
  }

  async connect(): Promise<string> {
    const available = await this.isAvailable();
    if (!available) {
      throw new WalletError(
        `${this.provider} wallet extension is not available`,
        WalletErrorCode.EXTERNAL_NOT_AVAILABLE,
        { provider: this.provider },
      );
    }

    try {
      if (this.provider === 'freighter') {
        const freighter = (window as unknown as Record<string, unknown>).freighter as {
          getPublicKey: () => Promise<string>;
        };
        this.connectedPublicKey = await freighter.getPublicKey();
      } else if (this.provider === 'lobstr') {
        const lobstr = (window as unknown as Record<string, unknown>).lobstrSigner as {
          getPublicKey: () => Promise<string>;
        };
        this.connectedPublicKey = await lobstr.getPublicKey();
      }

      if (!this.connectedPublicKey) {
        throw new Error('No public key returned');
      }

      return this.connectedPublicKey;
    } catch (error) {
      if (error instanceof WalletError) throw error;
      throw new WalletError(
        `Failed to connect to ${this.provider}`,
        WalletErrorCode.EXTERNAL_CONNECTION_FAILED,
        { provider: this.provider, error: String(error) },
      );
    }
  }

  async sign(transactionXDR: string, networkPassphrase: string): Promise<string> {
    if (!this.connectedPublicKey) {
      throw new WalletError(
        'External wallet not connected',
        WalletErrorCode.EXTERNAL_CONNECTION_FAILED,
      );
    }

    try {
      if (this.provider === 'freighter') {
        const freighter = (window as unknown as Record<string, unknown>).freighter as {
          signTransaction: (xdr: string, opts: { networkPassphrase: string }) => Promise<string>;
        };
        return await freighter.signTransaction(transactionXDR, { networkPassphrase });
      }

      if (this.provider === 'lobstr') {
        const lobstr = (window as unknown as Record<string, unknown>).lobstrSigner as {
          signTransaction: (xdr: string, opts: { networkPassphrase: string }) => Promise<string>;
        };
        return await lobstr.signTransaction(transactionXDR, { networkPassphrase });
      }

      throw new Error(`Unsupported provider: ${this.provider}`);
    } catch (error) {
      if (error instanceof WalletError) throw error;
      throw new WalletError(
        `Signing rejected by ${this.provider}`,
        WalletErrorCode.EXTERNAL_SIGNING_REJECTED,
        { provider: this.provider, error: String(error) },
      );
    }
  }

  async getBalances(): Promise<Balance[]> {
    const pubKey = this.publicKey;
    const response = await fetch(`${this.horizonUrl}/accounts/${pubKey}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new WalletError(
          `Account not found: ${pubKey}`,
          WalletErrorCode.ACCOUNT_NOT_FOUND,
          { publicKey: pubKey },
        );
      }
      throw new WalletError(
        'Failed to fetch balances',
        WalletErrorCode.ACCOUNT_NOT_FOUND,
        { publicKey: pubKey },
      );
    }
    const data = await response.json();
    return (data.balances as Array<Record<string, string>>).map((b) => ({
      asset: b.asset_type === 'native' ? 'native' : `${b.asset_code}:${b.asset_issuer}`,
      code: b.asset_type === 'native' ? 'XLM' : b.asset_code,
      issuer: b.asset_type === 'native' ? undefined : b.asset_issuer,
      balance: b.balance,
    }));
  }
}
