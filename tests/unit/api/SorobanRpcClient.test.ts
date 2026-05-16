import { ApiClient } from '../../../src/api/ApiClient';
import { SorobanRpcClient } from '../../../src/api/SorobanRpcClient';
import { ConfigManager } from '../../../src/config/ConfigManager';

jest.mock('../../../src/api/ApiClient');

describe('SorobanRpcClient', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  let client: SorobanRpcClient;
  let mockPost: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});

    mockPost = jest.fn();
    (ApiClient as jest.MockedClass<typeof ApiClient>).mockImplementation(
      () => ({ get: jest.fn(), post: mockPost, getAxiosInstance: jest.fn() } as unknown as ApiClient),
    );

    client = new SorobanRpcClient(config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper to mock a successful JSON-RPC response
  function mockRpcSuccess<T>(result: T): void {
    mockPost.mockResolvedValue({
      data: { jsonrpc: '2.0', id: 1, result },
      status: 200,
    });
  }

  function mockRpcError(code: number, message: string): void {
    mockPost.mockResolvedValue({
      data: { jsonrpc: '2.0', id: 1, error: { code, message } },
      status: 200,
    });
  }

  function expectRpcCall(method: string, params?: unknown): void {
    expect(mockPost).toHaveBeenCalledWith(
      '/',
      expect.objectContaining({
        jsonrpc: '2.0',
        method,
        ...(params !== undefined ? { params } : {}),
      }),
    );
  }

  // ─── 2.3.13: getHealth ──────────────────────────────────────────────

  describe('getHealth', () => {
    it('should return node health status', async () => {
      mockRpcSuccess({
        status: 'healthy',
        latestLedger: 50000,
        oldestLedger: 1,
        ledgerRetentionWindow: 17280,
      });

      const result = await client.getHealth();
      expectRpcCall('getHealth');
      expect(result.data.status).toBe('healthy');
      expect(result.data.latestLedger).toBe(50000);
    });

    it('should throw on RPC error', async () => {
      mockRpcError(-32600, 'Invalid request');
      await expect(client.getHealth()).rejects.toThrow('Soroban RPC error (-32600): Invalid request');
    });
  });

  // ─── 2.3.14: getTransaction ─────────────────────────────────────────

  describe('getTransaction', () => {
    it('should return SUCCESS transaction', async () => {
      mockRpcSuccess({
        status: 'SUCCESS',
        latestLedger: 50000,
        latestLedgerCloseTime: '2024-01-01T00:00:00Z',
        oldestLedger: 1,
        oldestLedgerCloseTime: '2023-01-01T00:00:00Z',
        ledger: 49999,
        createdAt: '2024-01-01T00:00:00Z',
        envelopeXdr: 'envXdr',
        resultXdr: 'resXdr',
      });

      const result = await client.getTransaction('abc123');
      expectRpcCall('getTransaction', { hash: 'abc123' });
      expect(result.data.status).toBe('SUCCESS');
      expect(result.data.ledger).toBe(49999);
    });

    it('should return NOT_FOUND transaction', async () => {
      mockRpcSuccess({
        status: 'NOT_FOUND',
        latestLedger: 50000,
        latestLedgerCloseTime: '2024-01-01T00:00:00Z',
        oldestLedger: 1,
        oldestLedgerCloseTime: '2023-01-01T00:00:00Z',
      });

      const result = await client.getTransaction('nonexistent');
      expect(result.data.status).toBe('NOT_FOUND');
    });

    it('should return FAILED transaction', async () => {
      mockRpcSuccess({
        status: 'FAILED',
        latestLedger: 50000,
        latestLedgerCloseTime: '2024-01-01T00:00:00Z',
        oldestLedger: 1,
        oldestLedgerCloseTime: '2023-01-01T00:00:00Z',
      });

      const result = await client.getTransaction('failed_tx');
      expect(result.data.status).toBe('FAILED');
    });
  });

  // ─── 2.3.15: getEvents ──────────────────────────────────────────────

  describe('getEvents', () => {
    it('should return contract events', async () => {
      mockRpcSuccess({
        events: [
          {
            type: 'contract',
            ledger: 49000,
            ledgerClosedAt: '2024-01-01T00:00:00Z',
            contractId: 'C...',
            id: 'evt1',
            pagingToken: 'pag1',
            topic: ['transfer'],
            value: 'val1',
            inSuccessfulContractCall: true,
          },
        ],
        latestLedger: 50000,
      });

      const result = await client.getEvents({ startLedger: 49000 });
      expectRpcCall('getEvents', { startLedger: 49000 });
      expect(result.data.events).toHaveLength(1);
      expect(result.data.events[0].contractId).toBe('C...');
    });

    it('should pass filters and pagination', async () => {
      mockRpcSuccess({ events: [], latestLedger: 50000 });

      await client.getEvents({
        startLedger: 48000,
        filters: [{ type: 'contract', contractIds: ['CABC'] }],
        pagination: { limit: 5, cursor: 'cur1' },
      });

      expectRpcCall('getEvents', {
        startLedger: 48000,
        filters: [{ type: 'contract', contractIds: ['CABC'] }],
        pagination: { limit: 5, cursor: 'cur1' },
      });
    });

    it('should omit filters when empty', async () => {
      mockRpcSuccess({ events: [], latestLedger: 50000 });

      await client.getEvents({ startLedger: 48000 });
      expectRpcCall('getEvents', { startLedger: 48000 });
    });
  });

  // ─── 2.3.16: getLedgerEntries ───────────────────────────────────────

  describe('getLedgerEntries', () => {
    it('should return ledger entries by keys', async () => {
      mockRpcSuccess({
        entries: [
          { key: 'keyXdr1', xdr: 'valXdr1', lastModifiedLedgerSeq: 49000 },
          { key: 'keyXdr2', xdr: 'valXdr2', lastModifiedLedgerSeq: 49500, liveUntilLedgerSeq: 60000 },
        ],
        latestLedger: 50000,
      });

      const result = await client.getLedgerEntries(['keyXdr1', 'keyXdr2']);
      expectRpcCall('getLedgerEntries', { keys: ['keyXdr1', 'keyXdr2'] });
      expect(result.data.entries).toHaveLength(2);
      expect(result.data.entries[1].liveUntilLedgerSeq).toBe(60000);
    });

    it('should handle empty entries', async () => {
      mockRpcSuccess({ entries: [], latestLedger: 50000 });

      const result = await client.getLedgerEntries(['nonexistent']);
      expect(result.data.entries).toEqual([]);
    });
  });

  // ─── 2.3.17: getNetwork ────────────────────────────────────────────

  describe('getNetwork', () => {
    it('should return network info', async () => {
      mockRpcSuccess({
        friendbotUrl: 'https://friendbot.stellar.org',
        passphrase: 'Test SDF Network ; September 2015',
        protocolVersion: 21,
      });

      const result = await client.getNetwork();
      expectRpcCall('getNetwork');
      expect(result.data.passphrase).toBe('Test SDF Network ; September 2015');
      expect(result.data.protocolVersion).toBe(21);
      expect(result.data.friendbotUrl).toBe('https://friendbot.stellar.org');
    });

    it('should handle network without friendbotUrl (mainnet)', async () => {
      mockRpcSuccess({
        passphrase: 'Public Global Stellar Network ; September 2015',
        protocolVersion: 21,
      });

      const result = await client.getNetwork();
      expect(result.data.friendbotUrl).toBeUndefined();
      expect(result.data.passphrase).toContain('Public Global');
    });
  });

  // ─── Error Handling ────────────────────────────────────────────────

  describe('error handling', () => {
    it('should throw on RPC error response', async () => {
      mockRpcError(-32601, 'Method not found');
      await expect(client.getHealth()).rejects.toThrow('Soroban RPC error (-32601): Method not found');
    });

    it('should throw when result is undefined', async () => {
      mockPost.mockResolvedValue({
        data: { jsonrpc: '2.0', id: 1 },
        status: 200,
      });
      await expect(client.getHealth()).rejects.toThrow('Soroban RPC returned no result');
    });

    it('should increment request IDs', async () => {
      mockRpcSuccess({ status: 'healthy', latestLedger: 1, oldestLedger: 1, ledgerRetentionWindow: 1 });
      await client.getHealth();

      mockRpcSuccess({ passphrase: 'Test', protocolVersion: 21 });
      await client.getNetwork();

      // First call id=1, second id=2
      const firstCall = mockPost.mock.calls[0][1];
      const secondCall = mockPost.mock.calls[1][1];
      expect(firstCall.id).toBe(1);
      expect(secondCall.id).toBe(2);
    });
  });
});
