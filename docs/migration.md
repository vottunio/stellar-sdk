# Migration Guide

A side-by-side comparison for developers coming from raw [`@stellar/stellar-sdk`](https://www.npmjs.com/package/@stellar/stellar-sdk).

The Wirex SDK **wraps** `@stellar/stellar-sdk` — it doesn't replace it. Every Stellar primitive (`Keypair`, `Asset`, `Operation`, `xdr`, `StrKey`, `Networks`) is re-exported and available unchanged. What this SDK adds is **higher-level orchestration**: fluent builder, network-aware defaults, retry-with-jitter, rate limiting, dynamic fee estimation, idempotency-safe submission, mainnet safety, structured errors, and reference flows.

---

## Quick Reference

| Task | Raw `@stellar/stellar-sdk` | `@wirex/stellar-sdk` |
|---|---|---|
| Initialise | `new Horizon.Server(url)` per service | One `new WirexSDK({ network })` |
| Generate wallet | `Keypair.random()` | `sdk.wallet.create()` (same keypair, plus `getBalances()`, `exportEncrypted()`) |
| HD wallet | `bip39` + `ed25519-hd-key` manually | `sdk.wallet.createHD()` |
| Build a payment | 8-line `new TransactionBuilder(...)` | 1-line fluent chain |
| Submit | `server.submitTransaction(tx)` + manual retry | `.submit()` with idempotency + jitter |
| Read fee_stats | `server.feeStats()` + manual parse | `estimator.suggestStrategy()` |
| Error handling | `try { catch { e.response?.data?.extras?.result_codes?.transaction }` | `err instanceof ApiError && err.code === ApiErrorCode.TX_BAD_SEQ` |
| Stream events | Manual `server.transactions().stream({ onmessage, onerror })` with cursor mgmt | `sdk.stellar.stream.transactions(addr, fn)` with auto-saved cursors |
| Mainnet safety | Manual URL inspection | Automatic — testnet URLs blocked at config time |

---

## Initialization

### Before

```ts
import { Horizon, SorobanRpc, Networks } from '@stellar/stellar-sdk';

const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
const soroban = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
const networkPassphrase = Networks.TESTNET;
// ... and remember to redo this for mainnet
```

### After

```ts
import { WirexSDK } from '@wirex/stellar-sdk';

const sdk = new WirexSDK({ network: 'testnet' });
// sdk.config.horizonUrl, sdk.config.sorobanRpcUrl, sdk.config.networkPassphrase
// are all set automatically. Switch to mainnet by changing one string.
```

You can still drop down to raw Horizon if needed:

```ts
const horizon = new Horizon.Server(sdk.config.horizonUrl);
```

---

## Wallet

### Before

```ts
import { Keypair } from '@stellar/stellar-sdk';

const kp = Keypair.random();
const pubkey = kp.publicKey();
const secret = kp.secret();

// To get balances:
const horizon = new Horizon.Server(url);
const account = await horizon.loadAccount(pubkey);
const balances = account.balances;
```

### After

```ts
const wallet = sdk.wallet.create();
wallet.publicKey;                              // G...
wallet.exportSecret();                         // S...
await wallet.getBalances();                    // structured Balance[]
```

The wallet also has `sign(xdr, passphrase)`, `addSigner(pk, weight)`, and `exportEncrypted(password)` — none of which exist in the raw SDK.

---

## HD Wallet

### Before

```ts
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@stellar/stellar-sdk';

const mnemonic = bip39.generateMnemonic(256);
const seed = bip39.mnemonicToSeedSync(mnemonic);
const { key } = derivePath("m/44'/148'/0'", seed.toString('hex'));
const kp = Keypair.fromRawEd25519Seed(key);
```

### After

```ts
const hd = sdk.wallet.createHD();
hd.publicKey;                                  // account[0]
hd.deriveAccount(1);                           // account[1]
hd.exportMnemonic();
```

---

## Build & Submit a Payment

### Before

```ts
import {
  Asset,
  Horizon,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
const sourceAccount = await horizon.loadAccount(sourcePubKey);
const baseFee = await horizon.fetchBaseFee();

const tx = new TransactionBuilder(sourceAccount, {
  fee: String(baseFee),
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(Operation.payment({
    destination: destPubKey,
    asset: Asset.native(),
    amount: '10',
  }))
  .addMemo(Memo.text('Hello'))
  .setTimeout(30)
  .build();

tx.sign(sourceKeypair);

try {
  const result = await horizon.submitTransaction(tx);
  console.log(result.hash);
} catch (err) {
  const txCode = (err as any).response?.data?.extras?.result_codes?.transaction;
  if (txCode === 'tx_bad_seq') {
    // manually reload account and rebuild
  } else if (...)
}
```

### After

```ts
const result = await sdk
  .transaction({ sourceAccount: sourcePubKey })
  .addPayment({
    destination: destPubKey,
    asset: { code: 'XLM' },
    amount: '10',
  })
  .addMemo({ type: 'text', value: 'Hello' })
  .build()
  .then((b) => b.sign(sourceWallet))
  .then((b) => b.submit());

console.log(result.hash);
```

That's it. The `submit()` handles:
- Retry with full jitter for transient errors (3.1.7)
- Idempotency check via `getTransaction(hash)` on retry
- Skip retry for deterministic errors (`tx_bad_seq`, `tx_too_late`, etc.)
- Typed `ApiError` instead of raw axios shape

---

## Fees

### Before

```ts
const stats = await horizon.feeStats();
const fee = stats.fee_charged.p50;             // medium percentile
const tx = new TransactionBuilder(account, { fee, networkPassphrase });
// ... + manual per-op multiplication if multiple ops
```

### After

```ts
// Option 1 — explicit strategy
await sdk.transaction(...).setFeeStrategy('high').build();

// Option 2 — auto (mainnet default = 'medium', testnet = base fee)
await sdk.transaction(...).build();

// Option 3 — inspect current network capacity & let the SDK pick
import { FeeEstimator } from '@wirex/stellar-sdk';
const { strategy } = await new FeeEstimator(sdk.config).suggestStrategy();
await sdk.transaction(...).setFeeStrategy(strategy).build();
```

Strategies map to `/fee_stats` percentiles:
- `low` → p10
- `medium` → p50 (mainnet default)
- `high` → p90
- `aggressive` → p99

---

## Streaming

### Before

```ts
let lastCursor = loadCursorFromDisk();          // your own persistence

const close = horizon.transactions()
  .forAccount(addr)
  .cursor(lastCursor || 'now')
  .stream({
    onmessage: (tx) => {
      lastCursor = tx.paging_token;
      saveCursorToDisk(lastCursor);             // your own persistence
      handler(tx);
    },
    onerror: (err) => {
      console.error(err);
      // your own reconnection logic
    },
  });
```

### After

```ts
const close = sdk.stellar.stream.transactions(addr, handler);
// Cursors auto-saved in-memory by the StreamingService.
// Resume: simply call again with the same address.
```

For WebSocket-based custom servers (not Horizon SSE):

```ts
const ws = sdk.websocket;
ws.on('connected', () => console.log('Live'));
ws.on('payment.received', (p) => handler(p));
await ws.connect('wss://your-server.example/ws');
// Auto-reconnection with exponential backoff is built-in (3.1.4)
```

---

## Trustlines and USDC

### Before

```ts
const usdc = new Asset('USDC', USDC_ISSUER);

const tx = new TransactionBuilder(account, { fee, networkPassphrase })
  .addOperation(Operation.changeTrust({ asset: usdc }))
  .setTimeout(30)
  .build();
tx.sign(keypair);
await horizon.submitTransaction(tx);
```

### After

```ts
await sdk.stellar.changeTrust(
  { sourceAccount: addr, asset: { code: 'USDC', issuer: USDC_ISSUER } },
  wallet,
);
```

---

## Soroban Contracts

### Before

```ts
import { Contract, SorobanRpc, nativeToScVal, scValToNative } from '@stellar/stellar-sdk';

const server = new SorobanRpc.Server(url);
const contract = new Contract(contractId);
const account = await server.getAccount(sourceAccount);

const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase })
  .addOperation(contract.call('balance', nativeToScVal(addr, { type: 'address' })))
  .setTimeout(30)
  .build();

const sim = await server.simulateTransaction(tx);
// ... manually parse simulation result
```

### After

```ts
const result = await sdk.soroban.readContract({
  contractId,
  method: 'balance',
  args: [sdk.soroban.nativeToScVal(addr, 'address')],
  sourceAccount: addr,
});
console.log(result.returnValue);                // already decoded
```

For invocations:

```ts
const result = await sdk.soroban.invokeContract(
  { contractId, method: 'transfer', args: [/* ScVal[] */], sourceAccount },
  wallet,
);
// Auto: simulate → prepare → sign → submit → poll for SUCCESS
```

---

## Error Handling

### Before

```ts
try {
  await horizon.submitTransaction(tx);
} catch (err) {
  const isAxios = err && typeof err === 'object' && 'response' in err;
  if (isAxios) {
    const status = (err as any).response?.status;
    const txCode = (err as any).response?.data?.extras?.result_codes?.transaction;
    const opCodes = (err as any).response?.data?.extras?.result_codes?.operations;
    // ... custom mapping
  }
}
```

### After

```ts
import { ApiError, ApiErrorCode } from '@wirex/stellar-sdk';

try {
  await builder.submit();
} catch (err) {
  if (err instanceof ApiError) {
    switch (err.code) {
      case ApiErrorCode.TX_INSUFFICIENT_BALANCE: /* ... */ break;
      case ApiErrorCode.TX_BAD_SEQ: /* ... */ break;
      case ApiErrorCode.RATE_LIMITED: /* ... */ break;
    }
    // err.statusCode, err.endpoint, err.details all available
  }
}
```

See the [error handling guide](./error-handling.md) for the full code table.

---

## What You DON'T Have to Migrate

These are passed through unchanged — the Wirex SDK re-exports the entire `@stellar/stellar-sdk` namespace where needed:

- `Keypair`, `Asset`, `Networks`, `StrKey`
- `Operation.*` builders
- `Memo.*` constructors
- All `xdr.*` types
- The raw `Horizon.Server` and `SorobanRpc.Server` classes (accessible via `sdk.config.horizonUrl`)

So you can mix and match — use the high-level API for 90% of your code, drop down to raw Stellar primitives where you need exotic operations (Soroban auth chains, multi-sig accounts, etc.).

---

## Step-by-Step Migration Plan

1. **Install** the SDK: `pnpm add @wirex/stellar-sdk` (you can keep `@stellar/stellar-sdk` — it's a peer dep)
2. **Replace** `new Horizon.Server(...)` with `new WirexSDK({ network })` at app initialization
3. **Replace** wallet creation/import calls (`Keypair.random()` etc.) with `sdk.wallet.*` — keep all `Keypair.fromSecret(...)` if you have existing flows
4. **Migrate one payment flow** to the fluent builder; test it works end-to-end
5. **Migrate streaming** if you use it — the cursor management alone often saves dozens of lines
6. **Migrate error handling** — switch from axios-shape inspection to `instanceof` + `code`
7. **Enable mainnet** — flip `network: 'mainnet'`; the SDK applies production-grade defaults automatically (60s timeouts, dynamic fees, retry-with-jitter)
8. **Optional**: adopt `sdk.reference.createSettlement(...)` if you're building a payment app — it bundles validate → trustline → pay → confirm into one call

---

## Common Migration Gotchas

| Gotcha | What happened | Fix |
|---|---|---|
| `Builder is not callable` on retry | Reused a `WirexTransactionBuilder` for a second submission | Create a new `sdk.transaction(...)` per submission — never reuse |
| Memo type mismatch | Old: `Memo.text('Hello')`. New: `{ type: 'text', value: 'Hello' }` | Use the object shape; `Memo.*` classes still work if you pass them via raw operations |
| Fee suddenly higher on mainnet | Mainnet defaults to dynamic fee at `medium` percentile | Pass `setFeeStrategy('low')` if you want testnet behaviour back |
| Streaming events stop after disconnect | You expected auto-resume on reconnect | Re-call `sdk.stellar.stream.transactions(addr, fn)` — cursors are preserved |
| `CONFIG_MAINNET_SAFETY` error | A `testnet` URL leaked into mainnet config | Drop the override or use a production URL |
| `WALLET_EXTERNAL_NOT_AVAILABLE` | Freighter/Lobstr not installed in the user's browser | Check `ExternalWallet.isAvailable('freighter')` before connecting |
