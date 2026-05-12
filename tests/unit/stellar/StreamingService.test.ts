import { Horizon } from '@stellar/stellar-sdk';

import { ConfigManager } from '../../../src/config/ConfigManager';
import { StreamingService } from '../../../src/stellar/StreamingService';

// ─── Mock Horizon.Server ────────────────────────────────────────────────────

const mockStream = jest.fn();
const mockCursor = jest.fn();
const mockForAccount = jest.fn();

function createMockCallBuilder() {
  const builder = {
    forAccount: mockForAccount,
    cursor: mockCursor,
    stream: mockStream,
  };
  mockForAccount.mockReturnValue(builder);
  mockCursor.mockReturnValue(builder);
  return builder;
}

const mockTransactions = jest.fn();
const mockPayments = jest.fn();
const mockOperations = jest.fn();
const mockEffects = jest.fn();
const mockLedgers = jest.fn();

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: jest.fn().mockImplementation(() => ({
        transactions: mockTransactions,
        payments: mockPayments,
        operations: mockOperations,
        effects: mockEffects,
        ledgers: mockLedgers,
      })),
    },
  };
});

describe('StreamingService', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  let service: StreamingService;
  let mockCloseFn: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    service = new StreamingService(config);
    mockCloseFn = jest.fn();
    mockStream.mockReturnValue(mockCloseFn);

    const builder = createMockCallBuilder();
    mockTransactions.mockReturnValue(builder);
    mockPayments.mockReturnValue(builder);
    mockOperations.mockReturnValue(builder);
    mockEffects.mockReturnValue(builder);
    mockLedgers.mockReturnValue({ cursor: mockCursor, stream: mockStream });
    mockCursor.mockReturnValue({ cursor: mockCursor, stream: mockStream, forAccount: mockForAccount });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── transactions ─────────────────────────────────────────────────

  describe('transactions', () => {
    it('should start streaming transactions for an account', () => {
      const onMessage = jest.fn();
      const close = service.transactions('GABC', onMessage);

      expect(mockTransactions).toHaveBeenCalled();
      expect(mockForAccount).toHaveBeenCalledWith('GABC');
      expect(mockCursor).toHaveBeenCalledWith('now');
      expect(mockStream).toHaveBeenCalled();
      expect(typeof close).toBe('function');
    });

    it('should call onMessage and save cursor when record arrives', () => {
      const onMessage = jest.fn();
      mockStream.mockImplementation((opts: { onmessage: (r: unknown) => void }) => {
        opts.onmessage({ hash: 'tx1', paging_token: 'cursor1' });
        return mockCloseFn;
      });

      service.transactions('GABC', onMessage);
      expect(onMessage).toHaveBeenCalledWith({ hash: 'tx1', paging_token: 'cursor1' });
      expect(service.getCursor('transactions:GABC')).toBe('cursor1');
    });

    it('should resume from saved cursor', () => {
      service.setCursor('transactions:GABC', 'saved_cursor');
      service.transactions('GABC', jest.fn());
      expect(mockCursor).toHaveBeenCalledWith('saved_cursor');
    });

    it('should call close function when returned fn is invoked', () => {
      const close = service.transactions('GABC', jest.fn());
      close();
      expect(mockCloseFn).toHaveBeenCalled();
    });

    it('should call onError callback on stream error', () => {
      const onError = jest.fn();
      mockStream.mockImplementation((opts: { onerror: (e: unknown) => void }) => {
        opts.onerror(new Error('stream broke'));
        return mockCloseFn;
      });

      service.transactions('GABC', jest.fn(), onError);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ─── payments ─────────────────────────────────────────────────────

  describe('payments', () => {
    it('should start streaming payments', () => {
      const close = service.payments('GABC', jest.fn());
      expect(mockPayments).toHaveBeenCalled();
      expect(mockForAccount).toHaveBeenCalledWith('GABC');
      expect(typeof close).toBe('function');
    });

    it('should save cursor on message', () => {
      mockStream.mockImplementation((opts: { onmessage: (r: unknown) => void }) => {
        opts.onmessage({ type: 'payment', paging_token: 'pay_cursor' });
        return mockCloseFn;
      });

      service.payments('GABC', jest.fn());
      expect(service.getCursor('payments:GABC')).toBe('pay_cursor');
    });
  });

  // ─── operations ───────────────────────────────────────────────────

  describe('operations', () => {
    it('should start streaming operations', () => {
      const close = service.operations('GABC', jest.fn());
      expect(mockOperations).toHaveBeenCalled();
      expect(typeof close).toBe('function');
    });
  });

  // ─── effects ──────────────────────────────────────────────────────

  describe('effects', () => {
    it('should start streaming effects', () => {
      const close = service.effects('GABC', jest.fn());
      expect(mockEffects).toHaveBeenCalled();
      expect(typeof close).toBe('function');
    });
  });

  // ─── ledgers ──────────────────────────────────────────────────────

  describe('ledgers', () => {
    it('should start streaming ledgers', () => {
      const close = service.ledgers(jest.fn());
      expect(mockLedgers).toHaveBeenCalled();
      expect(typeof close).toBe('function');
    });

    it('should save cursor on ledger message', () => {
      mockStream.mockImplementation((opts: { onmessage: (r: unknown) => void }) => {
        opts.onmessage({ sequence: 12345, paging_token: 'ledger_cursor' });
        return mockCloseFn;
      });

      service.ledgers(jest.fn());
      expect(service.getCursor('ledgers')).toBe('ledger_cursor');
    });
  });

  // ─── Cursor Management ────────────────────────────────────────────

  describe('cursor management', () => {
    it('should get/set cursors', () => {
      expect(service.getCursor('test')).toBeUndefined();

      service.setCursor('test', 'abc123');
      expect(service.getCursor('test')).toBe('abc123');
    });

    it('should clear all cursors', () => {
      service.setCursor('a', '1');
      service.setCursor('b', '2');
      service.clearCursors();
      expect(service.getCursor('a')).toBeUndefined();
      expect(service.getCursor('b')).toBeUndefined();
    });
  });
});
