# Wallet Module

Manages Stellar keypairs, HD wallets, and external wallet adapters (Freighter, Lobstr). Accessed via `sdk.wallet`.

## API Surface

| Method | Purpose |
|---|---|
| `sdk.wallet.create()` | Generate a new random keypair |
| `sdk.wallet.importFromSecret(secret)` | Import from a Stellar secret key (`S…`) |
| `sdk.wallet.importFromMnemonic(mnemonic, index?)` | Import a single account from BIP39 mnemonic |
| `sdk.wallet.createHD(mnemonic?)` | Create an HD wallet (generates a 24-word mnemonic if omitted) |
| `sdk.wallet.connectExternal('freighter' \| 'lobstr')` | Connect to a browser wallet extension |

## Wallet Interface

Every wallet (keypair, HD, external) implements the same `Wallet` interface:

```ts
interface Wallet {
  readonly publicKey: string;
  sign(transactionXDR: string, networkPassphrase: string): Promise<string>;
  getBalances(): Promise<Balance[]>;
}
```

This means downstream APIs like `sdk.transaction(…).sign(wallet)` accept any wallet type interchangeably.

## Examples

### Create and use a random wallet

```ts
const wallet = sdk.wallet.create();
console.log(wallet.publicKey);                   // G...
console.log(wallet.exportSecret());              // S... (keep this safe!)
```

### Import from mnemonic

```ts
const mnemonic = 'abandon abandon abandon abandon abandon abandon ' +
                 'abandon abandon abandon abandon abandon about';
const wallet = sdk.wallet.importFromMnemonic(mnemonic);
```

### HD wallet — derive multiple accounts

```ts
const hd = sdk.wallet.createHD();
const account0 = hd;                              // m/44'/148'/0'
const account1 = hd.deriveAccount(1);             // m/44'/148'/1'
const account2 = hd.deriveAccount(2);             // m/44'/148'/2'

// Save the mnemonic — it's the only way to recover the keys
const mnemonic = hd.exportMnemonic();
```

### Encrypted export

```ts
const encrypted = wallet.exportEncrypted('strong-password');
// ... store `encrypted` somewhere safe ...
const restored = KeypairWallet.fromEncrypted(encrypted, 'strong-password', horizonUrl);
```

Encryption uses `nacl.secretbox` (XSalsa20-Poly1305) with a PBKDF2-like key stretch via SHA-512.

### Browser: connect to Freighter

```ts
if (ExternalWallet.isAvailable('freighter')) {
  const wallet = await sdk.wallet.connectExternal('freighter');
  console.log('Connected:', wallet.publicKey);
  // Signing delegates to the Freighter extension — the user approves each tx
}
```

## Security Properties

- **No keys in logs.** The SDK masks secret keys in error messages (only first 4 chars shown).
- **No keys in errors.** Stack traces and error details never expose mnemonics or secret bytes.
- **In-memory only by default.** `KeypairWallet` holds keys in private fields; no auto-persistence.
- **Explicit export.** `exportSecret()` / `exportMnemonic()` must be called deliberately — they are not auto-invoked.
- **React Native polyfill check.** Wallet creation runs `ensureSecureRandom()` and throws a clear `CryptoPolyfillError` with install instructions if the platform lacks a CSPRNG.

## Common Errors

| Code | Meaning |
|---|---|
| `INVALID_SECRET_KEY` | The provided string is not a valid Stellar secret |
| `INVALID_MNEMONIC` | BIP39 mnemonic failed checksum validation |
| `SIGNING_FAILED` | Transaction XDR could not be parsed or signed |
| `ACCOUNT_NOT_FOUND` | Account doesn't exist on-chain yet (needs ≥ 1 XLM funding) |
| `EXPORT_FAILED` | Encrypted export couldn't be generated |
