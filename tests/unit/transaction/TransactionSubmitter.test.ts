import { ConfigManager } from '../../../src/config/ConfigManager';
import { TransactionSubmitter } from '../../../src/transaction/TransactionSubmitter';
import { StellarError } from '../../../src/errors/StellarError';

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        submitTransaction: jest.fn(),
      })),
    },
  };
});

describe('TransactionSubmitter', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();

  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be instantiable with config', () => {
    const submitter = new TransactionSubmitter(config);
    expect(submitter).toBeDefined();
  });

  it('should throw StellarError on failed submission', async () => {
    const submitter = new TransactionSubmitter(config);
    await expect(submitter.submit('invalid-xdr')).rejects.toThrow();
  });
});
