# @wirex/stellar-sdk

Modular, ecosystem-reusable SDK for the Stellar blockchain. Built by [Vottun](https://vottun.com) for [Wirex](https://wirexapp.com).

Simplifies development of payment-enabled applications and accelerates real-world adoption of Stellar.

## Features

- **Wallet Management** — Keypair creation, mnemonic import, HD wallets, Freighter/Lobstr adapters
- **Transaction Lifecycle** — Fluent builder API, fee estimation, submit with retry, status tracking
- **Stellar Interaction** — Account queries, payments, trustlines, path payments, Soroban smart contracts
- **API Client** — Horizon REST + Soroban JSON-RPC wrappers with standardized responses
- **WebSocket & Streaming** — Real-time events, auto-reconnection, Horizon SSE
- **Configuration** — Network presets (testnet/mainnet), hot-switching, timeouts, retry policies
- **Reference Integration** — Wirex payment flow orchestration (XLM, USDC, EURC)

## Installation

```bash
# pnpm (recommended)
pnpm add @wirex/stellar-sdk

# npm
npm install @wirex/stellar-sdk

# yarn
yarn add @wirex/stellar-sdk
```

## Quick Start

```typescript
import { WirexSDK } from '@wirex/stellar-sdk';

// Initialize SDK for testnet
const sdk = new WirexSDK({ network: 'testnet' });

// Access resolved config
console.log(sdk.config.horizonUrl);
// → "https://horizon-testnet.stellar.org"

// Hot-switch to mainnet
sdk.setNetwork('mainnet');
console.log(sdk.config.networkPassphrase);
// → "Public Global Stellar Network ; September 2015"
```

### Custom Configuration

```typescript
const sdk = new WirexSDK({
  network: 'testnet',
  horizonUrl: 'https://my-horizon.example.com',     // optional override
  sorobanRpcUrl: 'https://my-soroban.example.com',   // optional override
  logging: { level: 'debug' },
  timeout: { horizon: 60_000, api: 30_000, websocket: 15_000 },
  retry: { maxAttempts: 5, backoffMultiplier: 2 },
});
```

## Architecture

The SDK follows a modular design with seven specialized modules:

```
Configuration
    ↓
    ├── Wallet ← standalone, uses config for network
    ├── API Client ← uses config for Horizon/Soroban URLs
    │       ↓
    │   Stellar Client ← uses API Client for queries
    │       ↓
    │   Transaction ← uses Stellar Client + Wallet for signing
    ├── WebSocket ← uses config for streaming
    └── Reference Integration ← uses all of the above
```

## Project Structure

```
src/
├── index.ts              # WirexSDK main class
├── types/                # Shared TypeScript interfaces & enums
│   ├── config.types.ts   # SDK configuration types
│   ├── wallet.types.ts   # Wallet, Balance, HDWallet interfaces
│   ├── transaction.types.ts  # Transaction builder types
│   ├── stellar.types.ts  # Account, Ledger, Streaming types
│   ├── api.types.ts      # ApiResponse, ApiErrorCode, pagination
│   └── websocket.types.ts    # WebSocket events & subscriptions
├── errors/               # Typed error hierarchy
│   ├── StellarError.ts   # Base error class
│   ├── WalletError.ts    # Wallet-specific errors
│   ├── ApiError.ts       # API/network errors
│   └── ConfigError.ts    # Configuration validation errors
├── config/               # Configuration module
│   ├── ConfigManager.ts  # Config validation & resolution
│   ├── networks.ts       # Testnet/mainnet presets
│   └── defaults.ts       # Default timeout, retry, logging
├── wallet/               # Wallet module (Phase 1.2)
├── transaction/          # Transaction module (Phase 1.3)
├── stellar/              # Stellar interaction module (Phase 2.1-2.2)
├── api/                  # API client module (Phase 2.3)
├── websocket/            # WebSocket module (Phase 2.4)
└── reference/            # Reference integration module (Phase 2.5)
```

## Build Outputs

| Format | Target | File |
|--------|--------|------|
| ESM | Modern bundlers (Vite, webpack 5) | `dist/esm/index.js` |
| CJS | Node.js `require()` | `dist/cjs/index.cjs` |
| UMD | Browser `<script>` tag | `dist/umd/wirex-sdk.umd.js` |
| Types | TypeScript declarations | `dist/types/index.d.ts` |

## Development

### Prerequisites

- **Node.js** >= 18 (22 recommended)
- **pnpm** >= 9

### Setup

```bash
# Clone and install
git clone <repo-url>
cd wiredsdk
pnpm install
```

### Commands

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint
pnpm lint:fix

# Formatting
pnpm format:check
pnpm format

# Testing
pnpm test              # Run all tests
pnpm test:coverage     # Run with coverage report
pnpm test:watch        # Watch mode

# Building
pnpm build             # ESM + CJS + UMD + type declarations
pnpm clean             # Remove dist/ and coverage/
```

## Error Handling

All SDK errors extend `StellarError` with typed error codes:

```typescript
import { WirexSDK, ConfigError, WalletError, ApiError } from '@wirex/stellar-sdk';

try {
  const sdk = new WirexSDK({ network: 'invalid' as any });
} catch (error) {
  if (error instanceof ConfigError) {
    console.log(error.code);    // "CONFIG_INVALID_NETWORK"
    console.log(error.details); // { network: "invalid", validNetworks: [...] }
  }
}
```

### Error Hierarchy

| Class | Codes | Use Case |
|-------|-------|----------|
| `StellarError` | Base class | All SDK errors |
| `ConfigError` | `CONFIG_INVALID_NETWORK`, `CONFIG_INVALID_URL`, `CONFIG_INVALID_TIMEOUT`, etc. | Configuration validation |
| `WalletError` | `WALLET_INVALID_SECRET_KEY`, `WALLET_INVALID_MNEMONIC`, `WALLET_SIGNING_FAILED`, etc. | Wallet operations |
| `ApiError` | `NOT_FOUND`, `TIMEOUT`, `TX_FAILED`, `SIMULATION_FAILED`, etc. | API/network failures |

## Network Presets

| Parameter | Testnet | Mainnet |
|-----------|---------|---------|
| `horizonUrl` | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` |
| `sorobanRpcUrl` | `https://soroban-testnet.stellar.org` | `https://soroban.stellar.org` |
| `networkPassphrase` | `Test SDF Network ; September 2015` | `Public Global Stellar Network ; September 2015` |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript 5.4+ (strict mode) |
| Runtime | Node.js 18+, Browser ES2020+ |
| Stellar | `@stellar/stellar-sdk` 12+ |
| HTTP | `axios` 1.x |
| Crypto | `tweetnacl` (Ed25519), `bip39` + `ed25519-hd-key` (HD wallets) |
| Testing | Jest 29+ |
| Build | Rollup 4.x (ESM + CJS + UMD) |
| Package Manager | pnpm 9+ |

## Roadmap

- **Phase 1 (Weeks 1-5)**: MVP — Wallet, Transaction, Configuration modules
- **Phase 2 (Weeks 6-11)**: Testnet — Soroban, API Client, WebSocket, Reference Integration
- **Phase 3 (Weeks 12-16)**: Mainnet — Hardening, testing, documentation, release

## License

MIT

## Credits

Built by [Vottun](https://vottun.com) for [Wirex](https://wirexapp.com) with support from the [Stellar Community Fund](https://communityfund.stellar.org/).
