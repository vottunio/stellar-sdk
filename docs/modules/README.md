# Module Guides

Deep-dive documentation for each module in `@wirex/stellar-sdk`.

| Module | Surface | Guide |
|---|---|---|
| **Wallet** | `sdk.wallet.*` | [wallet.md](./wallet.md) |
| **Transaction** | `sdk.transaction(…)` | [transaction.md](./transaction.md) |
| **Stellar** | `sdk.stellar.*`, `sdk.soroban.*` | [stellar.md](./stellar.md) |
| **API Client** | `sdk.api.*` | [api.md](./api.md) |
| **WebSocket** | `sdk.websocket.*` | [websocket.md](./websocket.md) |
| **Config** | `sdk.config`, `sdk.setNetwork(…)` | [config.md](./config.md) |
| **Reference (Wirex settlement)** | `sdk.reference.*` | [reference.md](./reference.md) |

## Module Dependency Graph

```
        Configuration
              │
   ┌──────────┼──────────┐
   ▼          ▼          ▼
 Wallet    API Client   WebSocket
              │
              ▼
        Stellar Client
              │
              ▼
         Transaction
              │
              ▼
         Reference
```

Reading order recommendation:
1. **Config** — what every module depends on
2. **Wallet** — how you sign things
3. **Stellar** — the high-level operation surface most apps use
4. **Transaction** — when you need fine-grained control
5. **API Client** — for paginated history / market data / external backends
6. **WebSocket** — for custom realtime channels (Horizon SSE lives under Stellar)
7. **Reference** — full Wirex settlement flow in one call
