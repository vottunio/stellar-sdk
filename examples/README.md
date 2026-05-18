# Examples

Twelve runnable examples covering common `@wirex/stellar-sdk` use cases. All examples run against Stellar testnet and require no setup beyond `pnpm install`.

| # | File | What it shows |
|---|------|---------------|
| 1 | [basic-payment.ts](./basic-payment.ts) | Create two wallets, fund via Friendbot, send 10 XLM |
| 2 | [trustline-usdc.ts](./trustline-usdc.ts) | Open a USDC trustline and verify on-chain |
| 3 | [testnet-demo.ts](./testnet-demo.ts) | Phase 1 acceptance demo — wallet + tx full flow |
| 4 | [phase-2.2-demo.ts](./phase-2.2-demo.ts) | Stellar operations (createAccount, manageData, claimable balances) |
| 5 | [phase-2.3-demo.ts](./phase-2.3-demo.ts) | API client — Horizon REST + Soroban RPC + external clients |
| 6 | [partner-integration.ts](./partner-integration.ts) | Generic partner-BaaS integration pattern via `sdk.api.external()` |
| 7 | [wirex-settlement.ts](./wirex-settlement.ts) | `sdk.reference.createSettlement(...)` for XLM, USDC, EURC |
| 8 | [wirex-baas-full-flow.ts](./wirex-baas-full-flow.ts) | Wirex BaaS × Stellar — parallel demo of both surfaces (no data exchange) |
| 9 | [hd-wallet-derivation.ts](./hd-wallet-derivation.ts) | BIP39 + SEP-0005 HD wallet — derive 5 accounts from one mnemonic |
| 10 | [path-payment-conversion.ts](./path-payment-conversion.ts) | Pay USDC by sending XLM via the Stellar DEX (`pathPaymentStrictSend`) |
| 11 | [dynamic-fee-strategy.ts](./dynamic-fee-strategy.ts) | Inspect `/fee_stats`, compare `low/medium/high/aggressive` strategies |
| 12 | **[wirex-stellar-settlement.ts](./wirex-stellar-settlement.ts)** | **Realistic Wirex ⇄ Stellar round-trip: off-chain instruction → on-chain anchor → settlement → SSE confirmation → tamper-proof verifier** |

## Running an Example

```bash
nvm use 22                # or any Node 18+
pnpm install
npx ts-node examples/basic-payment.ts
```

All examples are idempotent — they create fresh accounts each run, so re-runs don't conflict.

## Recommended Reading Order

1. **basic-payment** — the smallest possible end-to-end Stellar transaction
2. **trustline-usdc** — non-native assets and how trustlines work
3. **hd-wallet-derivation** — managing multiple accounts from one seed
4. **dynamic-fee-strategy** — production fee handling under network load
5. **wirex-settlement** — full reference settlement flow in one call
6. **wirex-baas-full-flow** — connecting an external BaaS to Stellar in one coherent example

## Things Every Example Does

- Uses **testnet** (no real XLM at risk)
- Creates **non-custodial** wallets (keys never leave the example process)
- Fetches funding via **Friendbot** (free testnet XLM)
- Surfaces typed errors via `StellarError` / `ApiError`
