import { StellarError } from './StellarError';

export enum WalletErrorCode {
  INVALID_SECRET_KEY = 'WALLET_INVALID_SECRET_KEY',
  INVALID_MNEMONIC = 'WALLET_INVALID_MNEMONIC',
  INVALID_DERIVATION_PATH = 'WALLET_INVALID_DERIVATION_PATH',
  SIGNING_FAILED = 'WALLET_SIGNING_FAILED',
  EXTERNAL_NOT_AVAILABLE = 'WALLET_EXTERNAL_NOT_AVAILABLE',
  EXTERNAL_CONNECTION_FAILED = 'WALLET_EXTERNAL_CONNECTION_FAILED',
  EXTERNAL_SIGNING_REJECTED = 'WALLET_EXTERNAL_SIGNING_REJECTED',
  ACCOUNT_NOT_FOUND = 'WALLET_ACCOUNT_NOT_FOUND',
  EXPORT_FAILED = 'WALLET_EXPORT_FAILED',
}

/**
 * Error class for wallet-related operations.
 */
export class WalletError extends StellarError {
  constructor(
    message: string,
    code: WalletErrorCode,
    details?: Record<string, unknown>,
  ) {
    super(message, code, details);
    this.name = 'WalletError';
  }
}
