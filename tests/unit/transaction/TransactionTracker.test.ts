import { Horizon } from '@stellar/stellar-sdk';

import { ConfigManager } from '../../../src/config/ConfigManager';
import { TransactionTracker } from '../../../src/transaction/TransactionTracker';
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

describe('TransactionTracker', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  let mockCall: jest.Mock;

  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});

    mockCall = jest.fn();
    (Horizon.Server as unknown as jest.Mock).mockImplementation(() => ({
      transactions: () => ({
        transaction: () => ({
          call: mockCall,
        }),
      }),
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be instantiable with config', () => {
    const tracker = new TransactionTracker(config);
    expect(tracker).toBeDefined();
  });

  describe('getStatus', () => {
    it('should return confirmed for a successful transaction', async () => {
      mockCall.mockResolvedValue({
        hash: 'tx_hash_1',
        successful: true,
        ledger_attr: 42,
        created_at: '2024-01-01T00:00:00Z',
      });

      const tracker = new TransactionTracker(config);
      const status = await tracker.getStatus('tx_hash_1');

      expect(status).toEqual({
        hash: 'tx_hash_1',
        status: 'confirmed',
        ledger: 42,
        createdAt: '2024-01-01T00:00:00Z',
      });
    });

    it('should return failed for an unsuccessful transaction', async () => {
      mockCall.mockResolvedValue({
        hash: 'tx_hash_2',
        successful: false,
        ledger_attr: 43,
        created_at: '2024-01-01T00:00:00Z',
      });

      const tracker = new TransactionTracker(config);
      const status = await tracker.getStatus('tx_hash_2');

      expect(status.status).toBe('failed');
    });

    it('should return not_found for 404 response', async () => {
      mockCall.mockRejectedValue({
        response: { status: 404 },
      });

      const tracker = new TransactionTracker(config);
      const status = await tracker.getStatus('tx_nonexistent');

      expect(status).toEqual({
        hash: 'tx_nonexistent',
        status: 'not_found',
      });
    });

    it('should return pending for other errors', async () => {
      mockCall.mockRejectedValue(new Error('connection refused'));

      const tracker = new TransactionTracker(config);
      const status = await tracker.getStatus('tx_unknown');

      expect(status).toEqual({
        hash: 'tx_unknown',
        status: 'pending',
      });
    });
  });

  describe('waitForConfirmation', () => {
    it('should return immediately when transaction is confirmed', async () => {
      mockCall.mockResolvedValue({
        hash: 'tx_confirmed',
        successful: true,
        ledger_attr: 50,
        created_at: '2024-01-01T00:00:00Z',
      });

      const tracker = new TransactionTracker(config);
      const result = await tracker.waitForConfirmation('tx_confirmed', {
        maxAttempts: 5,
        intervalMs: 10,
      });

      expect(result.status).toBe('confirmed');
      expect(result.hash).toBe('tx_confirmed');
      expect(result.ledger).toBe(50);
    });

    it('should return immediately when transaction has failed', async () => {
      mockCall.mockResolvedValue({
        hash: 'tx_failed',
        successful: false,
        ledger_attr: 51,
        created_at: '2024-01-01T00:00:00Z',
      });

      const tracker = new TransactionTracker(config);
      const result = await tracker.waitForConfirmation('tx_failed', {
        maxAttempts: 5,
        intervalMs: 10,
      });

      expect(result.status).toBe('failed');
    });

    it('should poll until confirmed', async () => {
      mockCall
        .mockRejectedValueOnce({ response: { status: 404 } }) // not_found
        .mockRejectedValueOnce(new Error('pending'))          // pending
        .mockResolvedValueOnce({                               // confirmed
          hash: 'tx_eventual',
          successful: true,
          ledger_attr: 55,
          created_at: '2024-01-01T00:00:00Z',
        });

      const tracker = new TransactionTracker(config);
      const result = await tracker.waitForConfirmation('tx_eventual', {
        maxAttempts: 5,
        intervalMs: 10,
      });

      expect(result.status).toBe('confirmed');
      expect(mockCall).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts if not confirmed', async () => {
      mockCall.mockRejectedValue(new Error('still pending'));

      const tracker = new TransactionTracker(config);

      await expect(
        tracker.waitForConfirmation('tx_stuck', {
          maxAttempts: 3,
          intervalMs: 10,
        }),
      ).rejects.toThrow(StellarError);

      expect(mockCall).toHaveBeenCalledTimes(3);
    });

    it('should throw with TX_CONFIRMATION_TIMEOUT code', async () => {
      mockCall.mockRejectedValue(new Error('pending'));

      const tracker = new TransactionTracker(config);

      try {
        await tracker.waitForConfirmation('tx_timeout', {
          maxAttempts: 2,
          intervalMs: 10,
        });
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(StellarError);
        expect((err as StellarError).code).toBe('TX_CONFIRMATION_TIMEOUT');
      }
    });
  });
});
