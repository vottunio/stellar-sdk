import { ApiClient } from '../../../src/api/ApiClient';
import { HorizonClient } from '../../../src/api/HorizonClient';
import { ConfigManager } from '../../../src/config/ConfigManager';

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

  // ─── 2.3.7: getEffects ──────────────────────────────────────────────

  describe('getEffects', () => {
    const effectsResponse = {
      _embedded: {
        records: [
          { id: 'eff1', type: 'account_created', type_i: 0, account: 'GA' },
        ],
      },
      _links: {},
    };

    it('should list all effects with defaults', async () => {
      mockGet.mockResolvedValue({ data: effectsResponse, status: 200 });
      const result = await horizon.getEffects();
      expect(mockGet).toHaveBeenCalledWith('/effects', { limit: 10, order: 'desc' });
      expect(result.data).toHaveLength(1);
    });

    it('should filter by account', async () => {
      mockGet.mockResolvedValue({ data: effectsResponse, status: 200 });
      await horizon.getEffects({ account: 'GABC' });
      expect(mockGet).toHaveBeenCalledWith('/accounts/GABC/effects', { limit: 10, order: 'desc' });
    });
  });

  // ─── 2.3.8: getLedger ───────────────────────────────────────────────

  describe('getLedger', () => {
    it('should fetch a specific ledger by sequence', async () => {
      const ledgerData = { id: 'led1', sequence: 12345, hash: 'abc' };
      mockGet.mockResolvedValue({ data: ledgerData, status: 200 });

      const result = await horizon.getLedger(12345);
      expect(mockGet).toHaveBeenCalledWith('/ledgers/12345');
      expect(result.data.sequence).toBe(12345);
    });

    it('should fetch the latest ledger when no sequence provided', async () => {
      const collectionData = {
        _embedded: { records: [{ id: 'led1', sequence: 99999, hash: 'xyz' }] },
        _links: {},
      };
      mockGet.mockResolvedValue({ data: collectionData, status: 200 });

      const result = await horizon.getLedger();
      expect(mockGet).toHaveBeenCalledWith('/ledgers', { limit: 1, order: 'desc' });
      expect(result.data.sequence).toBe(99999);
    });
  });

  // ─── 2.3.9: getAssets ──────────────────────────────────────────────

  describe('getAssets', () => {
    const assetsResponse = {
      _embedded: {
        records: [
          { asset_code: 'USDC', asset_issuer: 'GISSUER', asset_type: 'credit_alphanum4', amount: '1000000' },
        ],
      },
      _links: {},
    };

    it('should list assets with defaults', async () => {
      mockGet.mockResolvedValue({ data: assetsResponse, status: 200 });
      const result = await horizon.getAssets();
      expect(mockGet).toHaveBeenCalledWith('/assets', { limit: 10, order: 'desc' });
      expect(result.data).toHaveLength(1);
    });

    it('should filter by asset_code and asset_issuer', async () => {
      mockGet.mockResolvedValue({ data: assetsResponse, status: 200 });
      await horizon.getAssets({ asset_code: 'USDC', asset_issuer: 'GISSUER' });
      expect(mockGet).toHaveBeenCalledWith('/assets', {
        limit: 10, order: 'desc', asset_code: 'USDC', asset_issuer: 'GISSUER',
      });
    });
  });

  // ─── 2.3.10: getOrderBook ─────────────────────────────────────────

  describe('getOrderBook', () => {
    it('should fetch order book for a trading pair', async () => {
      const orderBookData = {
        bids: [{ price: '0.50', amount: '100', price_r: { n: 1, d: 2 } }],
        asks: [{ price: '0.51', amount: '200', price_r: { n: 51, d: 100 } }],
        base: { asset_type: 'native' },
        counter: { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'G...' },
      };
      mockGet.mockResolvedValue({ data: orderBookData, status: 200 });

      const result = await horizon.getOrderBook({
        selling_asset_type: 'native',
        buying_asset_type: 'credit_alphanum4',
        buying_asset_code: 'USDC',
        buying_asset_issuer: 'G...',
      });
      expect(mockGet).toHaveBeenCalledWith('/order_book', expect.objectContaining({
        selling_asset_type: 'native',
        buying_asset_type: 'credit_alphanum4',
        buying_asset_code: 'USDC',
        buying_asset_issuer: 'G...',
        limit: 20,
      }));
      expect(result.data.bids).toHaveLength(1);
      expect(result.data.asks).toHaveLength(1);
    });

    it('should use custom limit', async () => {
      mockGet.mockResolvedValue({ data: { bids: [], asks: [], base: {}, counter: {} }, status: 200 });
      await horizon.getOrderBook({
        selling_asset_type: 'native',
        buying_asset_type: 'native',
        limit: 50,
      });
      expect(mockGet).toHaveBeenCalledWith('/order_book', expect.objectContaining({ limit: 50 }));
    });
  });

  // ─── 2.3.11: getTradeAggregations ────────────────────────────────

  describe('getTradeAggregations', () => {
    const tradeAggResponse = {
      _embedded: {
        records: [
          { timestamp: '1700000000000', trade_count: '5', base_volume: '100', counter_volume: '50', avg: '0.5', high: '0.6', low: '0.4', open: '0.45', close: '0.55', high_r: { n: 3, d: 5 }, low_r: { n: 2, d: 5 }, open_r: { n: 9, d: 20 }, close_r: { n: 11, d: 20 } },
        ],
      },
      _links: {},
    };

    it('should fetch trade aggregations', async () => {
      mockGet.mockResolvedValue({ data: tradeAggResponse, status: 200 });

      const result = await horizon.getTradeAggregations({
        base_asset_type: 'native',
        counter_asset_type: 'credit_alphanum4',
        counter_asset_code: 'USDC',
        counter_asset_issuer: 'G...',
        resolution: 3600000,
      });
      expect(mockGet).toHaveBeenCalledWith('/trade_aggregations', expect.objectContaining({
        base_asset_type: 'native',
        counter_asset_type: 'credit_alphanum4',
        counter_asset_code: 'USDC',
        counter_asset_issuer: 'G...',
        resolution: 3600000,
      }));
      expect(result.data).toHaveLength(1);
      expect(result.data[0].trade_count).toBe('5');
    });

    it('should pass time range and offset', async () => {
      mockGet.mockResolvedValue({ data: tradeAggResponse, status: 200 });

      await horizon.getTradeAggregations({
        base_asset_type: 'native',
        counter_asset_type: 'native',
        resolution: 60000,
        start_time: 1700000000000,
        end_time: 1700003600000,
        offset: 0,
        limit: 50,
        order: 'asc',
      });
      expect(mockGet).toHaveBeenCalledWith('/trade_aggregations', expect.objectContaining({
        start_time: 1700000000000,
        end_time: 1700003600000,
        offset: 0,
        limit: 50,
        order: 'asc',
      }));
    });
  });

  // ─── 2.3.12: getFeeStats ─────────────────────────────────────────

  describe('getFeeStats', () => {
    it('should fetch fee statistics', async () => {
      const feeData = {
        last_ledger: '12345',
        last_ledger_base_fee: '100',
        ledger_capacity_usage: '0.25',
        fee_charged: { max: '200', min: '100', mode: '100', p10: '100', p20: '100', p30: '100', p40: '100', p50: '100', p60: '100', p70: '100', p80: '100', p90: '150', p95: '175', p99: '200' },
        max_fee: { max: '500', min: '100', mode: '100', p10: '100', p20: '100', p30: '100', p40: '100', p50: '100', p60: '100', p70: '150', p80: '200', p90: '300', p95: '400', p99: '500' },
      };
      mockGet.mockResolvedValue({ data: feeData, status: 200 });

      const result = await horizon.getFeeStats();
      expect(mockGet).toHaveBeenCalledWith('/fee_stats');
      expect(result.data.last_ledger).toBe('12345');
      expect(result.data.fee_charged.p99).toBe('200');
      expect(result.data.max_fee.p99).toBe('500');
      expect(result.pagination).toBeUndefined();
    });
  });
});
