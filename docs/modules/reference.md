# Reference Integration Module

Pre-built orchestration for the Wirex settlement flow — XLM, USDC, EURC payments end-to-end with trustline handling and step-by-step observability. Accessed via `sdk.reference`.

## Why Use This?

If you're building a payment app, you generally need:

1. Validate that sender and recipient accounts exist on-chain
2. For non-native assets, verify the recipient has the right trustline (or create it)
3. Build, sign, and submit the payment
4. Wait for ledger inclusion
5. Surface a structured result with per-step success/failure

`sdk.reference.createSettlement(...)` does all of that in one call.

## API

```ts
await sdk.reference.createSettlement(params, sourceWallet);
```

```ts
interface SettlementParams {
  asset: 'XLM' | 'USDC' | 'EURC';
  amount: string;                                   // decimal, ≤ 7 fractional digits
  destination: string;                              // Stellar G... address
  issuer?: string;                                  // overrides well-known issuer
  memo?: MemoSpec;                                  // optional
}

interface SettlementResult {
  successful: boolean;
  transaction?: TransactionResult;                  // present when successful
  steps: SettlementStep[];                          // always present
  totalDurationMs: number;
}

interface SettlementStep {
  name: 'validate_source' | 'validate_destination' | 'check_trustline' | 'send_payment' | 'confirm';
  status: 'pending' | 'success' | 'failed' | 'skipped';
  hash?: string;                                    // tx hash if this step submitted one
  error?: string;                                   // typed error message if failed
  durationMs?: number;
}
```

## Examples

### XLM settlement (no trustline)

```ts
const result = await sdk.reference.createSettlement(
  {
    asset: 'XLM',
    amount: '50',
    destination: bob.publicKey,
    memo: { type: 'text', value: 'Invoice #1234' },
  },
  alice,
);

console.log('Settled:', result.successful, 'in', result.totalDurationMs, 'ms');
console.log('Tx hash:', result.transaction?.hash);

// Inspect each step
for (const step of result.steps) {
  console.log(`  ${step.name}: ${step.status} (${step.durationMs}ms)`);
}
```

Output:
```
Settled: true in 8423 ms
Tx hash: 1c7dad6c…
  validate_source: success (382ms)
  validate_destination: success (340ms)
  check_trustline: skipped
  send_payment: success (5219ms)
  confirm: success (2482ms)
```

### USDC settlement (trustline required)

```ts
const result = await sdk.reference.createSettlement(
  { asset: 'USDC', amount: '25.50', destination: bob.publicKey },
  alice,
);

if (!result.successful) {
  // Find which step failed and why
  const failed = result.steps.find((s) => s.status === 'failed');
  console.error(`Settlement failed at ${failed?.name}: ${failed?.error}`);
}
```

If the destination lacks a USDC trustline, `check_trustline` fails with a typed error message — the payment is **not** attempted.

### Auto-trustline (source === destination)

When you're funding your own account with USDC, the flow detects `source === destination` and adds the trustline automatically before payment:

```ts
const result = await sdk.reference.createSettlement(
  { asset: 'USDC', amount: '0', destination: alice.publicKey },
  alice,
);
// → check_trustline step now SUCCEEDS (trustline was added)
// → send_payment step fails with op_underfunded (no USDC to pay self)
// → Trustline now exists on-chain for future inbound USDC
```

## Step Observability

Every step records:
- `name` — fixed lifecycle phase
- `status` — `pending` → `success` / `failed` / `skipped`
- `durationMs` — how long the step took
- `hash` — present when a step submitted an on-chain tx
- `error` — message when `failed`, never includes XDR or signed envelope data (3.1.5 fix)

The flow **stops at the first failure**. Subsequent steps remain `pending` so you can see exactly how far the settlement got.

## Custom Issuers

```ts
await sdk.reference.createSettlement(
  {
    asset: 'USDC',
    amount: '10',
    destination: bob.publicKey,
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', // mainnet Circle
  },
  alice,
);
```

Overrides the well-known issuer baked into [`reference.types.ts`](../../src/types/reference.types.ts). Useful for testing with custom issuers or supporting wrapped versions.

## Non-Custodial Pattern

This module is **non-custodial** by design — the `sourceWallet` parameter holds the keys client-side. No private keys ever leave the caller's process.

See [non-custodial-pattern.md](../non-custodial-pattern.md) for the full architecture and recommended browser/RN integration patterns.
