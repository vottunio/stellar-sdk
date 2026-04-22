import { EventRouter } from '../../../src/websocket/EventRouter';

describe('EventRouter', () => {
  let router: EventRouter;

  beforeEach(() => {
    router = new EventRouter();
  });

  // ─── on / dispatch ────────────────────────────────────────────────

  describe('on / dispatch', () => {
    it('should register and dispatch an event handler', () => {
      const handler = jest.fn();
      router.on('payment.received', handler);

      router.dispatch('payment.received', { from: 'GA', to: 'GB', amount: '10' });
      expect(handler).toHaveBeenCalledWith({ from: 'GA', to: 'GB', amount: '10' });
    });

    it('should dispatch to multiple handlers', () => {
      const h1 = jest.fn();
      const h2 = jest.fn();
      router.on('payment.received', h1);
      router.on('payment.received', h2);

      router.dispatch('payment.received', { amount: '5' });
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('should not dispatch to handlers of different events', () => {
      const handler = jest.fn();
      router.on('transaction.confirmed', handler);

      router.dispatch('payment.received', {});
      expect(handler).not.toHaveBeenCalled();
    });

    it('should dispatch transaction.confirmed events', () => {
      const handler = jest.fn();
      router.on('transaction.confirmed', handler);
      router.dispatch('transaction.confirmed', { hash: 'tx1', ledger: 100, account: 'GA', operations: [] });
      expect(handler).toHaveBeenCalledWith({ hash: 'tx1', ledger: 100, account: 'GA', operations: [] });
    });

    it('should dispatch transaction.failed events', () => {
      const handler = jest.fn();
      router.on('transaction.failed', handler);
      router.dispatch('transaction.failed', { hash: 'tx2', error: 'tx_bad_seq', account: 'GA' });
      expect(handler).toHaveBeenCalledWith({ hash: 'tx2', error: 'tx_bad_seq', account: 'GA' });
    });

    it('should dispatch account.updated events', () => {
      const handler = jest.fn();
      router.on('account.updated', handler);
      router.dispatch('account.updated', { account: 'GA', balances: [{ code: 'XLM' }], signers: [] });
      expect(handler).toHaveBeenCalledWith({ account: 'GA', balances: [{ code: 'XLM' }], signers: [] });
    });

    it('should dispatch contract.event events', () => {
      const handler = jest.fn();
      router.on('contract.event', handler);
      router.dispatch('contract.event', { contractId: 'C...', topic: ['transfer'], data: {}, ledger: 500 });
      expect(handler).toHaveBeenCalledWith({ contractId: 'C...', topic: ['transfer'], data: {}, ledger: 500 });
    });

    it('should return an unsubscribe function', () => {
      const handler = jest.fn();
      const unsub = router.on('connected', handler);

      router.dispatch('connected', undefined);
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();
      router.dispatch('connected', undefined);
      expect(handler).toHaveBeenCalledTimes(1); // not called again
    });

    it('should swallow handler errors without breaking other handlers', () => {
      const badHandler = jest.fn(() => { throw new Error('oops'); });
      const goodHandler = jest.fn();
      router.on('error', badHandler);
      router.on('error', goodHandler);

      router.dispatch('error', { message: 'test' });
      expect(badHandler).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalled(); // still called despite badHandler throwing
    });
  });

  // ─── off ──────────────────────────────────────────────────────────

  describe('off', () => {
    it('should remove handlers for a specific event', () => {
      const handler = jest.fn();
      router.on('connected', handler);
      router.off('connected');

      router.dispatch('connected', undefined);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should remove all handlers when no event specified', () => {
      const h1 = jest.fn();
      const h2 = jest.fn();
      router.on('connected', h1);
      router.on('disconnected', h2);
      router.off();

      router.dispatch('connected', undefined);
      router.dispatch('disconnected', undefined);
      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });
  });

  // ─── handlerCount / hasHandlers ───────────────────────────────────

  describe('handlerCount / hasHandlers', () => {
    it('should return 0 for unregistered events', () => {
      expect(router.handlerCount('connected')).toBe(0);
      expect(router.hasHandlers('connected')).toBe(false);
    });

    it('should track handler count', () => {
      router.on('connected', jest.fn());
      router.on('connected', jest.fn());
      expect(router.handlerCount('connected')).toBe(2);
      expect(router.hasHandlers('connected')).toBe(true);
    });
  });

  // ─── Subscription Filters ────────────────────────────────────────

  describe('subscription filters', () => {
    it('should pass all events when no filters registered', () => {
      const handler = jest.fn();
      router.on('payment.received', handler);

      router.dispatch('payment.received', { from: 'GA', to: 'GB' });
      expect(handler).toHaveBeenCalled();
    });

    it('should filter by event name', () => {
      const handler = jest.fn();
      router.on('payment.received', handler);
      router.on('transaction.confirmed', handler);

      router.subscribe({ events: ['payment.received'] });

      router.dispatch('payment.received', {});
      router.dispatch('transaction.confirmed', {});

      expect(handler).toHaveBeenCalledTimes(1); // only payment.received
    });

    it('should filter by account', () => {
      const handler = jest.fn();
      router.on('payment.received', handler);

      router.subscribe({ account: 'GABC' });

      router.dispatch('payment.received', { from: 'GABC', to: 'GXYZ', amount: '10' });
      router.dispatch('payment.received', { from: 'GOTHER', to: 'GXYZ', amount: '5' });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should filter by asset', () => {
      const handler = jest.fn();
      router.on('payment.received', handler);

      router.subscribe({ asset: 'XLM' });

      router.dispatch('payment.received', { asset: 'XLM', amount: '10' });
      router.dispatch('payment.received', { asset: 'USDC', amount: '5' });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should pass if any filter matches (OR logic)', () => {
      const handler = jest.fn();
      router.on('payment.received', handler);

      router.subscribe({ account: 'GA' });
      router.subscribe({ account: 'GB' });

      router.dispatch('payment.received', { from: 'GA' });
      router.dispatch('payment.received', { from: 'GB' });
      router.dispatch('payment.received', { from: 'GC' });

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should clear filters', () => {
      const handler = jest.fn();
      router.on('payment.received', handler);

      router.subscribe({ events: ['transaction.confirmed'] }); // blocks payment.received
      router.clearFilters();

      router.dispatch('payment.received', {});
      expect(handler).toHaveBeenCalledTimes(1); // passes after clear
    });
  });
});
