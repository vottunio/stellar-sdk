import { Horizon, Keypair, Account, TransactionBuilder as StellarTxBuilder, Networks, Operation } from '@stellar/stellar-sdk';

import { ConfigManager } from '../../../src/config/ConfigManager';
import { StellarError } from '../../../src/errors/StellarError';
import { TransactionSubmitter } from '../../../src/transaction/TransactionSubmitter';

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: jest.fn(),
    },
  };
});

describe('TransactionSubmitter', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  let mockSubmitTransaction: jest.Mock;

  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});

    mockSubmitTransaction = jest.fn();
    (Horizon.Server as unknown as jest.Mock).mockImplementation(() => ({
      submitTransaction: mockSubmitTransaction,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be instantiable with config', () => {
    const submitter = new TransactionSubmitter(config);
    expect(submitter).toBeDefined();
  });

  it('should submit a valid transaction and return result', async () => {
    mockSubmitTransaction.mockResolvedValue({
      hash: 'tx_hash_123',
      ledger: 42,
      successful: true,
      result_xdr: 'resultXdr',
      envelope_xdr: 'envelopeXdr',
    });

    const submitter = new TransactionSubmitter(config);
    // Build a real XDR using the actual SDK
    const keypair = Keypair.random();
    const account = new Account(keypair.publicKey(), '100');
    const tx = new StellarTxBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.manageData({ name: 'test', value: 'val' }),
      )
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    const signedXdr = tx.toXDR();

    const result = await submitter.submit(signedXdr);

    expect(result).toEqual({
      hash: 'tx_hash_123',
      ledger: 42,
      successful: true,
      resultXdr: 'resultXdr',
      envelopeXdr: 'envelopeXdr',
    });
    expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
  });

  it('should retry on tx_bad_seq error', async () => {
    const badSeqError = {
      response: {
        data: {
          extras: {
            result_codes: { transaction: 'tx_bad_seq' },
          },
        },
      },
    };

    mockSubmitTransaction
      .mockRejectedValueOnce(badSeqError)
      .mockResolvedValueOnce({
        hash: 'tx_hash_retry',
        ledger: 43,
        successful: true,
        result_xdr: 'resultXdr',
        envelope_xdr: 'envelopeXdr',
      });

    const retryConfig = new ConfigManager({
      network: 'testnet',
      retry: { maxAttempts: 3, backoffMultiplier: 1 },
    }).getConfig();

    const submitter = new TransactionSubmitter(retryConfig);
    const keypair = Keypair.random();
    const account = new Account(keypair.publicKey(), '100');
    const tx = new StellarTxBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.manageData({ name: 'test', value: 'val' }))
      .setTimeout(30)
      .build();
    tx.sign(keypair);

    const result = await submitter.submit(tx.toXDR());

    expect(result.hash).toBe('tx_hash_retry');
    expect(mockSubmitTransaction).toHaveBeenCalledTimes(2);
  });

  it('should retry on tx_too_late error', async () => {
    const tooLateError = {
      response: {
        data: {
          extras: {
            result_codes: { transaction: 'tx_too_late' },
          },
        },
      },
    };

    mockSubmitTransaction
      .mockRejectedValueOnce(tooLateError)
      .mockResolvedValueOnce({
        hash: 'tx_hash_late',
        ledger: 44,
        successful: true,
        result_xdr: 'r',
        envelope_xdr: 'e',
      });

    const retryConfig = new ConfigManager({
      network: 'testnet',
      retry: { maxAttempts: 3, backoffMultiplier: 1 },
    }).getConfig();

    const submitter = new TransactionSubmitter(retryConfig);
    const keypair = Keypair.random();
    const account = new Account(keypair.publicKey(), '100');
    const tx = new StellarTxBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.manageData({ name: 'test', value: 'val' }))
      .setTimeout(30)
      .build();
    tx.sign(keypair);

    const result = await submitter.submit(tx.toXDR());
    expect(result.hash).toBe('tx_hash_late');
    expect(mockSubmitTransaction).toHaveBeenCalledTimes(2);
  });

  it('should NOT retry on non-retryable errors', async () => {
    const nonRetryableError = {
      response: {
        data: {
          detail: 'insufficient balance',
          extras: {
            result_codes: { transaction: 'tx_failed', operations: ['op_underfunded'] },
          },
        },
      },
    };

    mockSubmitTransaction.mockRejectedValue(nonRetryableError);

    const retryConfig = new ConfigManager({
      network: 'testnet',
      retry: { maxAttempts: 3, backoffMultiplier: 1 },
    }).getConfig();

    const submitter = new TransactionSubmitter(retryConfig);
    const keypair = Keypair.random();
    const account = new Account(keypair.publicKey(), '100');
    const tx = new StellarTxBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.manageData({ name: 'test', value: 'val' }))
      .setTimeout(30)
      .build();
    tx.sign(keypair);

    await expect(submitter.submit(tx.toXDR())).rejects.toThrow(StellarError);
    expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
  });

  it('should throw StellarError after exhausting retries', async () => {
    const badSeqError = {
      response: {
        data: {
          extras: {
            result_codes: { transaction: 'tx_bad_seq' },
          },
        },
      },
    };

    mockSubmitTransaction.mockRejectedValue(badSeqError);

    const retryConfig = new ConfigManager({
      network: 'testnet',
      retry: { maxAttempts: 2, backoffMultiplier: 1 },
    }).getConfig();

    const submitter = new TransactionSubmitter(retryConfig);
    const keypair = Keypair.random();
    const account = new Account(keypair.publicKey(), '100');
    const tx = new StellarTxBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.manageData({ name: 'test', value: 'val' }))
      .setTimeout(30)
      .build();
    tx.sign(keypair);

    await expect(submitter.submit(tx.toXDR())).rejects.toThrow(StellarError);
    expect(mockSubmitTransaction).toHaveBeenCalledTimes(2);
  });

  it('should normalize unknown errors to StellarError', async () => {
    mockSubmitTransaction.mockRejectedValue(new Error('network down'));

    const submitter = new TransactionSubmitter(config);
    const keypair = Keypair.random();
    const account = new Account(keypair.publicKey(), '100');
    const tx = new StellarTxBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.manageData({ name: 'test', value: 'val' }))
      .setTimeout(30)
      .build();
    tx.sign(keypair);

    await expect(submitter.submit(tx.toXDR())).rejects.toThrow(StellarError);
  });

  it('should retry on timeout errors', async () => {
    mockSubmitTransaction
      .mockRejectedValueOnce(new Error('Request timeout'))
      .mockResolvedValueOnce({
        hash: 'tx_after_timeout',
        ledger: 45,
        successful: true,
        result_xdr: 'r',
        envelope_xdr: 'e',
      });

    const retryConfig = new ConfigManager({
      network: 'testnet',
      retry: { maxAttempts: 3, backoffMultiplier: 1 },
    }).getConfig();

    const submitter = new TransactionSubmitter(retryConfig);
    const keypair = Keypair.random();
    const account = new Account(keypair.publicKey(), '100');
    const tx = new StellarTxBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.manageData({ name: 'test', value: 'val' }))
      .setTimeout(30)
      .build();
    tx.sign(keypair);

    const result = await submitter.submit(tx.toXDR());
    expect(result.hash).toBe('tx_after_timeout');
    expect(mockSubmitTransaction).toHaveBeenCalledTimes(2);
  });
});
