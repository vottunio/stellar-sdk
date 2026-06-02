# WebSocket Module

Real-time event streaming over WebSocket. Accessed via `sdk.websocket`.

## When to Use

- **Horizon-only events** (transactions, payments, ledgers, effects): prefer `sdk.stellar.stream.*` — it uses SSE which works natively in every JS runtime, no polyfill needed.
- **Custom WebSocket servers** (Wirex BaaS notifications, your own backend's WS push channel): use `sdk.websocket`.

## Runtime Requirements

- **Node.js**: ships with the `ws` package as a peer dep — works out of the box
- **Browser / React Native**: requires bundler aliasing of `ws` to the platform's native `WebSocket` global. Vite and webpack 5 handle this automatically via the `browser` field in `ws`'s package.json. If yours doesn't, add `'ws': 'isomorphic-ws'` to your bundler aliases.

## API Surface

```ts
const ws = sdk.websocket;

ws.connect(url: string): Promise<void>
ws.disconnect(): void
ws.isConnected(): boolean
ws.getState(): 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

ws.on(event, handler): () => void       // returns unsubscribe
ws.off(event?): void                    // remove handler(s)

ws.subscribe(filter): void              // server-side event filtering
ws.clearFilters(): void
```

## Events

| Event | Payload |
|---|---|
| `connected` | — |
| `disconnected` | — |
| `error` | `{ message }` |
| `transaction.confirmed` | `{ hash, ledger, account, operations }` |
| `transaction.failed` | `{ hash, error, account }` |
| `payment.received` | `{ from, to, amount, asset, hash }` |
| `account.updated` | `{ account, balances, signers }` |
| `contract.event` | `{ contractId, topic, data, ledger }` |

## Examples

### Basic

```ts
const ws = sdk.websocket;

ws.on('connected', () => console.log('Live'));
ws.on('disconnected', () => console.log('Lost connection — auto-reconnecting'));
ws.on('error', (err) => console.error(err));

ws.on('payment.received', (p) => {
  console.log(`Got ${p.amount} ${p.asset.code} from ${p.from}`);
});

await ws.connect('wss://api-baas.wirexapp.tech/ws');
```

### Event Filtering

Server-side filters reduce noise:

```ts
ws.subscribe({
  events: ['payment.received', 'transaction.confirmed'],
  account: myWallet.publicKey,
  asset: 'USDC',
});
```

Multiple `subscribe()` calls OR together. Use `clearFilters()` to reset.

### Auto-Reconnection (3.1.4)

The client automatically reconnects after unexpected disconnects using **exponential backoff capped at 30s**, with the same `maxAttempts` from `config.retry`. The `disconnect()` call is treated as intentional and prevents reconnection.

If the server closes the connection or a heartbeat ping fails, the client transitions through `reconnecting → connected` (or `disconnected` after exhausting attempts) and fires the corresponding events.

### Heartbeat

A 30-second ping/pong keep-alive runs automatically. If the ping fails (e.g. socket in a weird state), the heartbeat stops and the next `close` event drives recovery — no risk of an infinite-recursion loop.

## Connection State Machine

```
        connect()
  ┌──────────────────► connecting ──open──► connected
  │                                            │
  │                                            │ close / error
  │                                            ▼
  └─────reconnecting ◄──── (backoff schedule) ┘
            │
            │  scheduled retries exhausted
            ▼
       disconnected
```

## Error Handling

WebSocket-level errors fire the `error` event and are also logged. JSON parse failures on incoming messages log at `warn` level (with truncated raw payload) — they no longer silently drop, so protocol issues are visible.

Handler exceptions are caught and logged at `warn`; one bad handler doesn't break others (3.1.4 fix).
