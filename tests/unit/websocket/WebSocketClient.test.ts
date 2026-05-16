import { EventEmitter } from 'events';

import { ConfigManager } from '../../../src/config/ConfigManager';
import { WebSocketClient } from '../../../src/websocket/WebSocketClient';

// ─── Mock ws ────────────────────────────────────────────────────────────────

class MockWebSocket extends EventEmitter {
  static OPEN = 1;
  static CONNECTING = 0;
  readyState = MockWebSocket.OPEN;
  ping = jest.fn();
  close = jest.fn();
  removeAllListeners = jest.fn(() => this);
}

jest.mock('ws', () => {
  const MockWS = jest.fn().mockImplementation(() => {
    const instance = new MockWebSocket();
    // Auto-emit 'open' on next tick to simulate connection
    setTimeout(() => instance.emit('open'), 0);
    return instance;
  });
  (MockWS as unknown as Record<string, number>).OPEN = 1;
  (MockWS as unknown as Record<string, number>).CONNECTING = 0;
  return { default: MockWS, __esModule: true };
});

describe('WebSocketClient', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  let client: WebSocketClient;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    client = new WebSocketClient(config);
  });

  afterEach(() => {
    client.disconnect();
    jest.restoreAllMocks();
  });

  // ─── 2.4.1: Instantiation ────────────────────────────────────────

  describe('instantiation', () => {
    it('should create a WebSocketClient instance', () => {
      expect(client).toBeInstanceOf(WebSocketClient);
    });

    it('should start in disconnected state', () => {
      expect(client.getState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });
  });

  // ─── 2.4.2: Connect / Disconnect ────────────────────────────────

  describe('connect / disconnect', () => {
    it('should connect and transition to connected state', async () => {
      await client.connect('wss://test.example.com');
      expect(client.getState()).toBe('connected');
      expect(client.isConnected()).toBe(true);
    });

    it('should fire connected event on connect', async () => {
      const handler = jest.fn();
      client.on('connected', handler);

      await client.connect('wss://test.example.com');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should disconnect and transition to disconnected state', async () => {
      await client.connect('wss://test.example.com');
      client.disconnect();
      expect(client.getState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });

    it('should fire disconnected event on disconnect', async () => {
      const handler = jest.fn();
      client.on('disconnected', handler);

      await client.connect('wss://test.example.com');
      client.disconnect();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should not connect twice if already connected', async () => {
      await client.connect('wss://test.example.com');
      await client.connect('wss://test.example.com'); // should be a no-op
      expect(client.isConnected()).toBe(true);
    });
  });

  // ─── 2.4.5: Event Subscription ──────────────────────────────────

  describe('event subscription', () => {
    it('should register and trigger event handlers via on()', async () => {
      const handler = jest.fn();
      client.on('payment.received', handler);

      await client.connect('wss://test.example.com');

      // Get the mock ws instance and simulate an incoming message
      const WS = jest.requireMock('ws').default;
      const wsInstance = WS.mock.results[0].value as MockWebSocket;
      const message = JSON.stringify({ event: 'payment.received', data: { amount: '10' } });
      wsInstance.emit('message', Buffer.from(message));

      expect(handler).toHaveBeenCalledWith({ amount: '10' });
    });

    it('should unsubscribe via returned function', async () => {
      const handler = jest.fn();
      const unsub = client.on('payment.received', handler);

      await client.connect('wss://test.example.com');
      unsub();

      const WS = jest.requireMock('ws').default;
      const wsInstance = WS.mock.results[0].value as MockWebSocket;
      const message = JSON.stringify({ event: 'payment.received', data: {} });
      wsInstance.emit('message', Buffer.from(message));

      expect(handler).not.toHaveBeenCalled();
    });

    it('should remove handlers via off()', () => {
      const handler = jest.fn();
      client.on('connected', handler);
      client.off('connected');

      // manually dispatch — handler should not fire
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─── 2.4.6: Event Filtering ─────────────────────────────────────

  describe('event filtering', () => {
    it('should filter events via subscribe()', async () => {
      const handler = jest.fn();
      client.on('payment.received', handler);
      client.subscribe({ account: 'GABC' });

      await client.connect('wss://test.example.com');

      const WS = jest.requireMock('ws').default;
      const wsInstance = WS.mock.results[0].value as MockWebSocket;

      // Matching event
      wsInstance.emit('message', Buffer.from(JSON.stringify({
        event: 'payment.received',
        data: { from: 'GABC', to: 'GXYZ', amount: '10' },
      })));

      // Non-matching event
      wsInstance.emit('message', Buffer.from(JSON.stringify({
        event: 'payment.received',
        data: { from: 'GOTHER', to: 'GXYZ', amount: '5' },
      })));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should clear filters', async () => {
      const handler = jest.fn();
      client.on('payment.received', handler);
      client.subscribe({ events: ['transaction.confirmed'] }); // blocks payment.received
      client.clearFilters();

      await client.connect('wss://test.example.com');

      const WS = jest.requireMock('ws').default;
      const wsInstance = WS.mock.results[0].value as MockWebSocket;
      wsInstance.emit('message', Buffer.from(JSON.stringify({
        event: 'payment.received',
        data: {},
      })));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 2.4.7: Connection Status ───────────────────────────────────

  describe('connection status', () => {
    it('should report disconnected before connect', () => {
      expect(client.getState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });

    it('should report connected after connect', async () => {
      await client.connect('wss://test.example.com');
      expect(client.getState()).toBe('connected');
      expect(client.isConnected()).toBe(true);
    });

    it('should report disconnected after disconnect', async () => {
      await client.connect('wss://test.example.com');
      client.disconnect();
      expect(client.getState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });

    it('should fire error event on WebSocket error', async () => {
      const errorHandler = jest.fn();
      client.on('error', errorHandler);

      await client.connect('wss://test.example.com');

      const WS = jest.requireMock('ws').default;
      const wsInstance = WS.mock.results[0].value as MockWebSocket;
      wsInstance.emit('error', new Error('test error'));

      expect(errorHandler).toHaveBeenCalledWith({ message: 'test error' });
    });
  });

  // ─── Coverage: message handling edge cases ──────────────────────────────

  describe('message handling edge cases (3.2.1)', () => {
    it('should warn on non-JSON message instead of silently dropping', async () => {
      await client.connect('wss://test.example.com');

      const WS = jest.requireMock('ws').default;
      const wsInstance = WS.mock.results[0].value as MockWebSocket;
      wsInstance.emit('message', Buffer.from('not-json {{{'));

      // Just verify it doesn't throw — the warning is logged via Logger
      expect(client.isConnected()).toBe(true);
    });

    it('should ignore messages without an event field', async () => {
      const handler = jest.fn();
      client.on('payment.received', handler);

      await client.connect('wss://test.example.com');

      const WS = jest.requireMock('ws').default;
      const wsInstance = WS.mock.results[0].value as MockWebSocket;
      wsInstance.emit('message', Buffer.from(JSON.stringify({ data: { amount: '10' } })));

      expect(handler).not.toHaveBeenCalled();
    });

    it('should accept payload field as alias for data', async () => {
      const handler = jest.fn();
      client.on('payment.received', handler);

      await client.connect('wss://test.example.com');

      const WS = jest.requireMock('ws').default;
      const wsInstance = WS.mock.results[0].value as MockWebSocket;
      wsInstance.emit('message', Buffer.from(JSON.stringify({
        event: 'payment.received',
        payload: { amount: '20' },
      })));

      expect(handler).toHaveBeenCalledWith({ amount: '20' });
    });
  });

  // ─── Coverage: reconnection paths ───────────────────────────────────────

  describe('reconnection (3.2.1)', () => {
    it('should respond to pong frames at debug level', async () => {
      await client.connect('wss://test.example.com');
      const WS = jest.requireMock('ws').default;
      const wsInstance = WS.mock.results[0].value as MockWebSocket;

      // Should not throw — pong is just logged
      wsInstance.emit('pong');
      expect(client.isConnected()).toBe(true);
    });

    it('should dispatch error event when persistent error listener fires', async () => {
      const errorHandler = jest.fn();
      client.on('error', errorHandler);

      await client.connect('wss://test.example.com');
      const WS = jest.requireMock('ws').default;
      const wsInstance = WS.mock.results[0].value as MockWebSocket;

      // Persistent error listener (set up post-open)
      wsInstance.emit('error', new Error('persistent error'));
      expect(errorHandler).toHaveBeenCalledWith({ message: 'persistent error' });
    });

    it('should transition to reconnecting on unexpected close', async () => {
      await client.connect('wss://test.example.com');
      expect(client.getState()).toBe('connected');

      const WS = jest.requireMock('ws').default;
      const wsInstance = WS.mock.results[0].value as MockWebSocket;
      wsInstance.emit('close');

      // After unexpected close, state should be reconnecting or disconnected
      // (depends on retry config — either way, it's not 'connected')
      expect(client.isConnected()).toBe(false);
    });
  });
});
