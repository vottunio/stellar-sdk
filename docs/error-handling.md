# Error Handling Guide

`@wirex/stellar-sdk` surfaces every failure as a **typed error** that extends a common base class. Callers can `instanceof`-check, switch on a stable `code`, and inspect a `details` payload — no need to parse axios shapes or Stellar XDR error envelopes.

This guide covers:
- The error class hierarchy
- Every error code the SDK can produce, what triggers it, whether to retry
- Recovery patterns for the most common failure modes
- A troubleshooting table

---

## Error Class Hierarchy

```
Error
└── StellarError                ← base; has { code, details }
    ├── ConfigError             ← invalid SDK configuration
    ├── WalletError             ← wallet creation/import/signing failures
    └── ApiError                ← HTTP / Horizon / Soroban RPC failures
                                  (also includes { statusCode, endpoint })
```

Every error in the SDK is an instance of `StellarError`. Catch the base for "any SDK error", narrow to a subclass to handle specific categories:

```ts
import {
  StellarError,
  ConfigError,
  WalletError,
  ApiError,
  ConfigErrorCode,
  WalletErrorCode,
  ApiErrorCode,
} from '@wirex/stellar-sdk';

try {
  // ...
} catch (err) {
  if (err instanceof ConfigError) {
    // Bad SDK config — fix at startup
  } else if (err instanceof WalletError) {
    // Wallet/keypair issue
  } else if (err instanceof ApiError) {
    // Network / Horizon / Soroban
  } else if (err instanceof StellarError) {
    // Generic transaction or contract error
  } else {
    // Not from this SDK — re-throw
    throw err;
  }
}
```

Every typed error also has a JSON shape via `.toJSON()`:

```ts
{
  name: 'ApiError',
  message: 'Not found: /accounts/G…',
  code: 'NOT_FOUND',
  statusCode: 404,
  endpoint: '/accounts/G…',
  details: { ... }
}
```

---

## All Error Codes — Reference

### Configuration (`ConfigError`)

| Code | Trigger | Retryable? | Fix |
|---|---|---|---|
| `CONFIG_MISSING_REQUIRED` | Required field omitted (e.g. `network`) | No | Add the field |
| `CONFIG_INVALID_NETWORK` | `network` is not `'testnet'` or `'mainnet'` | No | Use a valid value |
| `CONFIG_INVALID_URL` | Custom `horizonUrl` / `sorobanRpcUrl` / `externalApiUrl` isn't parseable | No | Fix the URL |
| `CONFIG_INVALID_LOG_LEVEL` | `logging.level` not in `none/error/warn/info/debug` | No | Use a valid level |
| `CONFIG_INVALID_TIMEOUT` | A timeout field ≤ 0 or NaN | No | Provide a positive number |
| `CONFIG_INVALID_RETRY` | `maxAttempts < 1` or `backoffMultiplier < 1` | No | Provide valid retry values |
| `CONFIG_MAINNET_SAFETY` | Custom URL on mainnet contains testnet/sandbox indicator (`testnet`, `friendbot`, `futurenet`, `sandbox`) | No | Use a production URL or switch network |

### Wallet (`WalletError`)

| Code | Trigger | Retryable? | Fix |
|---|---|---|---|
| `WALLET_INVALID_SECRET_KEY` | `importFromSecret()` got a non-Stellar secret, or encrypted-export decryption failed | No | Provide a valid `S…` key or correct password |
| `WALLET_INVALID_MNEMONIC` | `importFromMnemonic()` got a bad BIP39 checksum | No | Verify mnemonic word-by-word |
| `WALLET_INVALID_DERIVATION_PATH` | HD wallet derivation index is non-integer or negative | No | Use a non-negative integer index |
| `WALLET_SIGNING_FAILED` | XDR could not be parsed/signed (malformed, wrong network passphrase) | No | Ensure the XDR matches the wallet's network |
| `WALLET_EXTERNAL_NOT_AVAILABLE` | Trying to connect to Freighter/Lobstr but the extension isn't installed | No | User must install the wallet extension |
| `WALLET_EXTERNAL_CONNECTION_FAILED` | External wallet returned a null pubkey or threw | Maybe | Retry once; check the extension permission popup |
| `WALLET_EXTERNAL_SIGNING_REJECTED` | User clicked "reject" in the wallet extension | No (user choice) | Inform the user; let them retry |
| `WALLET_ACCOUNT_NOT_FOUND` | `getBalances()` on an account that doesn't exist on-chain yet | No | Fund the account first (≥ 1 XLM) |
| `WALLET_EXPORT_FAILED` | `exportEncrypted()` couldn't generate the encrypted blob | No | Likely a CSPRNG issue — see RN polyfill note below |

### API / Network (`ApiError`)

| Code | Trigger | Retryable? | SDK behavior |
|---|---|---|---|
| `NETWORK_ERROR` | DNS lookup failed, connection refused, no response | **Yes** | Auto-retries with jitter |
| `TIMEOUT` | Request exceeded `config.timeout.*` | **Yes** | Auto-retries with jitter |
| `RATE_LIMITED` | Horizon returned `429 Too Many Requests` | **Yes** | Reads `Retry-After`, backs off, then retries |
| `NOT_FOUND` | Horizon returned `404` | No | Surfaces immediately |
| `BAD_REQUEST` | Horizon returned `400` (with no Stellar tx code) | No | Surfaces immediately |
| `SERVER_ERROR` | Horizon returned `5xx` | **Yes** | Auto-retries with jitter |
| `TX_FAILED` | Stellar transaction rejected with an unrecognised code | No | Inspect `details.transaction` and `details.operations` |
| `TX_BAD_SEQ` | `tx_bad_seq` — sequence number wrong | **No** (deterministic) | Caller must rebuild with fresh sequence |
| `TX_INSUFFICIENT_BALANCE` | `tx_insufficient_balance` | **No** | Caller must fund or reduce amount |
| `SIMULATION_FAILED` | Soroban simulation rejected the call | No | Inspect `details.error` |
| `INVOKE_FAILED` | Soroban submission/poll failed | No | Inspect `details` and tx hash |
| `UNKNOWN` | Non-axios, non-typed thrown value | No | File a bug report |

### Stellar Tx Codes (passed through on `ApiError.details.transaction` or `TX_*` codes)

These are Stellar protocol codes — none are retried by the SDK (re-submitting the same signed XDR is futile):

| Code | Meaning |
|---|---|
| `tx_bad_seq` | Sequence number already used or out of range |
| `tx_too_late` | `maxTime` time bound has passed |
| `tx_too_early` | `minTime` time bound hasn't been reached |
| `tx_insufficient_balance` | Source can't cover amount + fees + reserves |
| `tx_insufficient_fee` | Fee below the network's current minimum |
| `tx_no_source_account` | Source account doesn't exist on-chain |
| `tx_bad_auth` | Signature didn't validate |
| `tx_bad_auth_extra` | Extra signers than required |
| `tx_malformed` | XDR couldn't be parsed |
| `tx_failed` | One or more operations failed — see `details.operations` |

### Per-operation codes (appear in `details.operations[]`)

| Op result code | Likely cause |
|---|---|
| `op_no_destination` | Destination account doesn't exist on-chain |
| `op_underfunded` | Source doesn't have enough of the asset |
| `op_no_trust` | Destination hasn't added a trustline for the asset |
| `op_line_full` | Recipient's trustline limit would be exceeded |
| `op_low_reserve` | Operation would push the source below its base reserve |
| `op_no_issuer` | Asset issuer doesn't exist |
| `op_does_not_exist` | Trying to claim a claimable balance that's already claimed/expired |

---

## Recovery Patterns

### 1. Account not found

```ts
import { ApiError, ApiErrorCode } from '@wirex/stellar-sdk';

try {
  await sdk.api.horizon.getAccount(addr);
} catch (err) {
  if (err instanceof ApiError && err.code === ApiErrorCode.NOT_FOUND) {
    // Account isn't on-chain yet — fund it
    if (sdk.config.network === 'testnet') {
      await fetch(`https://friendbot.stellar.org?addr=${addr}`);
    } else {
      // On mainnet, send ≥ 1 XLM from a funded account first
    }
  } else {
    throw err;
  }
}
```

### 2. Insufficient balance during payment

```ts
import { ApiError, ApiErrorCode } from '@wirex/stellar-sdk';

try {
  await builder.submit();
} catch (err) {
  if (err instanceof ApiError && err.code === ApiErrorCode.TX_INSUFFICIENT_BALANCE) {
    const balances = await sdk.stellar.getBalances(sourceAccount);
    console.log('Balance:', balances);
    // Surface to user — they need to top up
  } else {
    throw err;
  }
}
```

### 3. `tx_bad_seq` (concurrent submissions)

The SDK does **not** retry this — the signed XDR has a fixed sequence number, so re-submitting fails identically. Build a fresh transaction:

```ts
async function submitWithFreshSeq(sdk, sourceAccount, wallet) {
  // Always create a new builder per submission — never reuse
  return sdk.transaction({ sourceAccount })
    .addPayment(/* ... */)
    .build()
    .then((b) => b.sign(wallet))
    .then((b) => b.submit());
}
```

If you got `tx_bad_seq` because the tx already landed in a prior submission, the SDK's 3.1.7 idempotency check will have already detected this — it calls `getTransaction(hash)` before retrying transient errors. So a `tx_bad_seq` you see in your app means: **the tx wasn't on-chain, but the sequence is stale** — usually because another transaction from the same source got ahead.

### 4. Rate limited

The SDK handles this automatically (3.1.3) — it reads `Retry-After`, backs off, and retries. If you still see `RATE_LIMITED` reach your app, all `maxAttempts` retries exhausted. Lower your concurrency:

```ts
import { RateLimiter } from '@wirex/stellar-sdk';

// Custom limiter for an aggressive use case
const limiter = new RateLimiter({ maxRequests: 50, windowMs: 5_000 });
```

### 5. Stream disconnected unexpectedly

Horizon SSE streams can drop. The streaming module persists the cursor, so resume seamlessly:

```ts
let close = sdk.stellar.stream.transactions(addr, handler);

window.addEventListener('online', () => {
  // Resume from the last saved cursor
  close = sdk.stellar.stream.transactions(addr, handler);
});
```

For WebSocket connections, the `ReconnectionManager` handles this with exponential backoff capped at 30s.

### 6. React Native CSPRNG missing

If you see `CryptoPolyfillError` (3.1.11), add the polyfill at the top of your RN entry file:

```ts
// index.js — must be the FIRST import
import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
// ...
```

### 7. Mainnet safety blocked

```ts
new WirexSDK({
  network: 'mainnet',
  horizonUrl: 'https://horizon-testnet.stellar.org',  // ← throws CONFIG_MAINNET_SAFETY
});
```

Either drop the override (the mainnet preset is correct) or pass a real production URL.

---

## Troubleshooting Table

| You see | Likely cause | Quick fix |
|---|---|---|
| `Account not found: G…` on a freshly created wallet | Not on-chain yet — needs ≥ 1 XLM | Friendbot (testnet) or send XLM from a funded account |
| `tx_insufficient_balance` | Source can't cover amount + fees + reserves | Check `getBalances()`; each trustline reserves 0.5 XLM |
| `tx_bad_seq` | Two txs with same sequence | Create a new `sdk.transaction()` per submission — never reuse |
| `op_no_trust` | Destination has no trustline for the asset | Recipient must `changeTrust()` first |
| `op_low_reserve` | Op would push source below its base reserve (1 XLM + 0.5 XLM per subentry) | Top up the source or release a trustline |
| `op_no_destination` | Sending to an unfunded address with less than min reserve | Use `createAccount` instead of `payment` with `startingBalance ≥ 1` |
| `RATE_LIMITED` after retries | App is hammering Horizon | Lower concurrency or add caching |
| `TIMEOUT` on mainnet | 30s testnet defaults too tight | SDK already uses 60s on mainnet — check your custom `timeout` overrides |
| `CONFIG_MAINNET_SAFETY` | A `testnet`/`sandbox` URL leaked into mainnet config | Drop the override or use a production URL |
| `WALLET_EXTERNAL_NOT_AVAILABLE` | Freighter/Lobstr extension not installed | Direct user to install; check with `ExternalWallet.isAvailable('freighter')` first |
| `CryptoPolyfillError` | RN without CSPRNG | `npm install react-native-get-random-values` and import at app entry |
| Soroban: "Bad union switch: 4" | Auth chain issue for SAC operations | This is a Stellar SDK quirk; verify `Account.fromOperation` invariants |
| Soroban: simulation succeeds, invoke fails with `INVOKE_FAILED` | Resource budget exceeded on actual invocation | Bump fee or simplify the contract call |

---

## Logging Errors

Set `logging.level` to surface internal details:

```ts
const sdk = new WirexSDK({
  network: 'testnet',
  logging: { level: 'debug' },  // 'error' | 'warn' | 'info' | 'debug'
});
```

The Logger **never logs secrets** — keys, mnemonics, and signed XDRs are explicitly excluded from log statements throughout the codebase (3.1.5).

---

## Building Custom Error Wrappers

To present errors in your UI cleanly:

```ts
import { StellarError, ApiError, WalletError, ApiErrorCode } from '@wirex/stellar-sdk';

function toUserMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case ApiErrorCode.NOT_FOUND:
        return 'Account not yet on-chain — fund it first';
      case ApiErrorCode.TX_INSUFFICIENT_BALANCE:
        return 'Not enough XLM to complete this payment';
      case ApiErrorCode.RATE_LIMITED:
        return 'Network is busy — please try again in a moment';
      case ApiErrorCode.TIMEOUT:
      case ApiErrorCode.NETWORK_ERROR:
        return 'Network issue — check your connection';
      default:
        return `Network error: ${err.message}`;
    }
  }
  if (err instanceof WalletError) return `Wallet error: ${err.message}`;
  if (err instanceof StellarError) return err.message;
  return 'Something went wrong';
}
```
