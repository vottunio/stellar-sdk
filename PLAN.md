# Wirex Stellar SDK — Implementation Plan

## Package: `@wirex/stellar-sdk`

---

## Technical Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Language | TypeScript | 5.4+ | Type safety, DX |
| Runtime | Node.js 18+, Browser ES2020+ | - | Cross-platform |
| Stellar | `@stellar/stellar-sdk` | 11+ | Horizon + Soroban RPC |
| HTTP | `axios` | 1.x | REST client with interceptors |
| WebSocket | `ws` (Node) / native (Browser) | 8.x | Real-time events |
| Crypto | `tweetnacl` | 1.x | Ed25519 signing |
| HD Wallets | `bip39`, `ed25519-hd-key` | - | Mnemonic + BIP44 derivation |
| Testing | Jest | 29+ | Unit + integration tests |
| Build | Rollup | 4.x | ESM, CJS, UMD outputs |
| Package Manager | pnpm | 9+ | Workspaces, fast installs |
| Docs | TypeDoc | 0.25+ | Auto-generated API docs |
| Linting | ESLint + Prettier | - | Code quality |

### Output Formats

| Format | Target | File |
|--------|--------|------|
| ESM | Modern bundlers (Vite, webpack 5) | `dist/esm/index.js` |
| CJS | Node.js require() | `dist/cjs/index.cjs` |
| UMD | Browser `<script>` tag | `dist/umd/wirex-sdk.umd.js` |

---

## Project Structure

```
@wirex/stellar-sdk/
├── package.json
├── tsconfig.json
├── rollup.config.ts
├── jest.config.ts
├── src/
│   ├── index.ts                     # Main entry, WirexSDK class
│   ├── types/                       # Shared types & interfaces
│   │   ├── index.ts
│   │   ├── wallet.types.ts
│   │   ├── transaction.types.ts
│   │   ├── stellar.types.ts
│   │   ├── api.types.ts
│   │   ├── websocket.types.ts
│   │   └── config.types.ts
│   ├── errors/                      # Error classes
│   │   ├── index.ts
│   │   ├── StellarError.ts
│   │   ├── ApiError.ts
│   │   ├── WalletError.ts
│   │   └── ConfigError.ts
│   ├── config/                      # Module 6: Configuration
│   │   ├── index.ts
│   │   ├── ConfigManager.ts
│   │   ├── networks.ts              # Testnet/mainnet presets
│   │   └── defaults.ts
│   ├── wallet/                      # Module 1: Wallet Management
│   │   ├── index.ts
│   │   ├── WalletManager.ts
│   │   ├── KeypairWallet.ts
│   │   ├── HDWallet.ts
│   │   ├── ExternalWallet.ts        # Freighter/Lobstr adapter
│   │   └── WalletSigner.ts          # Signing interface
│   ├── stellar/                     # Module 2: Blockchain Interaction
│   │   ├── index.ts
│   │   ├── StellarClient.ts         # Horizon wrapper
│   │   ├── AccountService.ts        # Account queries, balances
│   │   ├── AssetService.ts          # Assets, trustlines
│   │   ├── PaymentService.ts        # Payments, path payments
│   │   ├── SorobanService.ts        # Smart contract invocations
│   │   └── StreamingService.ts      # Horizon SSE streaming
│   ├── transaction/                 # Module 3: Transaction Lifecycle
│   │   ├── index.ts
│   │   ├── TransactionBuilder.ts    # Fluent API builder
│   │   ├── TransactionSubmitter.ts  # Submit + retry logic
│   │   ├── FeeEstimator.ts
│   │   └── TransactionTracker.ts    # Status polling
│   ├── api/                         # Module 4: API Client
│   │   ├── index.ts
│   │   ├── ApiClient.ts             # Base HTTP client (axios, interceptors, retry)
│   │   ├── HorizonClient.ts         # Horizon REST API wrapper (accounts, txs, assets, ledgers)
│   │   ├── SorobanRpcClient.ts      # Soroban JSON-RPC wrapper (getHealth, getTransaction, getEvents)
│   │   ├── ResponseMapper.ts        # Standardize Horizon + Soroban responses → ApiResponse<T>
│   │   ├── ErrorMapper.ts           # Map Horizon/Soroban errors → typed ApiError
│   │   └── ExternalClientFactory.ts # Factory for partner backend API clients
│   ├── websocket/                   # Module 5: WebSocket & Streaming
│   │   ├── index.ts
│   │   ├── WebSocketClient.ts       # Connection management
│   │   ├── EventRouter.ts           # Type-safe event dispatch
│   │   └── ReconnectionManager.ts
│   └── reference/                   # Module 7: Wirex Reference Integration
│       ├── index.ts
│       └── WirexPaymentFlow.ts      # Settlement demo (XLM, USDC, EURC)
├── tests/
│   ├── unit/
│   │   ├── wallet/
│   │   ├── stellar/
│   │   ├── transaction/
│   │   ├── api/
│   │   ├── websocket/
│   │   └── config/
│   ├── integration/                 # Stellar Testnet tests
│   │   ├── wallet.integration.test.ts
│   │   ├── transaction.integration.test.ts
│   │   ├── soroban.integration.test.ts
│   │   └── streaming.integration.test.ts
│   └── e2e/                         # Full flow tests
│       └── payment-flow.e2e.test.ts
├── examples/
│   ├── basic-payment.ts
│   ├── trustline-usdc.ts
│   ├── soroban-contract.ts
│   └── wirex-settlement.ts
└── docs/
    └── old/                         # Archived proposals
```

---

## Tranche 1 — MVP (Weeks 1-5) — $28,800

### Phase 1.0: Project Setup (Week 1) ✅ COMPLETED

| # | Task | Details | Status |
|---|------|---------|--------|
| 1.0.1 | Init repo | `pnpm init`, `.gitignore`, `.editorconfig`, `.nvmrc` (Node 22) | ✅ Done |
| 1.0.2 | TypeScript config | `tsconfig.json` — strict mode, `ES2020` target, path aliases | ✅ Done |
| 1.0.3 | Rollup config | ESM + CJS + UMD builds, tree-shaking, source maps | ✅ Done |
| 1.0.4 | Jest config | `ts-jest`, coverage thresholds, test path patterns | ✅ Done |
| 1.0.5 | ESLint + Prettier | `@typescript-eslint`, import ordering, Prettier integration | ✅ Done |
| 1.0.6 | CI pipeline | GitHub Actions: lint, test, build on PR (Node 18/20/22 matrix) | ✅ Done |
| 1.0.7 | Core types | `src/types/` — shared interfaces, enums, base types (6 type files) | ✅ Done |
| 1.0.8 | Error framework | `StellarError`, `WalletError`, `ApiError`, `ConfigError` — typed error hierarchy with codes | ✅ Done |
| 1.0.9 | Entry point | `src/index.ts` — `WirexSDK` main class scaffold + `ConfigManager` bootstrap | ✅ Done |

### Phase 1.1: Configuration Module (Week 1-2)

**File:** `src/config/ConfigManager.ts`

| # | Task | API | Details | Status |
|---|------|-----|---------|--------|
| 1.1.1 | `ConfigManager` class | `new ConfigManager(options)` | Validates and stores SDK config | ✅ Done |
| 1.1.2 | Network presets | `networks.ts` | Testnet/mainnet defaults (Horizon URLs, passphrases, Soroban RPC) | ✅ Done |
| 1.1.3 | Environment switching | `config.setNetwork('testnet' \| 'mainnet')` | Hot-switch, re-initializes clients | ✅ Done |
| 1.1.4 | Logging setup | `config.logging.level` | `none`, `error`, `warn`, `info`, `debug` | ✅ Done |
| 1.1.5 | Timeout config | `config.timeout.horizon`, `.api`, `.websocket` | Per-service timeouts with defaults | ✅ Done |
| 1.1.6 | Retry policies | `config.retry.maxAttempts`, `.backoffMultiplier` | Exponential backoff settings | ✅ Done |
| 1.1.7 | Unit tests | - | Config validation, preset loading, env switching | ✅ Done |

**Config interface:**
```typescript
interface WirexSDKConfig {
  network: 'testnet' | 'mainnet';
  horizonUrl?: string;            // default per network
  sorobanRpcUrl?: string;         // default per network
  externalApiUrl?: string;        // optional partner backend URL
  logging?: { level: 'none' | 'error' | 'warn' | 'info' | 'debug' };
  timeout?: { horizon?: number; api?: number; websocket?: number };
  retry?: { maxAttempts?: number; backoffMultiplier?: number };
}
```

**Network presets:**
| Param | Testnet | Mainnet |
|-------|---------|---------|
| `horizonUrl` | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` |
| `sorobanRpcUrl` | `https://soroban-testnet.stellar.org` | `https://soroban.stellar.org` |
| `networkPassphrase` | `Test SDF Network ; September 2015` | `Public Global Stellar Network ; September 2015` |

### Phase 1.2: Wallet Management Module (Weeks 2-3)

**Files:** `src/wallet/`

| # | Task | API | Stellar SDK Usage | Status |
|---|------|-----|-------------------|--------|
| 1.2.1 | Keypair creation | `sdk.wallet.create(): Wallet` | `Keypair.random()` | ✅ Done |
| 1.2.2 | Import from secret | `sdk.wallet.importFromSecret(secret): Wallet` | `Keypair.fromSecret(secret)` | ✅ Done |
| 1.2.3 | Import from mnemonic | `sdk.wallet.importFromMnemonic(mnemonic, index?): Wallet` | `bip39` + `ed25519-hd-key` with path `m/44'/148'/{index}'` | ✅ Done |
| 1.2.4 | HD wallet derivation | `sdk.wallet.createHD(mnemonic?): HDWallet` | Generate mnemonic if not provided, derive accounts | ✅ Done |
| 1.2.5 | Get public key | `wallet.publicKey: string` | `keypair.publicKey()` | ✅ Done |
| 1.2.6 | Sign transaction | `wallet.sign(tx): SignedTransaction` | `transaction.sign(keypair)` | ✅ Done |
| 1.2.7 | External wallet: Freighter | `sdk.wallet.connectExternal('freighter'): ExternalWallet` | `@stellar/freighter-api` — `isConnected()`, `getPublicKey()`, `signTransaction()` | ✅ Done |
| 1.2.8 | External wallet: Lobstr | `sdk.wallet.connectExternal('lobstr'): ExternalWallet` | Lobstr signer API | ✅ Done |
| 1.2.9 | Multisig support | `wallet.addSigner(publicKey, weight)` | `Operation.setOptions({ signer })` | ✅ Done |
| 1.2.10 | Wallet backup/export | `wallet.exportMnemonic()`, `wallet.exportEncrypted(password)` | Encrypt secret key with password | ✅ Done |
| 1.2.11 | Balance query shortcut | `wallet.getBalances(): Balance[]` | `server.loadAccount(publicKey)` → `.balances` | ✅ Done |
| 1.2.12 | Unit tests | - | Creation, import, signing, derivation paths | ✅ Done |
| 1.2.13 | Integration tests | - | Create + fund on testnet via Friendbot | ✅ Done |

### Phase 1.3: Transaction Lifecycle Module (Weeks 3-4) ✅ COMPLETED

**Files:** `src/transaction/`

| # | Task | API | Stellar SDK Usage | Status |
|---|------|-----|-------------------|--------|
| 1.3.1 | TransactionBuilder | `sdk.transaction(): TxBuilder` | Wraps `new TransactionBuilder(account, { fee, networkPassphrase })` | ✅ Done |
| 1.3.2 | Add payment op | `.addPayment({ destination, asset, amount })` | `.addOperation(Operation.payment({...}))` | ✅ Done |
| 1.3.3 | Add create account | `.addCreateAccount({ destination, startingBalance })` | `.addOperation(Operation.createAccount({...}))` | ✅ Done |
| 1.3.4 | Add change trust | `.changeTrust({ asset, limit? })` | `.addOperation(Operation.changeTrust({...}))` | ✅ Done |
| 1.3.5 | Add manage data | `.addManageData({ name, value })` | `.addOperation(Operation.manageData({...}))` | ✅ Done |
| 1.3.6 | Add path payment | `.addPathPayment({ sendAsset, sendAmount, dest, destAsset, destMin })` | `.addOperation(Operation.pathPaymentStrictSend({...}))` | ✅ Done |
| 1.3.7 | Memo support | `.addMemo(type, value)` | `Memo.text()`, `Memo.id()`, `Memo.hash()`, `Memo.return()` | ✅ Done |
| 1.3.8 | Timeout / time bounds | `.setTimeout(seconds)`, `.setTimeBounds(min, max)` | `.setTimeout(seconds)` | ✅ Done |
| 1.3.9 | Fee estimation | `.estimateFees(): FeeEstimate` | `server.fetchBaseFee()` × operation count | ✅ Done |
| 1.3.10 | Build transaction | `.build(): BuiltTransaction` | `.build()` returns `Transaction` | ✅ Done |
| 1.3.11 | Sign | `.sign(wallet): SignedTransaction` | `transaction.sign(keypair)` | ✅ Done |
| 1.3.12 | Submit | `.submit(): TransactionResult` | `server.submitTransaction(tx)` | ✅ Done |
| 1.3.13 | Retry logic | Auto-retry on `tx_bad_seq`, timeout | Exponential backoff, max attempts from config | ✅ Done |
| 1.3.14 | Status tracking | `result.waitForConfirmation(): Promise<Confirmation>` | Poll `server.transactions().transaction(hash)` | ✅ Done |
| 1.3.15 | Fluent chain | `sdk.transaction().addPayment({...}).addMemo(...).sign(w).submit()` | Full method chaining | ✅ Done |
| 1.3.16 | Unit tests | - | Builder chain, fee calc, memo types | ✅ Done |
| 1.3.17 | Integration tests | - | Full testnet tx: create, sign, submit, confirm | ✅ Done |

### Phase 1.4: Documentation + Acceptance (Week 5)

| # | Task | Details |
|---|------|---------|
| 1.4.1 | TypeDoc setup | Auto-generate API docs from TSDoc comments |
| 1.4.2 | README.md | Quick start, install, basic usage examples |
| 1.4.3 | Example: basic payment | `examples/basic-payment.ts` — XLM transfer on testnet |
| 1.4.4 | Example: trustline | `examples/trustline-usdc.ts` — Create USDC trustline |
| 1.4.5 | Test coverage report | Ensure >80% for wallet + transaction modules |
| 1.4.6 | Testnet demo | Record successful testnet transactions as acceptance proof |

**Tranche 1 Acceptance Criteria:**
- [ ] Stellar testnet transactions executed using the SDK
- [ ] Unit tests covering wallet and transaction flows
- [ ] Developer documentation for all implemented modules

---

## Tranche 2 — Testnet (Weeks 6-11) — $43,200

### Phase 2.1: Smart Contract Interaction Module — Soroban (Weeks 6-7)

**Files:** `src/stellar/SorobanService.ts`

| # | Task | API | Stellar SDK Usage |
|---|------|-----|-------------------|
| 2.1.1 | Soroban client init | Internal — connects to Soroban RPC | `new SorobanRpc.Server(rpcUrl)` |
| 2.1.2 | Invoke contract | `sdk.stellar.invokeContract({ contractId, method, args })` | `contract.call(method, ...args)` via `SorobanRpc` |
| 2.1.3 | Read contract (query) | `sdk.stellar.readContract({ contractId, method, args })` | `server.simulateTransaction()` — read-only, no submit |
| 2.1.4 | ScVal encoding | `sdk.stellar.nativeToScVal(value, type)` | `nativeToScVal()` — convert JS values to Soroban types |
| 2.1.5 | ScVal decoding | `sdk.stellar.scValToNative(scVal)` | `scValToNative()` — convert Soroban results to JS |
| 2.1.6 | Contract instance | `sdk.stellar.getContract(contractId): Contract` | `new Contract(contractId)` |
| 2.1.7 | Prepare transaction | Internal — simulate before submit | `server.prepareTransaction(tx)` — adds resource footprint |
| 2.1.8 | Error normalization | Soroban errors → `StellarError` | Map simulation failures, invoke errors to typed codes |
| 2.1.9 | Unit tests | - | Encoding/decoding, error mapping |
| 2.1.10 | Integration tests | - | Invoke token contract on testnet |

### Phase 2.2: Stellar Blockchain Interaction — Extended (Week 7-8)

**Goal:** High-level operation helpers that build, sign, and submit transactions. Query methods (getBalances, getAccount) are in Module 4 (API Client); this module uses them internally.

**Files:** `src/stellar/AccountService.ts`, `AssetService.ts`, `PaymentService.ts`

| # | Task | API | Stellar SDK Usage |
|---|------|-----|-------------------|
| 2.2.1 | Account exists check | `sdk.stellar.accountExists(address): boolean` | Uses `sdk.api.horizon.getAccount()` — catch 404 |
| 2.2.2 | Fund test account | `sdk.stellar.fundTestAccount(address)` | `fetch(https://friendbot.stellar.org?addr=...)` |
| 2.2.3 | Send payment | `sdk.stellar.sendPayment({ from, to, asset, amount })` | Builder shortcut: `Operation.payment()` + sign + submit |
| 2.2.4 | Create account | `sdk.stellar.createAccount({ source, destination, startingBalance })` | `Operation.createAccount()` |
| 2.2.5 | Change trust | `sdk.stellar.changeTrust({ asset, limit? })` | `Operation.changeTrust()` |
| 2.2.6 | Path payment strict send | `sdk.stellar.pathPaymentStrictSend({...})` | `Operation.pathPaymentStrictSend()` |
| 2.2.7 | Path payment strict receive | `sdk.stellar.pathPaymentStrictReceive({...})` | `Operation.pathPaymentStrictReceive()` |
| 2.2.8 | Claimable balance create | `sdk.stellar.createClaimableBalance({...})` | `Operation.createClaimableBalance()` |
| 2.2.9 | Claimable balance claim | `sdk.stellar.claimClaimableBalance({ balanceId })` | `Operation.claimClaimableBalance()` |
| 2.2.10 | Sponsored reserves | `sdk.stellar.beginSponsoring()`, `endSponsoring()` | `Operation.beginSponsoringFutureReserves()` / `end...()` |
| 2.2.11 | Manage data | `sdk.stellar.manageData({ name, value })` | `Operation.manageData()` |
| 2.2.12 | Asset class | `sdk.stellar.Asset.native()`, `new Asset(code, issuer)` | Wraps `StellarSdk.Asset` |
| 2.2.13 | Unit tests | - | All operations, edge cases |
| 2.2.14 | Integration tests | - | Payments, trustlines on testnet |

### Phase 2.3: API Client Module (Weeks 8-9)

**Goal:** Unified client for Stellar network APIs and external services, with standardized request/response and error handling models.

**Files:** `src/api/`

| # | Task | API | Details |
|---|------|-----|---------|
| 2.3.1 | Base HTTP client | `ApiClient` | Axios instance with interceptors, base URL config, error mapping, retry logic |
| 2.3.2 | Horizon REST wrapper — accounts | `sdk.api.horizon.getAccount(address)` | `GET {horizonUrl}/accounts/{address}` — balances, signers, data, thresholds, sequence |
| 2.3.3 | Horizon REST wrapper — transactions | `sdk.api.horizon.getTransactions({ account?, cursor?, limit?, order? })` | `GET {horizonUrl}/transactions` or `/accounts/{id}/transactions` — paginated with cursor |
| 2.3.4 | Horizon REST wrapper — single tx | `sdk.api.horizon.getTransaction(hash)` | `GET {horizonUrl}/transactions/{hash}` — full tx details + operations |
| 2.3.5 | Horizon REST wrapper — operations | `sdk.api.horizon.getOperations({ account?, tx?, cursor?, limit? })` | `GET {horizonUrl}/operations` — filter by account or transaction |
| 2.3.6 | Horizon REST wrapper — payments | `sdk.api.horizon.getPayments({ account?, cursor?, limit? })` | `GET {horizonUrl}/payments` — payment operations only |
| 2.3.7 | Horizon REST wrapper — effects | `sdk.api.horizon.getEffects({ account?, cursor?, limit? })` | `GET {horizonUrl}/effects` — account effects |
| 2.3.8 | Horizon REST wrapper — ledgers | `sdk.api.horizon.getLedger(sequence?)` | `GET {horizonUrl}/ledgers/{sequence}` — ledger info |
| 2.3.9 | Horizon REST wrapper — assets | `sdk.api.horizon.getAssets({ code?, issuer? })` | `GET {horizonUrl}/assets` — asset discovery |
| 2.3.10 | Horizon REST wrapper — order book | `sdk.api.horizon.getOrderBook({ selling, buying })` | `GET {horizonUrl}/order_book` — current offers |
| 2.3.11 | Horizon REST wrapper — trade aggregations | `sdk.api.horizon.getTradeAggregations({ base, counter, resolution })` | `GET {horizonUrl}/trade_aggregations` — OHLC data |
| 2.3.12 | Horizon REST wrapper — fee stats | `sdk.api.horizon.getFeeStats()` | `GET {horizonUrl}/fee_stats` — network fee percentiles |
| 2.3.13 | Soroban RPC wrapper — getHealth | `sdk.api.soroban.getHealth()` | `POST {sorobanRpcUrl}` method `getHealth` — node status |
| 2.3.14 | Soroban RPC wrapper — getTransaction | `sdk.api.soroban.getTransaction(hash)` | `POST {sorobanRpcUrl}` method `getTransaction` — tx status + result |
| 2.3.15 | Soroban RPC wrapper — getEvents | `sdk.api.soroban.getEvents({ startLedger, filters })` | `POST {sorobanRpcUrl}` method `getEvents` — contract events |
| 2.3.16 | Soroban RPC wrapper — getLedgerEntries | `sdk.api.soroban.getLedgerEntries(keys)` | `POST {sorobanRpcUrl}` method `getLedgerEntries` — read contract/account state |
| 2.3.17 | Soroban RPC wrapper — getNetwork | `sdk.api.soroban.getNetwork()` | `POST {sorobanRpcUrl}` method `getNetwork` — network passphrase + protocol version |
| 2.3.18 | Response standardization | All responses → `ApiResponse<T>` | Unified `{ data, pagination?, raw }` wrapper across Horizon + Soroban |
| 2.3.19 | Error standardization | All errors → `ApiError` | Map Horizon HTTP errors + Soroban RPC errors to typed `ApiError` with codes |
| 2.3.20 | Extensible external client | `sdk.api.external(baseUrl, options?)` | Factory method for partners to create type-safe clients for their own backend APIs |
| 2.3.21 | Unit tests | - | Mock Horizon/Soroban responses, test pagination, error mapping, retry logic |

### Phase 2.4: WebSocket & Streaming Module (Weeks 9-10)

**Files:** `src/websocket/`

| # | Task | API | Details |
|---|------|-----|---------|
| 2.4.1 | WebSocket client | `sdk.websocket` | Connection management, `ws` (Node) / native `WebSocket` (Browser) |
| 2.4.2 | Connect / disconnect | `ws.connect()`, `ws.disconnect()` | Auth handshake on connect |
| 2.4.3 | Auto-reconnection | Automatic | Exponential backoff, configurable max retries |
| 2.4.4 | Heartbeat | Automatic | Ping/pong keep-alive |
| 2.4.5 | Event subscription | `ws.on(event, handler)` | Type-safe event names + payloads |
| 2.4.6 | Event filtering | `ws.subscribe({ events, account?, asset? })` | Server-side filter |
| 2.4.7 | Connection status | `ws.on('connected')`, `ws.on('disconnected')`, `ws.on('error')` | Lifecycle callbacks |
| 2.4.8 | Horizon SSE streaming | `sdk.stellar.stream.transactions(account)`, `.payments(account)` | `server.transactions().forAccount(addr).stream({ onmessage })` |
| 2.4.9 | Stream cursor management | Internal | Resume from last cursor on reconnect |
| 2.4.10 | Unit tests | - | Event routing, reconnection logic |
| 2.4.11 | Integration tests | - | Stream testnet transactions |

**Supported WebSocket events:**

| Event | Payload |
|-------|---------|
| `transaction.confirmed` | `{ hash, ledger, account, operations }` |
| `transaction.failed` | `{ hash, error, account }` |
| `payment.received` | `{ from, to, amount, asset, hash }` |
| `account.updated` | `{ account, balances, signers }` |
| `contract.event` | `{ contractId, topic, data, ledger }` |

### Phase 2.5: Wirex Reference Integration — Testnet (Week 10-11)

**Files:** `src/reference/WirexPaymentFlow.ts`, `examples/wirex-settlement.ts`

| # | Task | API | Details |
|---|------|-----|---------|
| 2.5.1 | Settlement flow class | `sdk.reference.createSettlement({ asset, amount, destination })` | Orchestrates: create/load wallet → check trustline → build tx → sign → submit → track confirmation |
| 2.5.2 | XLM settlement | Example flow | Native XLM payment end-to-end on testnet |
| 2.5.3 | USDC settlement | Example flow | USDC payment (trustline check → payment → confirm) |
| 2.5.4 | EURC settlement | Example flow | EURC payment (same pattern as USDC) |
| 2.5.5 | Non-custodial pattern | Documentation | Client-side signing, no private keys on server |
| 2.5.6 | Partner integration pattern | Documentation + `examples/partner-integration.ts` | How a partner (e.g. Wirex) connects their backend via `sdk.api.external()` to coordinate off-chain + on-chain flows |
| 2.5.7 | E2E test | - | Full testnet settlement flow |
| 2.5.8 | Example + docs | `examples/wirex-settlement.ts` | Reproducible reference implementation |

**Tranche 2 Acceptance Criteria:**
- [ ] End-to-end testnet payment flows executed via the SDK
- [ ] Live streaming events demonstrated
- [ ] Reference integration reproducible following published documentation

---

## Tranche 3 — Mainnet (Weeks 12-16) — $57,600

### Phase 3.1: Mainnet Hardening (Weeks 12-13)

| # | Task | Details |
|---|------|---------|
| 3.1.1 | Mainnet config validation | Strict validation: no testnet defaults leak to mainnet |
| 3.1.2 | Fee strategy mainnet | Dynamic fee escalation based on network congestion |
| 3.1.3 | Rate limiting | Respect Horizon rate limits, implement client-side throttling |
| 3.1.4 | Error handling audit | Review all error paths, ensure no unhandled rejections |
| 3.1.5 | Security audit | No private keys in logs, no secrets in error messages, input validation |
| 3.1.6 | Timeout tuning | Production-appropriate timeouts for all services |
| 3.1.7 | Retry tuning | Production retry policies (idempotency safety) |
| 3.1.8 | Tree-shaking verification | Ensure unused modules are stripped in ESM builds |
| 3.1.9 | Bundle size audit | Target <100KB gzipped for core |
| 3.1.10 | Browser compatibility | Test in Chrome, Firefox, Safari, Edge |
| 3.1.11 | React Native compatibility | Verify crypto polyfills, WebSocket works |

### Phase 3.2: Testing & Coverage (Weeks 13-14)

| # | Task | Details |
|---|------|---------|
| 3.2.1 | Unit test coverage | Target >80% across all modules |
| 3.2.2 | Integration tests mainnet-ready | Run against testnet with mainnet-like config |
| 3.2.3 | E2E: full payment flow | Create wallet → fund → trustline → payment → confirm |
| 3.2.4 | E2E: Soroban flow | Deploy + invoke contract on testnet |
| 3.2.5 | E2E: streaming flow | Subscribe → trigger tx → receive event |
| 3.2.6 | E2E: Wirex settlement | Full reference integration flow |
| 3.2.7 | Edge cases | Insufficient balance, bad sequence, timeout, network down |
| 3.2.8 | Performance benchmarks | Tx submission <2s, API calls <500ms |

### Phase 3.3: Documentation & Examples (Weeks 14-15)

| # | Task | Details |
|---|------|---------|
| 3.3.1 | TypeDoc generation | Full API reference for all public methods |
| 3.3.2 | Getting Started guide | Install → init → first transaction in 5 minutes |
| 3.3.3 | Module guides (×7) | One deep-dive doc per module |
| 3.3.4 | Code examples (10+) | Common use cases: payments, trustlines, Soroban, streaming, cards |
| 3.3.5 | Error handling guide | Common errors, troubleshooting |
| 3.3.6 | Migration guide | For users coming from raw `@stellar/stellar-sdk` |

### Phase 3.4: Release & User Testing (Weeks 15-16)

| # | Task | Details |
|---|------|---------|
| 3.4.1 | NPM publish setup | `@wirex/stellar-sdk`, scoped package, provenance |
| 3.4.2 | Semantic versioning | `1.0.0` initial release |
| 3.4.3 | CDN distribution | UMD build on jsdelivr/unpkg |
| 3.4.4 | Changelog | `CHANGELOG.md` with all features |
| 3.4.5 | Professional user testing | External developers test the SDK |
| 3.4.6 | Feedback incorporation | Fix issues from user testing |
| 3.4.7 | Final tagged release | `v1.0.0` — mainnet-ready |
| 3.4.8 | Mainnet transaction proof | Execute real mainnet transactions as acceptance proof |

**Tranche 3 Acceptance Criteria:**
- [ ] Successful mainnet transactions executed using the SDK
- [ ] Tagged mainnet SDK release published
- [ ] Professional user testing completed and documented

---

## Module Dependency Graph

```
Configuration (6)
    ↓
    ├── Wallet (1) ← standalone, uses config for network
    ├── API Client (4) ← uses config for Horizon/Soroban URLs, base HTTP layer
    │       ↓
    │   Stellar Client (2) ← uses API Client for Horizon/Soroban queries
    │       ↓
    │   Transaction (3) ← uses Stellar Client + Wallet for signing
    ├── WebSocket (5) ← uses config for Horizon streaming
    └── Reference (7) ← uses all of the above
```

**Build order:** Config → Wallet → API Client → Stellar → Transaction → WebSocket → Reference

---

## Parallelization Option (2 Developers)

The plan is designed for 1 developer but can be parallelized with 2 in Tranches 2 and 3. Phases and deliverables remain unchanged.

**Tranche 1 (1 dev):** Config → Wallet → Transaction is a linear dependency chain. Parallelizing would cause one dev to wait on the other. Better with 1 dev.

**Tranche 2 (2 devs):** The dependency graph splits into two independent branches:

| Weeks | Dev A | Dev B |
|-------|-------|-------|
| 6-7 | Phase 2.1 — Soroban | Phase 2.3 — API Client |
| 7-8 | Phase 2.2 — Stellar Extended | Phase 2.4 — WebSocket & Streaming |
| 10-11 | Phase 2.5 — Reference Integration (both) | |

This works because Soroban/Stellar and API Client/WebSocket are independent branches of the module dependency graph. With 2 devs, Tranche 2 can compress from 6 to ~4 weeks.

**Tranche 3 (2 devs):** Hardening, testing, documentation, and examples are largely independent tasks and can be split freely between developers.

---

## Key Assets on Stellar

| Asset | Code | Testnet Issuer | Mainnet Issuer |
|-------|------|----------------|----------------|
| Lumens | XLM | Native | Native |
| USD Coin | USDC | (Circle testnet) | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| Euro Coin | EURC | (Circle testnet) | `GDHU26QVJGZL7SXLEEC6PDB5UDDASLZSYXLN55YTIJAXHL6JRZA7W3NT` |
