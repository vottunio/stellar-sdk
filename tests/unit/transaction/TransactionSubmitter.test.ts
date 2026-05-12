import { Horizon, Keypair, Account, TransactionBuilder as StellarTxBuilder, Networks, Operation } from '@stellar/stellar-sdk';

import { ConfigManager } from '../../../src/config/ConfigManager';
import { TransactionSubmitter } from '../../../src/transaction/TransactionSubmitter';
import { StellarError } from '../../../src/errors/StellarError';

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

  it('should NOT retry on tx_bad_seq (3.1.7 — deterministic error)', async () => {
    // tx_bad_seq is deterministic: re-submitting the same signed XDR will
    // always fail with the same code. Caller must rebuild with fresh sequence.
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

  it('should NOT retry on tx_too_late (3.1.7 — deterministic error)', async () => {
    const tooLateError = {
      response: {
        data: {
          extras: {
            result_codes: { transaction: 'tx_too_late' },
          },
        },
      },
    };

    mockSubmitTransaction.mockRejectedValue(tooLateError);

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

  it('should throw StellarError after exhausting retries on transient errors', async () => {
    // 503 is transient (retryable). After maxAttempts, throws.
    const serverError = {
      response: { status: 503, data: { detail: 'Service Unavailable' } },
    };

    mockSubmitTransaction.mockRejectedValue(serverError);

    // Mock lookup to never find the tx (always 404)
    (Horizon.Server as unknown as jest.Mock).mockImplementation(() => ({
      submitTransaction: mockSubmitTransaction,
      transactions: () => ({
        transaction: () => ({ call: jest.fn().mockRejectedValue(new Error('404')) }),
      }),
    }));

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

  it('should return existing tx if already confirmed on retry (3.1.7 idempotency)', async () => {
    // First attempt fails transiently. Before the second attempt, the submitter
    // checks if the tx already landed — if so, return it without re-submitting.
    const serverError = {
      response: { status: 503, data: { detail: 'Service Unavailable' } },
    };
    mockSubmitTransaction.mockRejectedValueOnce(serverError);

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

    const expectedHash = tx.hash().toString('hex');
    (Horizon.Server as unknown as jest.Mock).mockImplementation(() => ({
      submitTransaction: mockSubmitTransaction,
      transactions: () => ({
        transaction: () => ({
          call: jest.fn().mockResolvedValue({
            hash: expectedHash,
            ledger_attr: 99,
            successful: true,
            result_xdr: 'r',
            envelope_xdr: 'e',
          }),
        }),
      }),
    }));

    const result = await submitter.submit(tx.toXDR());
    expect(result.hash).toBe(expectedHash);
    expect(result.ledger).toBe(99);
    // Idempotency check short-circuits the second submission attempt
    expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
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

    // Mock lookup to return 404 so retry actually executes
    (Horizon.Server as unknown as jest.Mock).mockImplementation(() => ({
      submitTransaction: mockSubmitTransaction,
      transactions: () => ({
        transaction: () => ({ call: jest.fn().mockRejectedValue(new Error('404')) }),
      }),
    }));

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
