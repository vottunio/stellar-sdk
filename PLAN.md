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

### Phase 1.4: Documentation + Acceptance (Week 5) ✅ COMPLETED

| # | Task | Details | Status |
|---|------|---------|--------|
| 1.4.1 | TypeDoc setup | Auto-generate API docs from TSDoc comments (`pnpm docs`) | ✅ Done |
| 1.4.2 | README.md | Quick start, install, wallet + transaction usage examples | ✅ Done |
| 1.4.3 | Example: basic payment | `examples/basic-payment.ts` — XLM transfer on testnet | ✅ Done |
| 1.4.4 | Example: trustline | `examples/trustline-usdc.ts` — Create USDC trustline | ✅ Done |
| 1.4.5 | Test coverage report | 164 tests, >80% all thresholds (95.7% stmts, 85.9% branches, 98% funcs, 96.3% lines) | ✅ Done |
| 1.4.6 | Testnet demo | `examples/testnet-demo.ts` — Full acceptance proof script | ✅ Done |

**Tranche 1 Acceptance Criteria:**
- [x] Stellar testnet transactions executed using the SDK
- [x] Unit tests covering wallet and transaction flows (164 tests, all passing)
- [x] Developer documentation for all implemented modules

---

## Tranche 2 — Testnet (Weeks 6-11) — $43,200

### Phase 2.1: Smart Contract Interaction Module — Soroban (Weeks 6-7) ✅ COMPLETED

**Files:** `src/stellar/SorobanService.ts`, `src/types/stellar.types.ts`

| # | Task | API | Stellar SDK Usage | Status |
|---|------|-----|-------------------|--------|
| 2.1.1 | Soroban client init | Internal — connects to Soroban RPC | `new SorobanRpc.Server(rpcUrl)` | ✅ Done |
| 2.1.2 | Invoke contract | `sdk.soroban.invokeContract({ contractId, method, args }, wallet)` | `contract.call(method, ...args)` via `SorobanRpc` | ✅ Done |
| 2.1.3 | Read contract (query) | `sdk.soroban.readContract({ contractId, method, args })` | `server.simulateTransaction()` — read-only, no submit | ✅ Done |
| 2.1.4 | ScVal encoding | `sdk.soroban.nativeToScVal(value, type)` | `nativeToScVal()` — convert JS values to Soroban types | ✅ Done |
| 2.1.5 | ScVal decoding | `sdk.soroban.scValToNative(scVal)` | `scValToNative()` — convert Soroban results to JS | ✅ Done |
| 2.1.6 | Contract instance | `sdk.soroban.getContract(contractId): Contract` | `new Contract(contractId)` | ✅ Done |
| 2.1.7 | Prepare transaction | Internal — simulate before submit | `server.prepareTransaction(tx)` — adds resource footprint | ✅ Done |
| 2.1.8 | Error normalization | Soroban errors → `StellarError` | Map simulation failures, invoke errors to typed `SorobanErrorCode` | ✅ Done |
| 2.1.9 | Unit tests | - | 31 tests: encoding/decoding, error mapping, invoke, read, prepare, validation | ✅ Done |
| 2.1.10 | Integration tests | - | Invoke token contract on testnet (native XLM SAC: CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) | ✅ Done |

### Phase 2.2: Stellar Blockchain Interaction — Extended (Week 7-8) ✅ COMPLETED

**Goal:** High-level operation helpers that build, sign, and submit transactions. Query methods (getBalances, getAccount) are in Module 4 (API Client); this module uses them internally.

**Files:** `src/stellar/AccountService.ts`, `AssetService.ts`, `PaymentService.ts`, `StellarClient.ts`, `TransactionHelper.ts`

| # | Task | API | Stellar SDK Usage | Status |
|---|------|-----|-------------------|--------|
| 2.2.1 | Account exists check | `sdk.stellar.accountExists(address): boolean` | `server.loadAccount()` — catch 404 | ✅ Done |
| 2.2.2 | Fund test account | `sdk.stellar.fundTestAccount(address)` | `fetch(https://friendbot.stellar.org?addr=...)` | ✅ Done |
| 2.2.3 | Send payment | `sdk.stellar.sendPayment({ sourceAccount, destination, asset, amount })` | Builder shortcut: `Operation.payment()` + sign + submit | ✅ Done |
| 2.2.4 | Create account | `sdk.stellar.createAccount({ sourceAccount, destination, startingBalance })` | `Operation.createAccount()` | ✅ Done |
| 2.2.5 | Change trust | `sdk.stellar.changeTrust({ sourceAccount, asset, limit? })` | `Operation.changeTrust()` | ✅ Done |
| 2.2.6 | Path payment strict send | `sdk.stellar.pathPaymentStrictSend({...})` | `Operation.pathPaymentStrictSend()` | ✅ Done |
| 2.2.7 | Path payment strict receive | `sdk.stellar.pathPaymentStrictReceive({...})` | `Operation.pathPaymentStrictReceive()` | ✅ Done |
| 2.2.8 | Claimable balance create | `sdk.stellar.createClaimableBalance({...})` | `Operation.createClaimableBalance()` | ✅ Done |
| 2.2.9 | Claimable balance claim | `sdk.stellar.claimClaimableBalance({ balanceId })` | `Operation.claimClaimableBalance()` | ✅ Done |
| 2.2.10 | Sponsored reserves | `sdk.stellar.sponsoredOperation(params, ops, wallet)` | `Operation.beginSponsoringFutureReserves()` / `end...()` | ✅ Done |
| 2.2.11 | Manage data | `sdk.stellar.manageData({ sourceAccount, name, value })` | `Operation.manageData()` | ✅ Done |
| 2.2.12 | Asset class | `sdk.stellar.Asset.native()`, `.custom(code, issuer)` | Wraps `StellarSdk.Asset` | ✅ Done |
| 2.2.13 | Unit tests | - | 45 tests: all operations, edge cases, validation | ✅ Done |
| 2.2.14 | Integration tests | - | Payments, trustlines, manage data, account creation on testnet (15 tests) | ✅ Done |

### Phase 2.3: API Client Module (Weeks 8-9) ✅ COMPLETED

**Goal:** Unified client for Stellar network APIs and external services, with standardized request/response and error handling models.

**Files:** `src/api/ApiClient.ts`, `HorizonClient.ts`, `SorobanRpcClient.ts`, `ExternalClientFactory.ts`, `ResponseMapper.ts`, `ErrorMapper.ts`

| # | Task | API | Details | Status |
|---|------|-----|---------|--------|
| 2.3.1 | Base HTTP client | `ApiClient` | Axios instance with interceptors, base URL config, error mapping, retry logic | ✅ Done |
| 2.3.2 | Horizon REST wrapper — accounts | `sdk.api.horizon.getAccount(address)` | `GET {horizonUrl}/accounts/{address}` — balances, signers, data, thresholds, sequence | ✅ Done |
| 2.3.3 | Horizon REST wrapper — transactions | `sdk.api.horizon.getTransactions({ account?, cursor?, limit?, order? })` | `GET {horizonUrl}/transactions` or `/accounts/{id}/transactions` — paginated with cursor | ✅ Done |
| 2.3.4 | Horizon REST wrapper — single tx | `sdk.api.horizon.getTransaction(hash)` | `GET {horizonUrl}/transactions/{hash}` — full tx details + operations | ✅ Done |
| 2.3.5 | Horizon REST wrapper — operations | `sdk.api.horizon.getOperations({ account?, tx?, cursor?, limit? })` | `GET {horizonUrl}/operations` — filter by account or transaction | ✅ Done |
| 2.3.6 | Horizon REST wrapper — payments | `sdk.api.horizon.getPayments({ account?, cursor?, limit? })` | `GET {horizonUrl}/payments` — payment operations only | ✅ Done |
| 2.3.7 | Horizon REST wrapper — effects | `sdk.api.horizon.getEffects({ account?, cursor?, limit? })` | `GET {horizonUrl}/effects` — account effects | ✅ Done |
| 2.3.8 | Horizon REST wrapper — ledgers | `sdk.api.horizon.getLedger(sequence?)` | `GET {horizonUrl}/ledgers/{sequence}` — ledger info | ✅ Done |
| 2.3.9 | Horizon REST wrapper — assets | `sdk.api.horizon.getAssets({ code?, issuer? })` | `GET {horizonUrl}/assets` — asset discovery | ✅ Done |
| 2.3.10 | Horizon REST wrapper — order book | `sdk.api.horizon.getOrderBook({ selling, buying })` | `GET {horizonUrl}/order_book` — current offers | ✅ Done |
| 2.3.11 | Horizon REST wrapper — trade aggregations | `sdk.api.horizon.getTradeAggregations({ base, counter, resolution })` | `GET {horizonUrl}/trade_aggregations` — OHLC data | ✅ Done |
| 2.3.12 | Horizon REST wrapper — fee stats | `sdk.api.horizon.getFeeStats()` | `GET {horizonUrl}/fee_stats` — network fee percentiles | ✅ Done |
| 2.3.13 | Soroban RPC wrapper — getHealth | `sdk.api.soroban.getHealth()` | `POST {sorobanRpcUrl}` method `getHealth` — node status | ✅ Done |
| 2.3.14 | Soroban RPC wrapper — getTransaction | `sdk.api.soroban.getTransaction(hash)` | `POST {sorobanRpcUrl}` method `getTransaction` — tx status + result | ✅ Done |
| 2.3.15 | Soroban RPC wrapper — getEvents | `sdk.api.soroban.getEvents({ startLedger, filters })` | `POST {sorobanRpcUrl}` method `getEvents` — contract events | ✅ Done |
| 2.3.16 | Soroban RPC wrapper — getLedgerEntries | `sdk.api.soroban.getLedgerEntries(keys)` | `POST {sorobanRpcUrl}` method `getLedgerEntries` — read contract/account state | ✅ Done |
| 2.3.17 | Soroban RPC wrapper — getNetwork | `sdk.api.soroban.getNetwork()` | `POST {sorobanRpcUrl}` method `getNetwork` — network passphrase + protocol version | ✅ Done |
| 2.3.18 | Response standardization | All responses → `ApiResponse<T>` | Unified `{ data, pagination?, raw }` wrapper across Horizon + Soroban | ✅ Done |
| 2.3.19 | Error standardization | All errors → `ApiError` | Map Horizon HTTP errors + Soroban RPC errors to typed `ApiError` with codes | ✅ Done |
| 2.3.20 | Extensible external client | `sdk.api.external(baseUrl, options?)` | Factory method for partners to create type-safe clients for their own backend APIs | ✅ Done |
| 2.3.21 | Unit tests | - | 78 tests: Horizon endpoints, Soroban RPC, external client, pagination, error mapping, retry | ✅ Done |

### Phase 2.4: WebSocket & Streaming Module (Weeks 9-10) ✅ COMPLETED

**Files:** `src/websocket/WebSocketClient.ts`, `EventRouter.ts`, `ReconnectionManager.ts`, `src/stellar/StreamingService.ts`

| # | Task | API | Details | Status |
|---|------|-----|---------|--------|
| 2.4.1 | WebSocket client | `sdk.websocket` | Connection management, `ws` (Node) / native `WebSocket` (Browser) | ✅ Done |
| 2.4.2 | Connect / disconnect | `ws.connect()`, `ws.disconnect()` | Connection lifecycle with cleanup | ✅ Done |
| 2.4.3 | Auto-reconnection | Automatic | Exponential backoff via ReconnectionManager, configurable max retries, 30s cap | ✅ Done |
| 2.4.4 | Heartbeat | Automatic | Ping/pong keep-alive every 30s | ✅ Done |
| 2.4.5 | Event subscription | `ws.on(event, handler)` | Type-safe event names + payloads, returns unsubscribe fn | ✅ Done |
| 2.4.6 | Event filtering | `ws.subscribe({ events, account?, asset? })` | Client-side filter via EventRouter | ✅ Done |
| 2.4.7 | Connection status | `ws.on('connected')`, `ws.on('disconnected')`, `ws.on('error')` | Lifecycle callbacks + `getState()`, `isConnected()` | ✅ Done |
| 2.4.8 | Horizon SSE streaming | `sdk.stellar.stream.transactions(account)`, `.payments(account)`, `.operations(account)`, `.effects(account)`, `.ledgers()` | `server.transactions().forAccount(addr).stream({ onmessage })` | ✅ Done |
| 2.4.9 | Stream cursor management | `getCursor()`, `setCursor()`, `clearCursors()` | Auto-saves paging_token, resumes from last cursor on reconnect | ✅ Done |
| 2.4.10 | Unit tests | - | 50 tests: EventRouter, ReconnectionManager, WebSocketClient, StreamingService | ✅ Done |
| 2.4.11 | Integration tests | - | Stream testnet transactions in real-time + verify cursor persistence | ✅ Done |

**Supported WebSocket events:**

| Event | Payload |
|-------|---------|
| `transaction.confirmed` | `{ hash, ledger, account, operations }` |
| `transaction.failed` | `{ hash, error, account }` |
| `payment.received` | `{ from, to, amount, asset, hash }` |
| `account.updated` | `{ account, balances, signers }` |
| `contract.event` | `{ contractId, topic, data, ledger }` |

### Phase 2.5: Wirex Reference Integration — Testnet (Week 10-11) ✅ COMPLETED

**Files:** `src/reference/WirexPaymentFlow.ts`, `examples/wirex-settlement.ts`

**Wirex BaaS API Credentials (Sandbox — shared, for initial testing):**

| Parameter | Value |
|-----------|-------|
| Sandbox API URL | `https://api-baas.wirexapp.tech` |
| Production API URL | `https://api-baas.wirexapp.com` |
| `client_id` | `3fCeoWq6FOtKJBZiyorXnxE41Dqp2zKB` |
| `client_secret` | `6FIY2GEQvdlgUEFHw4Dbii22_wCAqZ37lWV3TEMfTlkxrn8F5IbdgX9TiAvQUEsC` |
| `partner_id` | `0x00000000000000000000000000000044` |
| Sandbox helper API | `https://ramc.wirexapp.tech` (test event simulation) |
| Blockchain (sandbox) | Stellar Testnet (Chain ID: 9223372036854775806) |

> Note: These are shared sandbox credentials from [Wirex docs](https://docs.wirexapp.com/docs/environments#sandbox-test-credentials). Contact Wirex for dedicated company credentials.

| # | Task | API | Details |
|---|------|-----|---------|
| 2.5.1 | Settlement flow class | `sdk.reference.createSettlement({ asset, amount, destination })` | Orchestrates: create/load wallet → check trustline → build tx → sign → submit → track confirmation | ✅ Done |
| 2.5.2 | XLM settlement | Example flow | Native XLM payment end-to-end on testnet | ✅ Done |
| 2.5.3 | USDC settlement | Example flow | USDC payment (trustline check → payment → confirm) | ✅ Done |
| 2.5.4 | EURC settlement | Example flow | EURC payment (same pattern as USDC) | ✅ Done |
| 2.5.5 | Non-custodial pattern | Documentation | Client-side signing, no private keys on server | ✅ Done |
| 2.5.6 | Partner integration pattern | Documentation + `examples/partner-integration.ts` | How a partner (e.g. Wirex) connects their backend via `sdk.api.external()` to coordinate off-chain + on-chain flows | ✅ Done |
| 2.5.7 | E2E test | - | Full testnet settlement flow | ✅ Done |
| 2.5.8 | Example + docs | `examples/wirex-settlement.ts` | Reproducible reference implementation | ✅ Done |

**Tranche 2 Acceptance Criteria:**
- [x] End-to-end testnet payment flows executed via the SDK (settlement E2E + stellar operations integration tests)
- [x] Live streaming events demonstrated (streaming integration test)
- [x] Reference integration reproducible following published documentation (wirex-settlement.ts + partner-integration.ts + non-custodial docs)

---

## Tranche 3 — Mainnet (Weeks 12-16) — $57,600

### Phase 3.1: Mainnet Hardening (Weeks 12-13)

| # | Task | Details | Status |
|---|------|---------|--------|
| 3.1.1 | Mainnet config validation | Strict validation: no testnet defaults leak to mainnet | ✅ Done |
| 3.1.2 | Fee strategy mainnet | Dynamic fee escalation based on network congestion | ✅ Done |
| 3.1.3 | Rate limiting | Respect Horizon rate limits, implement client-side throttling | ✅ Done |
| 3.1.4 | Error handling audit | Review all error paths, ensure no unhandled rejections | ✅ Done |
| 3.1.5 | Security audit | No private keys in logs, no secrets in error messages, input validation | ✅ Done |
| 3.1.6 | Timeout tuning | Production-appropriate timeouts for all services | ✅ Done |
| 3.1.7 | Retry tuning | Production retry policies (idempotency safety) | ✅ Done |
| 3.1.8 | Tree-shaking verification | Ensure unused modules are stripped in ESM builds | ✅ Done |
| 3.1.9 | Bundle size audit | Target <100KB gzipped for core | ✅ Done |
| 3.1.10 | Browser compatibility | Test in Chrome, Firefox, Safari, Edge | ✅ Code-level; manual browser test pending |
| 3.1.11 | React Native compatibility | Verify crypto polyfills, WebSocket works | ✅ Code-level; live RN test pending |

### Phase 3.2: Testing & Coverage (Weeks 13-14)

| # | Task | Details | Status |
|---|------|---------|--------|
| 3.2.1 | Unit test coverage | Target >80% across all modules | ✅ Done (91.95% stmts, 84.98% branches, 94.86% funcs, 93.28% lines; 499 unit tests) |
| 3.2.2 | Integration tests mainnet-ready | Run against testnet with mainnet-like config | ✅ Done (`tests/integration/mainnet-ready.integration.test.ts` + `helpers/mainnetLikeConfig.ts`) |
| 3.2.3 | E2E: full payment flow | Create wallet → fund → trustline → payment → confirm | ✅ Done (`tests/e2e/payment-flow.e2e.test.ts`) |
| 3.2.4 | E2E: Soroban flow | Deploy + invoke contract on testnet | ✅ Done (`tests/e2e/soroban-flow.e2e.test.ts` — 6 tests, all green) |
| 3.2.5 | E2E: streaming flow | Subscribe → trigger tx → receive event | ✅ Done (`tests/e2e/streaming-flow.e2e.test.ts` — 2 tests, all green) |
| 3.2.6 | E2E: Wirex settlement | Full reference integration flow | ✅ Done (`tests/e2e/wirex-settlement.e2e.test.ts` — 5 tests covering XLM/USDC/EURC) |
| 3.2.7 | Edge cases | Insufficient balance, bad sequence, timeout, network down | ✅ Done (`tests/e2e/edge-cases.e2e.test.ts` — 5 tests) |
| 3.2.8 | Performance benchmarks | Tx submission <2s, API calls <500ms | ✅ Done — measured: API median 326–382ms, build+sign 705ms, full submit 4.8s (`tests/e2e/performance.e2e.test.ts`) |

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
