# Config Module

Validates and stores SDK configuration. Accessed via `sdk.config` and `sdk.setNetwork(network)`.

## Minimal Config

```ts
new WirexSDK({ network: 'testnet' });   // or 'mainnet'
```

Everything else has production-grade defaults that differ between testnet and mainnet (3.1.6).

## Full Config Interface

```ts
interface WirexSDKConfig {
  network: 'testnet' | 'mainnet';

  // Optional URL overrides — leave undefined to use the network preset
  horizonUrl?: string;
  sorobanRpcUrl?: string;
  externalApiUrl?: string;

  logging?: { level: 'none' | 'error' | 'warn' | 'info' | 'debug' };

  timeout?: {
    horizon?: number;             // ms — REST call timeout
    api?: number;                 // ms — generic HTTP timeout
    websocket?: number;           // ms — WS connection establishment
    transactionSeconds?: number;  // seconds — Stellar tx mempool TTL
    soroban?: number;             // ms — Soroban RPC timeout
  };

  retry?: {
    maxAttempts?: number;         // default 3
    backoffMultiplier?: number;   // default 1.5
  };
}
```

## Network Presets

| Param | Testnet | Mainnet |
|---|---|---|
| `horizonUrl` | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` |
| `sorobanRpcUrl` | `https://soroban-testnet.stellar.org` | `https://soroban.stellar.org` |
| `networkPassphrase` | `Test SDF Network ; September 2015` | `Public Global Stellar Network ; September 2015` |

## Timeout Defaults (3.1.6)

Production-tuned per network — mainnet uses wider windows to tolerate congestion-induced latency:

| Field | Testnet | Mainnet | Rationale |
|---|---|---|---|
| `horizon` | 30s | **60s** | Mainnet p99 latency can hit 10s under load |
| `api` | 15s | **30s** | Generic HTTP — same reasoning |
| `websocket` | 10s | **15s** | Connection setup under load |
| `transactionSeconds` | 30 | **180** | Stellar best practice for mainnet mempool |
| `soroban` | 30s | **60s** | Contract simulations can be slow |

```ts
import { getDefaultTimeouts } from '@wirex/stellar-sdk';
const mainnetDefaults = getDefaultTimeouts('mainnet');
```

## Mainnet Safety (3.1.1)

The config validator **blocks** mainnet sessions from leaking testnet URLs:

```ts
new WirexSDK({
  network: 'mainnet',
  horizonUrl: 'https://horizon-testnet.stellar.org',  // ❌ Throws ConfigError
});
```

Blocked patterns: `testnet`, `friendbot`, `futurenet`, `sandbox` (case-insensitive). Calling `sdk.setNetwork('mainnet')` always resets URLs to the official mainnet preset, preventing leakage from a prior testnet session.

## Hot-Switching Networks

```ts
sdk.setNetwork('mainnet');
// All cached service instances are reset; the next call gets fresh clients.
```

## Logger

```ts
new WirexSDK({ network: 'testnet', logging: { level: 'debug' } });
```

| Level | Emits |
|---|---|
| `none` | Nothing |
| `error` | Errors only |
| `warn` | Errors + warnings (e.g. JSON parse failures, handler exceptions) |
| `info` | + lifecycle messages (network switches, settlements complete) |
| `debug` | + per-request HTTP, fee estimation details, cursor updates |

**Secrets never appear at any level.** The Logger does not auto-redact (it doesn't see secrets), but the SDK code itself never passes keys or signed XDRs into log statements — verified by [`tests/unit/security/no-secret-leakage.test.ts`](../../tests/unit/security/no-secret-leakage.test.ts).

## Retry Policy

```ts
retry: { maxAttempts: 3, backoffMultiplier: 1.5 }
```

Applies to:
- HTTP requests (via `ApiClient`)
- Transaction submissions (via `TransactionSubmitter`)
- WebSocket reconnection (via `ReconnectionManager`, capped at 30s)

The submitter uses **full jitter** to prevent thundering-herd retries after a Horizon hiccup, and only retries truly transient errors (5xx, 429, network/timeout). Deterministic Stellar errors (`tx_bad_seq`, `tx_too_late`, etc.) are never retried — see [transaction module](./transaction.md#idempotency-safe-retry-317).
