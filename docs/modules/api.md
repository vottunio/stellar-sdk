# API Client Module

Low-level HTTP wrappers for Horizon REST, Soroban RPC, and partner backends. Accessed via `sdk.api`.

## When to Use

- **High-level operations** (payments, trustlines, contracts): use the `stellar`/`transaction`/`soroban` modules. They handle building, signing, submitting, and retrying for you.
- **Raw query access** (paginated history, fee stats, trade aggregations, custom backends): use `sdk.api`.

## Horizon REST — `sdk.api.horizon`

Every endpoint returns `ApiResponse<T>` with `{ data, pagination?, raw }`.

```ts
// Single records
await sdk.api.horizon.getAccount(addr);
await sdk.api.horizon.getTransaction(hash);
await sdk.api.horizon.getLedger();               // latest
await sdk.api.horizon.getLedger(12345);          // specific sequence
await sdk.api.horizon.getFeeStats();             // network fee percentiles

// Paginated lists (cursor-based)
await sdk.api.horizon.getTransactions({ account, limit: 20, order: 'desc' });
await sdk.api.horizon.getPayments({ account });
await sdk.api.horizon.getOperations({ account });
await sdk.api.horizon.getEffects({ account });
await sdk.api.horizon.getAssets({ asset_code: 'USDC' });

// Market data
await sdk.api.horizon.getOrderBook({
  selling_asset_type: 'native',
  buying_asset_type: 'credit_alphanum4',
  buying_asset_code: 'USDC',
  buying_asset_issuer: USDC_ISSUER,
});
await sdk.api.horizon.getTradeAggregations({
  base_asset_type: 'native',
  counter_asset_type: 'credit_alphanum4',
  counter_asset_code: 'USDC',
  counter_asset_issuer: USDC_ISSUER,
  resolution: 60_000,                            // 1 minute
});
```

### Pagination

```ts
let cursor: string | undefined;
do {
  const page = await sdk.api.horizon.getTransactions({ account, cursor, limit: 20 });
  for (const tx of page.data) process(tx);
  cursor = page.pagination?.hasMore ? page.pagination.cursor : undefined;
} while (cursor);
```

## Soroban RPC — `sdk.api.soroban`

Raw access to the Soroban-RPC JSON-RPC endpoints:

```ts
await sdk.api.soroban.getHealth();
await sdk.api.soroban.getNetwork();
await sdk.api.soroban.getTransaction(hash);
await sdk.api.soroban.getEvents({
  startLedger: 12345,
  filters: [{ type: 'contract', contractIds: ['CDLZ…'] }],
});
await sdk.api.soroban.getLedgerEntries(keys);
```

## External Backends — `sdk.api.external(baseUrl, options?)`

Connect to your own backend (e.g. Wirex BaaS, a custodial KYC API, a treasury service):

```ts
const wirex = sdk.api.external('https://api-baas.wirexapp.tech', {
  timeout: 10_000,
  headers: {
    'X-Partner-ID': '0x00000000000000000000000000000044',
    'Authorization': `Bearer ${accessToken}`,
  },
});

// Auth flow
const token = await wirex.post<{ access_token: string }>('/oauth/token', {
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  grant_type: 'client_credentials',
});

// Custom endpoints
const cards = await wirex.get<CardResponse[]>('/v1/cards');
```

External clients share the same:
- Axios-based HTTP transport
- Retry-with-jitter for transient errors
- Rate limiting (sliding window + `Retry-After` respect)
- Typed `ApiError` mapping

See the [partner-integration example](../../examples/partner-integration.ts).

## Rate Limiting (3.1.3)

Every API call goes through a **sliding-window rate limiter** (default: 100 req/10s). When Horizon returns `429`, the limiter automatically:

1. Parses the `Retry-After` header (seconds or HTTP-date)
2. Caps the backoff at 10 minutes
3. Blocks subsequent `acquire()` calls until the window clears

You don't have to do anything — the limiter is wired into every request automatically.

```ts
// If you want to inspect or tune it:
import { RateLimiter } from '@vottun/stellar-sdk';

const limiter = new RateLimiter({ maxRequests: 50, windowMs: 5_000 });
limiter.remaining;        // tokens left
limiter.isBlocked;        // true if server told us to back off
```

## Error Handling

All API errors throw a typed `ApiError` (never raw axios errors):

| Code | When |
|---|---|
| `NETWORK_ERROR` | DNS / connection / no response |
| `TIMEOUT` | Request exceeded configured timeout |
| `RATE_LIMITED` | 429 received |
| `NOT_FOUND` | 404 |
| `BAD_REQUEST` | 400 |
| `SERVER_ERROR` | 5xx |
| `TX_BAD_SEQ`, `TX_INSUFFICIENT_BALANCE`, `TX_FAILED` | Stellar tx-level codes |

```ts
import { ApiError, ApiErrorCode } from '@vottun/stellar-sdk';

try {
  await sdk.api.horizon.getAccount(addr);
} catch (e) {
  if (e instanceof ApiError && e.code === ApiErrorCode.NOT_FOUND) {
    // account doesn't exist yet
  }
}
```
