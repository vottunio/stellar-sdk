# Non-Custodial Integration Pattern

## Overview

The `@wirex/stellar-sdk` follows a **non-custodial architecture**: private keys never leave the client. All transaction signing happens locally, and no secrets are transmitted to any server — whether the Stellar network, a partner BaaS API, or the SDK itself.

This document explains the pattern and how to apply it in your integration.

## Architecture

```
┌────────────────────────┐
│  Your Application      │
│                        │
│  ┌──────────────────┐  │
│  │  Wallet (keys)   │──┼──── Keys stay HERE. Never transmitted.
│  └────────┬─────────┘  │
│           │ sign()     │
│  ┌────────▼─────────┐  │
│  │  SDK             │  │
│  │  - build tx      │  │
│  │  - sign locally  │  │
│  │  - submit signed │──┼──── Only signed XDR leaves the client
│  └──────────────────┘  │
└────────────────────────┘
            │
            ▼
   ┌──────────────────┐
   │  Stellar Network  │  ← Receives signed transaction, never keys
   └──────────────────┘
```

## How It Works

### 1. Wallet Creation

Wallets are created or imported locally. The SDK supports three wallet types:

```typescript
import { WirexSDK } from '@wirex/stellar-sdk';

const sdk = new WirexSDK({ network: 'testnet' });

// Option A: Generate a new random keypair
const wallet = sdk.wallet.create();

// Option B: Import from secret key
const imported = sdk.wallet.importFromSecret('SCZANGBA5YHTNYVVV3C7CAZMCLXPILHSE6PGYAY...');

// Option C: HD wallet from mnemonic (BIP44 path m/44'/148'/{index}')
const hd = sdk.wallet.createHD();
const child = hd.deriveAccount(0);
```

In all cases, the private key exists only in the `Wallet` object in your application's memory. The SDK never stores, logs, or transmits it.

### 2. Transaction Signing

When you call `sdk.stellar.sendPayment(...)`, `sdk.reference.createSettlement(...)`, or use the fluent `TransactionBuilder`, the SDK:

1. **Builds** the transaction envelope (unsigned XDR)
2. **Calls** `wallet.sign(xdr, networkPassphrase)` — this happens locally
3. **Submits** only the signed XDR to Horizon

```typescript
// The wallet parameter is used ONLY for signing — the SDK calls wallet.sign()
// internally and immediately submits the result. No key extraction happens.
const result = await sdk.reference.createSettlement(
  { asset: 'XLM', amount: '100', destination: 'GDEST...' },
  wallet,  // ← signs locally, key never leaves this object
);
```

### 3. External Wallet Support

For browser-based applications, the SDK supports **external wallets** (Freighter, Lobstr) that manage keys in the browser extension:

```typescript
const freighter = sdk.wallet.connectExternal('freighter');
await freighter.connect();  // user approves in extension popup

// Signing is delegated to the extension — keys never touch your code
const result = await sdk.stellar.sendPayment(params, freighter);
```

## Security Guarantees

| Guarantee | How |
|-----------|-----|
| Keys never logged | Logger filters sensitive fields; no key-related data in log output |
| Keys never in error objects | `StellarError.details` never includes secret keys |
| Keys never transmitted | `wallet.sign()` returns signed XDR; only XDR is sent to Horizon |
| Keys never stored by SDK | No persistence layer, no caching of secrets |
| Network passphrase scoped | Each network (testnet/mainnet) uses its own passphrase for signing |

## Partner Integration (Non-Custodial)

When integrating with a partner API (e.g. Wirex BaaS), the non-custodial pattern still holds:

```typescript
// 1. Connect to partner API (no keys involved)
const partnerClient = sdk.api.external('https://api-baas.wirexapp.tech', {
  headers: { Authorization: 'Bearer <token>' },
});

// 2. Get transaction instructions from partner (off-chain)
const instructions = await partnerClient.get('/v1/settlement/instructions');

// 3. Execute on-chain settlement (keys stay local)
const result = await sdk.reference.createSettlement(
  { asset: 'USDC', amount: '100', destination: instructions.data.destination },
  wallet,  // ← still signs locally
);

// 4. Confirm back to partner (only tx hash, no keys)
await partnerClient.post('/v1/settlement/confirm', {
  hash: result.transaction?.hash,
});
```

## Best Practices

1. **Never export secrets to logs or error handlers** — use `wallet.publicKey` for logging
2. **Use encrypted export for backup** — `wallet.exportEncrypted(password)` protects at rest
3. **Prefer HD wallets for multiple accounts** — derive from one mnemonic, back up the phrase
4. **Use external wallets in browsers** — Freighter/Lobstr keep keys in the extension sandbox
5. **Rotate keys if compromised** — create a new wallet, transfer assets, update trustlines
