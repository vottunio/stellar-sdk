# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@wirex/stellar-sdk` is a modular, ecosystem-reusable SDK for the Stellar blockchain. Built by Vottun for Wirex as part of SCF #41 Grant ($129.6K, Build Track). It simplifies development of payment-enabled applications and accelerates real-world adoption of Stellar.

**Blockchain:** Stellar only (Horizon + Soroban RPC)

## Technical Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript 5.4+ (strict mode) |
| Runtime | Node.js 18+, Browser ES2020+ |
| Stellar | `@stellar/stellar-sdk` 11+ |
| HTTP | `axios` 1.x |
| Crypto | `tweetnacl` (Ed25519), `bip39` + `ed25519-hd-key` (HD wallets) |
| Testing | Jest 29+ |
| Build | Rollup 4.x (ESM + CJS + UMD) |
| Package Manager | pnpm 9+ |

## Architecture

The SDK follows a modular design with seven specialized modules:

### 1. Wallet Management Module (`src/wallet/`)
- Stellar keypair creation (`Keypair.random()`)
- Import from secret key or mnemonic (BIP44 path `m/44'/148'/{index}'`)
- HD wallet derivation with `bip39` + `ed25519-hd-key`
- External wallet adapters: Freighter, Lobstr
- Transaction signing interface
- Balance query shortcuts via Horizon

### 2. Stellar Blockchain Interaction Module (`src/stellar/`)
- Horizon client wrapper (`StellarClient`)
- Account queries, balances (XLM, USDC, EURC) via `AccountService`
- Asset and trustline management via `AssetService`
- Payments and path payments via `PaymentService`
- Soroban smart contract invocation via `SorobanService` (ScVal encoding/decoding, simulation, error normalization)
- Horizon SSE streaming via `StreamingService`

### 3. Transaction Lifecycle Module (`src/transaction/`)
- Transaction builder with fluent API (method-chaining)
- Operations: payment, createAccount, changeTrust, manageData, pathPayment
- Memo support (text, id, hash, return)
- Fee estimation via `server.fetchBaseFee()`
- Transaction signing and submission via Horizon
- Retry logic with exponential backoff on `tx_bad_seq` / timeout
- Status tracking via transaction hash polling

### 4. API Client Module (`src/api/`)
- Base HTTP client with axios interceptors, retry logic, error mapping
- Horizon REST API wrapper: accounts, transactions, operations, payments, effects, ledgers, assets, order book, trade aggregations, fee stats
- Soroban JSON-RPC wrapper: getHealth, getTransaction, getEvents, getLedgerEntries, getNetwork
- Standardized response model (`ApiResponse<T>`) across Horizon + Soroban
- Typed error mapping (Horizon HTTP errors + Soroban RPC errors → `ApiError`)
- Extensible external client factory for partners to connect their own backend APIs

### 5. WebSocket & Streaming Module (`src/websocket/`)
- WebSocket client: `ws` (Node) / native WebSocket (Browser)
- Auto-reconnection with exponential backoff
- Heartbeat (ping/pong keep-alive)
- Type-safe event subscription and routing
- Horizon SSE streaming for account/transaction events with cursor management

### 6. Configuration Module (`src/config/`)
- Network presets: testnet/mainnet (Horizon URLs, Soroban RPC URLs, network passphrases)
- Environment hot-switching (`setNetwork()`)
- Per-service timeouts (Horizon, API, WebSocket)
- Retry policies (max attempts, backoff multiplier)
- Logging levels: none, error, warn, info, debug

### 7. Reference Integration Module (`src/reference/`)
- Wirex payment flow orchestration (auth → build tx → sign → submit → track)
- On-chain settlement demos: XLM, USDC, EURC
- Non-custodial integration pattern (client-side signing, no server-side keys)

## Key Design Principles

- **Modular Architecture**: Each module operates independently for easier maintenance and evolution
- **Type Safety**: Strongly typed interfaces throughout to prevent runtime errors
- **Developer Experience**: Fluent APIs and intuitive method-chaining where applicable
- **Resilience**: Built-in retry logic, automatic reconnection, and error handling
- **Flexibility**: Support for both managed keypair wallets and external wallet providers (Freighter, Lobstr)
- **Environment Awareness**: Easy switching between testnet/mainnet environments
- **Ecosystem Reusable**: Designed as a general Stellar SDK, not coupled to Wirex internals

## Build Outputs

| Format | Target | File |
|--------|--------|------|
| ESM | Modern bundlers (Vite, webpack 5) | `dist/esm/index.js` |
| CJS | Node.js require() | `dist/cjs/index.cjs` |
| UMD | Browser `<script>` tag | `dist/umd/wirex-sdk.umd.js` |

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

## Development Roadmap

3 tranches, 16 weeks total. See [PLAN.md](PLAN.md) for detailed task breakdown.

- **Tranche 1 (Weeks 1-5)**: MVP — Wallet, Transaction, Configuration modules
- **Tranche 2 (Weeks 6-11)**: Testnet — Soroban, API Client, WebSocket, Reference Integration
- **Tranche 3 (Weeks 12-16)**: Mainnet — Hardening, testing, documentation, release

## Key Stellar Assets

| Asset | Code | Mainnet Issuer |
|-------|------|----------------|
| Lumens | XLM | Native |
| USD Coin | USDC | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| Euro Coin | EURC | `GDHU26QVJGZL7SXLEEC6PDB5UDDASLZSYXLN55YTIJAXHL6JRZA7W3NT` |
