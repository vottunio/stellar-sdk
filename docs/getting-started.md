# Getting Started with `@vottun/stellar-sdk`

> First Stellar transaction in **5 minutes**, from `npm install` to a confirmed payment on testnet.

---

## Prerequisites

- **Node.js 18+** (the SDK uses native `fetch` and `globalThis.crypto`)
- A package manager: `pnpm` (recommended), `npm`, or `yarn`
- Internet access — Stellar's Friendbot will fund test accounts for free

No accounts, no API keys, no funded wallets, no manual setup. Everything in this guide runs against Stellar **testnet**.

---

## 1 · Install

```bash
pnpm add @vottun/stellar-sdk
# or
npm install @vottun/stellar-sdk
```

The SDK ships ESM, CJS, and UMD bundles; your bundler will pick the right one automatically. Total gzipped size: **~36 KB**.

---

## 2 · Initialize the SDK

```ts
import { WirexSDK } from '@vottun/stellar-sdk';

const sdk = new WirexSDK({ network: 'testnet' });
```

That's it. `network: 'testnet'` (or `'mainnet'`) is the only required option. Everything else has sensible production defaults: dynamic fee escalation, retry with full jitter, network-tuned timeouts, sliding-window rate limiting.

> Switching to mainnet later is one line: `new WirexSDK({ network: 'mainnet' })`. The SDK enforces mainnet safety automatically — testnet URLs are rejected when targeting mainnet.

---

## 3 · Create a Wallet

```ts
// In-memory keypair (Stellar G... + S... pair)
const alice = sdk.wallet.create();
console.log('Alice public key:', alice.publicKey);

// Or import from an existing secret
const bob = sdk.wallet.importFromSecret('S...');

// Or import from a BIP39 mnemonic (HD wallet at path m/44'/148'/0')
const hd = sdk.wallet.createHD();
console.log('Mnemonic (write this down):', hd.exportMnemonic());
```

**Non-custodial by design.** The SDK never stores keys server-side and never logs them, even at `debug` level.

---

## 4 · Fund the Wallet (testnet)

On testnet, anyone can claim 10,000 XLM via Friendbot:

```ts
await fetch(`https://friendbot.stellar.org?addr=${alice.publicKey}`);
```

On mainnet you fund accounts by sending them XLM from another funded account (or by buying XLM on an exchange and withdrawing to your wallet).

---

## 5 · Send Your First Payment

```ts
const result = await sdk
  .transaction({ sourceAccount: alice.publicKey })
  .addPayment({
    destination: bob.publicKey,
    asset: { code: 'XLM' },
    amount: '10',
  })
  .addMemo({ type: 'text', value: 'Hello, Stellar!' })
  .build()
  .then((b) => b.sign(alice))
  .then((b) => b.submit());

console.log('Transaction hash:', result.hash);
console.log('Ledger:', result.ledger);
console.log('Successful:', result.successful);
```

`result.hash` is a 64-char hex string you can paste into [stellarchain.io](https://stellarchain.io) to see the transaction on-chain.

---

## 6 · Query Balances

```ts
const balances = await sdk.stellar.getBalances(alice.publicKey);
for (const b of balances) {
  console.log(`${b.code}: ${b.balance}`);
}
```

For non-XLM assets, `balance.issuer` identifies the asset issuer.

---

## 7 · Working with Non-Native Assets (USDC, EURC, …)

Sending USDC requires a **trustline** — the recipient must opt in to accept the asset:

```ts
const TESTNET_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

// Bob opens a trustline so he can hold USDC
await sdk.stellar.changeTrust(
  {
    sourceAccount: bob.publicKey,
    asset: { code: 'USDC', issuer: TESTNET_USDC_ISSUER },
  },
  bob,
);

// Alice can now send USDC to Bob
await sdk.stellar.sendPayment(
  {
    sourceAccount: alice.publicKey,
    destination: bob.publicKey,
    asset: { code: 'USDC', issuer: TESTNET_USDC_ISSUER },
    amount: '50',
  },
  alice,
);
```

On mainnet, the official Circle USDC issuer is `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`. EURC is `GDHU26QVJGZL7SXLEEC6PDB5UDDASLZSYXLN55YTIJAXHL6JRZA7W3NT`.

---

## 8 · Listen for Real-Time Events

```ts
const close = sdk.stellar.stream.transactions(alice.publicKey, (tx) => {
  console.log('New tx on Alice:', tx.hash);
});

// Later:
close(); // unsubscribe
```

Streaming uses Horizon SSE (Server-Sent Events) — works in browsers and Node without polyfills.

---

## 9 · Switching to Mainnet

When you're ready to go live:

```ts
const sdk = new WirexSDK({
  network: 'mainnet',
  // Optional: customize logging, retries, timeouts.
  // Defaults are already mainnet-grade (60s Horizon timeout, dynamic fees, retry-with-jitter).
  logging: { level: 'info' },
});
```

On mainnet the SDK automatically:

- Enforces wider timeouts (60s Horizon vs 30s testnet) to tolerate congestion
- Uses dynamic fee estimation via `/fee_stats` (medium-percentile by default)
- Applies idempotency-safe retry (transient errors only — `tx_bad_seq` and friends never retry)
- Blocks any testnet URL leakage in configuration

---

## What's Next?

- [Module guides](./modules/) — deep-dive on each SDK module (wallet, transaction, stellar, api, websocket, config, reference)
- [Code examples](../examples/) — 12+ working examples covering common use cases
- [Non-custodial pattern](./non-custodial-pattern.md) — how to use the SDK in client-side / browser flows
- [Error handling guide](./error-handling.md) — typed errors, recovery patterns, troubleshooting
- [Migration guide](./migration.md) — coming from raw `@stellar/stellar-sdk`? Read this

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Account not found` on a freshly created wallet | Account isn't on-chain until it receives ≥ 1 XLM | Use Friendbot (testnet) or send XLM from a funded account (mainnet) |
| `tx_insufficient_balance` | Source account doesn't have enough XLM to cover amount + fees + reserves | Check balance with `getBalances()`; remember each trustline reserves 0.5 XLM |
| `tx_bad_seq` | Two transactions with the same sequence number | Don't reuse a builder; create a new `sdk.transaction()` per submission |
| `op_no_trust` | Destination hasn't added a trustline for the asset | Recipient must call `changeTrust()` for the asset before receiving |
| `Mainnet safety violation` | Trying to use a testnet URL with `network: 'mainnet'` | Use the mainnet preset URLs or your production endpoint |
