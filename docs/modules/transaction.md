# Transaction Module

Fluent builder API for constructing, signing, and submitting Stellar transactions. Accessed via `sdk.transaction(options)`.

## Builder Lifecycle

```
sdk.transaction({ sourceAccount })
  .addOperation(…)              ← one or more operations
  .addMemo(…)?                  ← optional
  .setFeeStrategy(…)?           ← optional dynamic fee
  .build()                      ← loads account + sequence from Horizon
  .sign(wallet)                 ← signs the XDR
  .submit()                     ← submits with idempotency-safe retry
```

Every step returns `this` for chaining; the entire flow can run inline.

## Supported Operations

| Method | Stellar Operation |
|---|---|
| `addPayment({destination, asset, amount})` | `payment` |
| `addCreateAccount({destination, startingBalance})` | `createAccount` |
| `changeTrust({asset, limit?})` | `changeTrust` |
| `addManageData({name, value?})` | `manageData` |
| `addPathPayment({sendAsset, sendAmount, destAsset, destMin, …})` | `pathPaymentStrictSend` |

For Soroban contract invocations, see [Stellar module](./stellar.md#soroban).

## Fee Strategies (3.1.2)

The builder supports four congestion-aware strategies that query Horizon's `/fee_stats`:

| Strategy | Percentile | Use When |
|---|---|---|
| `low` | p10 | Network is quiet; OK with slow confirmation |
| `medium` | p50 | Balanced (default on mainnet) |
| `high` | p90 | Need fast confirmation under moderate load |
| `aggressive` | p99 | Near-guaranteed inclusion under heavy congestion |

```ts
await sdk
  .transaction({ sourceAccount })
  .addPayment({ destination, asset: { code: 'XLM' }, amount: '10' })
  .setFeeStrategy('high')      // override the default
  .build()
  .then((b) => b.sign(wallet))
  .then((b) => b.submit());
```

On **mainnet**, the builder uses `medium` automatically when no fee is specified. On testnet, the network base fee is used.

```ts
// Suggest a strategy based on current network capacity
import { FeeEstimator } from '@wirex/stellar-sdk';
const est = new FeeEstimator(sdk.config);
const { strategy, capacityUsage } = await est.suggestStrategy();
// e.g. { strategy: 'medium', capacityUsage: 0.42 }
```

## Memo Types

```ts
.addMemo({ type: 'text',   value: 'Order #1234' })       // up to 28 chars UTF-8
.addMemo({ type: 'id',     value: '1234567890' })        // u64 as string
.addMemo({ type: 'hash',   value: '...' })               // 32-byte hash
.addMemo({ type: 'return', value: '...' })               // 32-byte refund hash
```

## Idempotency-Safe Retry (3.1.7)

The submitter **never retries deterministic errors** (`tx_bad_seq`, `tx_too_late`, `tx_insufficient_balance`, etc.) — re-submitting the same signed XDR with these codes is futile.

It **does retry** transient failures (5xx, 429, network timeouts) with **full-jitter exponential backoff**. On retry, it first calls `getTransaction(hash)` to check if a prior attempt already landed — Stellar dedupes by hash, so duplicate submissions are safe, but skipping the network round-trip is faster.

## Time Bounds

```ts
.setTimeout(180)                          // expires 180s after build()
.setTimeBounds(1717123200, 1717209600)    // explicit min/max UNIX timestamps
```

Default timeout is **30s on testnet**, **180s on mainnet** (configurable via `config.timeout.transactionSeconds`).

## Input Validation (3.1.5)

Every operation method validates inputs **eagerly** — bad addresses, malformed amounts, oversized asset codes, etc. throw a typed `StellarError` immediately, not at submission time.

| Validation | Rule |
|---|---|
| Address | `StrKey.isValidEd25519PublicKey(address)` |
| Amount | Positive decimal, ≤ 7 fractional digits |
| Asset code | 1–12 alphanumeric chars |
| Asset issuer | Valid Stellar public key (required for non-native) |
| Data name | 1–64 chars |

## Concurrent Reuse — Don't

A builder instance bakes in a sequence number at `build()` time. Submitting twice with the same builder will fail with `tx_bad_seq` on the second submission. **Always create a new `sdk.transaction()` per transaction.**

```ts
// ❌ DON'T
const builder = await sdk.transaction({ sourceAccount }).addPayment(…).build();
await builder.sign(wallet).then((b) => b.submit());
await builder.sign(wallet).then((b) => b.submit());  // tx_bad_seq

// ✅ DO
async function send(amount: string) {
  return sdk.transaction({ sourceAccount })
    .addPayment({ destination, asset: { code: 'XLM' }, amount })
    .build()
    .then((b) => b.sign(wallet))
    .then((b) => b.submit());
}
```

## TransactionTracker — Polling for Confirmation

```ts
import { TransactionTracker } from '@wirex/stellar-sdk';

const tracker = new TransactionTracker(sdk.config);
const conf = await tracker.waitForConfirmation(result.hash);
// { hash, status: 'confirmed', ledger, createdAt }
```

Useful when you've submitted a tx via raw `server.submitTransaction()` and want to wait for it to land.
