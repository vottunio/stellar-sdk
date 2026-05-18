# Stellar Module

High-level helpers for blockchain interaction — accounts, assets, payments, Soroban contracts, and streaming. Accessed via `sdk.stellar` (and `sdk.soroban` for contract calls).

## Sub-services

| Service | Purpose | Accessed via |
|---|---|---|
| `AccountService` | Account queries, balance, funding, manage data | `sdk.stellar.*` |
| `AssetService` | Trustlines, claimable balances, sponsored ops | `sdk.stellar.*` |
| `PaymentService` | Direct payments and path payments | `sdk.stellar.*` |
| `SorobanService` | Smart contract invocation + simulation | `sdk.soroban.*` |
| `StreamingService` | Horizon SSE event streams | `sdk.stellar.stream.*` |

## Account Operations

```ts
// Existence + info
await sdk.stellar.accountExists(addr);           // true | false
await sdk.stellar.getAccountInfo(addr);          // full account record
await sdk.stellar.getBalances(addr);             // [{ code, issuer, balance }]

// Testnet: fund via Friendbot
await sdk.stellar.fundTestAccount(addr);

// Create on-chain
await sdk.stellar.createAccount(
  { sourceAccount, destination, startingBalance: '20' },
  sourceWallet,
);

// Account data entries
await sdk.stellar.manageData(
  { sourceAccount, name: 'kyc_status', value: 'verified' },
  sourceWallet,
);
```

## Asset Operations

### Trustlines

```ts
// Open
await sdk.stellar.changeTrust(
  { sourceAccount, asset: { code: 'USDC', issuer: USDC_ISSUER } },
  wallet,
);

// Close (limit = '0')
await sdk.stellar.changeTrust(
  { sourceAccount, asset: { code: 'USDC', issuer: USDC_ISSUER }, limit: '0' },
  wallet,
);
```

### Claimable Balances

Useful for delayed or conditional payments:

```ts
await sdk.stellar.createClaimableBalance(
  {
    sourceAccount,
    asset: { code: 'XLM' },
    amount: '100',
    claimants: [
      { destination: friend, predicate: { type: 'unconditional' } },
      { destination: backup, predicate: { type: 'before_relative_time', value: 604800 } }, // 7 days
    ],
  },
  wallet,
);

await sdk.stellar.claimClaimableBalance({ balanceId }, claimerWallet);
```

### Sponsored Reserves

Have one account pay the reserve for another (e.g. a service onboarding a new user):

```ts
await sdk.stellar.sponsoredOperation(
  { sourceAccount: sponsor, sponsoredAccount: newUser },
  [Operation.createAccount({ destination: newUser, startingBalance: '1' })],
  sponsorWallet,
);
```

## Payments

```ts
// Direct payment
await sdk.stellar.sendPayment(
  { sourceAccount, destination, asset: { code: 'XLM' }, amount: '10' },
  wallet,
);

// Path payment — convert XLM → USDC across order books
await sdk.stellar.pathPaymentStrictSend(
  {
    sourceAccount,
    sendAsset: { code: 'XLM' },
    sendAmount: '100',
    destination,
    destAsset: { code: 'USDC', issuer: USDC_ISSUER },
    destMin: '8',                 // refuse if conversion gives less than 8 USDC
  },
  wallet,
);
```

## Soroban

Read state (no submission):

```ts
const result = await sdk.soroban.readContract({
  contractId: 'CDLZ…CYSC',                       // native XLM SAC on testnet
  method: 'balance',
  args: [sdk.soroban.nativeToScVal(addr, 'address')],
  sourceAccount: addr,
});
console.log(result.returnValue);                 // bigint
```

Invoke (signs + submits + polls):

```ts
const invocation = await sdk.soroban.invokeContract(
  {
    contractId: 'CDLZ…CYSC',
    method: 'transfer',
    args: [
      sdk.soroban.nativeToScVal(from, 'address'),
      sdk.soroban.nativeToScVal(to, 'address'),
      sdk.soroban.nativeToScVal(1n, 'i128'),
    ],
    sourceAccount: from,
  },
  wallet,
);
console.log(invocation.hash, invocation.ledger, invocation.returnValue);
```

ScVal helpers handle every Soroban type:

```ts
sdk.soroban.nativeToScVal('hello', 'string');
sdk.soroban.nativeToScVal('transfer', 'symbol');
sdk.soroban.nativeToScVal(42, 'u32');
sdk.soroban.nativeToScVal(1_000_000n, 'i128');
sdk.soroban.nativeToScVal(addr, 'address');
sdk.soroban.scValToNative(scVal);                // any → JS value
```

## Streaming (SSE)

Real-time events via Horizon Server-Sent Events. Works in Node 18+, browsers, and React Native — no WebSocket polyfill needed.

```ts
// Subscribe to Alice's transactions
const close = sdk.stellar.stream.transactions(alice, (tx) => {
  console.log('New tx:', tx.hash);
});

// Other streams
sdk.stellar.stream.payments(addr, handler);
sdk.stellar.stream.operations(addr, handler);
sdk.stellar.stream.effects(addr, handler);
sdk.stellar.stream.ledgers(handler);             // network-wide

// Always close to free the connection
close();

// Resume from a saved cursor
sdk.stellar.stream.setCursor('transactions:G…', '12345678-abc');
```

## Error Codes

All operations throw `StellarError` with one of:

| Code | Meaning |
|---|---|
| `INVALID_ASSET` | Asset code/issuer malformed |
| `INVALID_ADDRESS` | Stellar address fails checksum |
| `OP_FAILED` | Operation rejected by network |
| `SIMULATION_FAILED` | Soroban simulation error |
| `INVOKE_FAILED` | Soroban invocation error |
| `TX_FAILED` | Transaction-level error (see message for tx code) |
