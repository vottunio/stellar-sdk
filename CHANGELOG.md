# Changelog

All notable changes to `@wirex/stellar-sdk` follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — Initial mainnet release

First production release of the Wirex Stellar SDK. Covers Phases 1–3 of the the grant.

### Modules

- **Wallet** — keypair, HD (BIP39 + SEP-0005), encrypted export, external adapters (Freighter, Lobstr), multisig support
- **Transaction** — fluent builder, idempotency-safe retry with full jitter, dynamic fee strategies (`low`/`medium`/`high`/`aggressive` via `/fee_stats`), network-aware timeouts
- **Stellar** — high-level helpers for accounts, assets/trustlines, payments, path payments, claimable balances, sponsored reserves, manage data
- **Soroban** — contract invocation + simulation, ScVal encoding/decoding for every primitive type, transaction preparation, error normalization
- **API Client** — Horizon REST (12 endpoints) + Soroban RPC (5 methods) + external partner factory, all returning standardized `ApiResponse<T>`
- **WebSocket** — Horizon SSE streaming with cursor persistence, plus a generic WebSocket client with auto-reconnect (exponential backoff, 30s cap) and heartbeat
- **Configuration** — testnet/mainnet presets, mainnet safety validator (testnet URLs blocked), network-aware default timeouts, hot-switching
- **Reference (Wirex)** — 5-step settlement flow (validate_source → validate_destination → check_trustline → send_payment → confirm) for XLM, USDC, EURC with full step observability

### Build & Distribution

- **Multi-format build**: ESM (`dist/esm/index.js`), CJS (`dist/cjs/index.cjs`), UMD (`dist/umd/wirex-sdk.umd.js`), TypeScript declarations (`dist/types/index.d.ts`)
- **Bundle sizes** (gzipped): ESM 36 KB, CJS 36 KB, UMD-minified 17 KB — all well below the 100 KB target
- **Tree-shakable**: `"sideEffects": false` declared; no top-level side effects in any source file (enforced by test suite)
- **CDN-ready**: `unpkg` and `jsdelivr` fields point to the UMD bundle
- **Provenance enabled** on npm publish

### Quality Assurance

- **499 unit tests** across 40 suites, coverage: 91.95% stmts / 84.98% branches / 94.86% funcs / 93.28% lines
- **26 end-to-end tests** across 6 suites running against live Stellar testnet
- **7 mainnet-ready integration tests** validating mainnet code paths (timeouts, fees, retry) against testnet
- **Performance benchmarks** verified live: API median 326–382ms, build+sign 705ms, full submit 4.8s
- **Static-analysis suite**: tree-shaking guard (65 tests), browser/RN compat guard (21 tests), bundle size budget (3 tests)
- **Security audit**: no secret/mnemonic/XDR leakage in error messages or logs (regression-tested)
- **Lint + typecheck**: 0 errors

### Documentation

- [Getting Started](docs/getting-started.md) — 5-minute onboarding from install to first confirmed payment
- [Module Guides](docs/modules/) — 7 deep-dive docs (wallet, transaction, stellar, api, websocket, config, reference) + index
- [Error Handling Guide](docs/error-handling.md) — full error code reference, recovery patterns, troubleshooting table
- [Migration Guide](docs/migration.md) — side-by-side with raw `@stellar/stellar-sdk` for 8 common use cases
- [Non-custodial Pattern](docs/non-custodial-pattern.md) — architecture for client-side signing
- [TypeDoc API Reference](docs/api/) — 2.3 MB auto-generated site for all public exports
- [12 runnable examples](examples/) — incl. `wirex-stellar-settlement.ts` (full off-chain ⇄ on-chain round-trip against Wirex sandbox)

### Highlights from Phase 3 (Mainnet Hardening)

- **3.1.1** Mainnet safety: testnet URL leakage blocked at config validation
- **3.1.2** Dynamic fee escalation via `/fee_stats` percentiles (4 strategies)
- **3.1.3** Sliding-window rate limiter respecting `Retry-After` (10-minute cap)
- **3.1.4** Error handling audit: typed-error guarantee across all modules
- **3.1.5** Security audit: zero secret leakage; eager input validation in TransactionBuilder
- **3.1.6** Network-aware timeouts (mainnet 60s Horizon vs testnet 30s)
- **3.1.7** Retry tuning: deterministic errors never retry; idempotency check via `getTransaction(hash)`; full-jitter backoff
- **3.1.8** Tree-shaking: `sideEffects: false` enforced by test
- **3.1.9** Bundle size budgets enforced
- **3.1.10** Browser compatibility: isomorphic base64 helper, no Node-only imports
- **3.1.11** React Native compatibility: `ensureSecureRandom()` polyfill probe with install instructions

---

[1.0.0]: https://github.com/vottunio/stellar-sdk/releases/tag/v1.0.0
