import { StellarError } from '../../../src/errors/StellarError';
import { WalletError, WalletErrorCode } from '../../../src/errors/WalletError';

describe('WalletError', () => {
  it('should extend StellarError', () => {
    const error = new WalletError(
      'Invalid key',
      WalletErrorCode.INVALID_SECRET_KEY,
    );

    expect(error).toBeInstanceOf(WalletError);
    expect(error).toBeInstanceOf(StellarError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('WalletError');
    expect(error.code).toBe('WALLET_INVALID_SECRET_KEY');
  });

  it('should include details', () => {
    const error = new WalletError(
      'Mnemonic invalid',
      WalletErrorCode.INVALID_MNEMONIC,
      { wordCount: 11 },
    );

    expect(error.details).toEqual({ wordCount: 11 });
  });
});
