import { ConfigManager } from '../../../src/config/ConfigManager';
import { HorizonClient } from '../../../src/api/HorizonClient';
import { ApiClient } from '../../../src/api/ApiClient';

// Mock ApiClient
jest.mock('../../../src/api/ApiClient');

describe('HorizonClient', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  let horizon: HorizonClient;
  let mockGet: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});

    mockGet = jest.fn();
    (ApiClient as jest.MockedClass<typeof ApiClient>).mockImplementation(
      () => ({ get: mockGet, post: jest.fn(), getAxiosInstance: jest.fn() } as unknown as ApiClient),
    );

    horizon = new HorizonClient(config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── 2.3.2: getAccount ────────────────────────────────────────────────

  describe('getAccount', () => {
    it('should fetch an account by address', async () => {
      const accountData = {
        id: 'GABC',
        account_id: 'GABC',
        sequence: '123',
        balances: [{ asset_type: 'native', balance: '100.00' }],
        signers: [{ key: 'GABC', weight: 1, type: 'ed25519_public_key' }],
        thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
        flags: { auth_required: false, auth_revocable: false, auth_immutable: false, auth_clawback_enabled: false },
        data: {},
      };
      mockGet.mockResolvedValue({ data: accountData, status: 200 });

      const result = await horizon.getAccount('GABC');
      expect(mockGet).toHaveBeenCalledWith('/accounts/GABC');
      expect(result.data.account_id).toBe('GABC');
      expect(result.data.balances).toHaveLength(1);
      expect(result.pagination).toBeUndefined();
    });
  });

  // ─── 2.3.3: getTransactions ───────────────────────────────────────────

  describe('getTransactions', () => {
    const collectionResponse = {
      _embedded: {
        records: [
          { id: 'tx1', hash: 'hash1', ledger: 100, successful: true },
          { id: 'tx2', hash: 'hash2', ledger: 101, successful: true },
        ],
      },
      _links: {
        next: { href: '/transactions?cursor=tx2&limit=10&order=desc' },
      },
    };

    it('should list all transactions with defaults', async () => {
      mockGet.mockResolvedValue({ data: collectionResponse, status: 200 });

      const result = await horizon.getTransactions();
      expect(mockGet).toHaveBeenCalledWith('/transactions', { limit: 10, order: 'desc' });
      expect(result.data).toHaveLength(2);
      expect(result.pagination?.cursor).toBe('tx2');
      expect(result.pagination?.order).toBe('desc');
    });

    it('should filter by account', async () => {
      mockGet.mockResolvedValue({ data: collectionResponse, status: 200 });

      await horizon.getTransactions({ account: 'GABC' });
      expect(mockGet).toHaveBeenCalledWith(
        '/accounts/GABC/transactions',
        { limit: 10, order: 'desc' },
      );
    });

    it('should pass cursor and custom limit/order', async () => {
      mockGet.mockResolvedValue({ data: collectionResponse, status: 200 });

      await horizon.getTransactions({ cursor: 'abc', limit: 5, order: 'asc' });
      expect(mockGet).toHaveBeenCalledWith(
        '/transactions',
        { limit: 5, order: 'asc', cursor: 'abc' },
      );
    });
  });

  // ─── 2.3.4: getTransaction ────────────────────────────────────────────

  describe('getTransaction', () => {
    it('should fetch a single transaction by hash', async () => {
      const txData = {
        id: 'tx1',
        hash: 'hash123',
        ledger: 100,
        successful: true,
        source_account: 'GABC',
      };
      mockGet.mockResolvedValue({ data: txData, status: 200 });

      const result = await horizon.getTransaction('hash123');
      expect(mockGet).toHaveBeenCalledWith('/transactions/hash123');
      expect(result.data.hash).toBe('hash123');
      expect(result.data.ledger).toBe(100);
      expect(result.pagination).toBeUndefined();
    });
  });

  // ─── 2.3.5: getOperations ────────────────────────────────────────────

  describe('getOperations', () => {
    const opsResponse = {
      _embedded: {
        records: [
          { id: 'op1', type: 'payment', type_i: 1 },
          { id: 'op2', type: 'create_account', type_i: 0 },
        ],
      },
      _links: {},
    };

    it('should list all operations with defaults', async () => {
      mockGet.mockResolvedValue({ data: opsResponse, status: 200 });

      const result = await horizon.getOperations();
      expect(mockGet).toHaveBeenCalledWith('/operations', { limit: 10, order: 'desc' });
      expect(result.data).toHaveLength(2);
    });

    it('should filter by account', async () => {
      mockGet.mockResolvedValue({ data: opsResponse, status: 200 });

      await horizon.getOperations({ account: 'GABC' });
      expect(mockGet).toHaveBeenCalledWith(
        '/accounts/GABC/operations',
        { limit: 10, order: 'desc' },
      );
    });

    it('should filter by transaction', async () => {
      mockGet.mockResolvedValue({ data: opsResponse, status: 200 });

      await horizon.getOperations({ transaction: 'hash123' });
      expect(mockGet).toHaveBeenCalledWith(
        '/transactions/hash123/operations',
        { limit: 10, order: 'desc' },
      );
    });

    it('should prioritize transaction filter over account', async () => {
      mockGet.mockResolvedValue({ data: opsResponse, status: 200 });

      await horizon.getOperations({ account: 'GABC', transaction: 'hash123' });
      expect(mockGet).toHaveBeenCalledWith(
        '/transactions/hash123/operations',
        expect.any(Object),
      );
    });
  });

  // ─── 2.3.6: getPayments ──────────────────────────────────────────────

  describe('getPayments', () => {
    const paymentsResponse = {
      _embedded: {
        records: [
          { id: 'pay1', type: 'payment', from: 'GA', to: 'GB', amount: '10', asset_type: 'native' },
        ],
      },
      _links: {},
    };

    it('should list all payments with defaults', async () => {
      mockGet.mockResolvedValue({ data: paymentsResponse, status: 200 });

      const result = await horizon.getPayments();
      expect(mockGet).toHaveBeenCalledWith('/payments', { limit: 10, order: 'desc' });
      expect(result.data).toHaveLength(1);
    });

    it('should filter by account', async () => {
      mockGet.mockResolvedValue({ data: paymentsResponse, status: 200 });

      await horizon.getPayments({ account: 'GABC' });
      expect(mockGet).toHaveBeenCalledWith(
        '/accounts/GABC/payments',
        { limit: 10, order: 'desc' },
      );
    });

    it('should pass cursor and custom limit', async () => {
      mockGet.mockResolvedValue({ data: paymentsResponse, status: 200 });

      await horizon.getPayments({ cursor: 'xyz', limit: 20, order: 'asc' });
      expect(mockGet).toHaveBeenCalledWith(
        '/payments',
        { limit: 20, order: 'asc', cursor: 'xyz' },
      );
    });
  });
});
