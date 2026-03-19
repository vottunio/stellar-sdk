# Proposal: Modular SDK for Wirex Pay on Stellar
## Developer-Friendly Integration for Stellar Blockchain

---

## Objective

Create a modular, extensible, and developer-friendly SDK that abstracts the complexity of Stellar blockchain and payment operations for Wirex Pay. The SDK will provide a robust set of tools to enable seamless integration regardless of the developer's familiarity with Stellar's underlying technologies.

---

## Proposed Architecture

The Wirex SDK for Stellar follows a modular design with six specialized, independent modules:

```
┌─────────────────────────────────────────────────────────────┐
│                    Wirex SDK for Stellar                     │
├─────────────────────────────────────────────────────────────┤
│  1. Wallet Management                                        │
│  2. Stellar Blockchain Interaction                           │
│  3. Transaction Management                                   │
│  4. API Client (Wirex Backend)                              │
│  5. WebSocket Events                                         │
│  6. Configuration & Environment                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    ┌──────────────────┐
                    │  Stellar Network │
                    │  (Testnet/Mainnet)│
                    └──────────────────┘
```

---

## Module Specifications

### 1. Wallet Management Module

**Goal:** Provide comprehensive tools for creating, managing, and securing Stellar wallets.

| Feature | Description | Technical Implementation |
|---------|-------------|-------------------------|
| **Wallet Creation** | Generate new Stellar keypairs securely | Ed25519 keypair generation using Stellar SDK |
| **Wallet Import** | Import existing wallets from secret key or mnemonic | Support for secret keys (S...) and BIP39 mnemonics |
| **HD Wallet Support** | Hierarchical deterministic wallet derivation | BIP32/BIP44 implementation (m/44'/148'/account') |
| **Transaction Signing** | Sign transactions with local private keys | Local signing without exposing private keys |
| **External Wallet Integration** | Connect to user's existing Stellar wallets | Freighter, Lobstr, Albedo wallet integration |
| **Multi-signature Support** | Manage wallets with multiple signatories | Stellar native multisig operations |
| **Wallet Backup & Recovery** | Export mnemonics and encrypted keys | Secure export with optional encryption |

**Example Usage:**
```typescript
// Create new wallet
const wallet = await sdk.wallet.create();
console.log(wallet.publicKey); // GABC...
console.log(wallet.secretKey); // SXXX... (store securely!)

// Import from mnemonic
const imported = await sdk.wallet.importFromMnemonic(
  'abandon abandon abandon...'
);

// Connect external wallet
const freighter = await sdk.wallet.connectExternal('freighter');
```

---

### 2. Stellar Blockchain Interaction Module

**Goal:** Facilitate secure and standardized interaction with Stellar network operations, assets, and smart contracts.

| Feature | Description | Technical Implementation |
|---------|-------------|-------------------------|
| **Native Operations** | Execute Stellar native operations | Payment, PathPayment, CreateAccount, ManageData, etc. |
| **Asset Management** | Handle Stellar assets and trustlines | Create trustlines, send custom assets, manage offers |
| **Soroban Contracts** | Interact with Stellar smart contracts | Invoke Soroban contracts, query contract state |
| **Account Queries** | Read on-chain account data | Balance queries, signers, data entries, sequence numbers |
| **Claimable Balances** | Create and claim claimable balances | Conditional payments and airdrops |
| **Liquidity Pools** | Interact with Stellar AMM pools | Deposit, withdraw, swap through liquidity pools |
| **Sponsored Reserves** | Handle sponsored reserve operations | Fee bumps and sponsored account creation |
| **Path Finding** | Find optimal payment paths | Strict send/receive path payment operations |

**Example Usage:**
```typescript
// Send payment
await sdk.stellar.sendPayment({
  from: wallet.publicKey,
  to: 'GDEST...',
  asset: sdk.stellar.Asset.native(), // XLM
  amount: '100'
});

// Create trustline for custom asset
await sdk.stellar.changeTrust({
  asset: new sdk.stellar.Asset('USDC', 'GISSUER...'),
  limit: '10000'
});

// Invoke Soroban contract
const result = await sdk.stellar.invokeContract({
  contractId: 'CCONTRACT...',
  method: 'transfer',
  args: [from, to, amount]
});

// Query account balances
const balances = await sdk.stellar.getBalances('GABC...');
```

---

### 3. Transaction Management Module

**Goal:** Simplify the end-to-end process of building, signing, submitting, and monitoring Stellar transactions.

| Feature | Description | Technical Implementation |
|---------|-------------|-------------------------|
| **Transaction Builder** | Fluent API for constructing transactions | Method-chaining interface with validation |
| **Fee Estimation** | Calculate transaction fees before submission | Base fee + operation count estimation |
| **Transaction Signing** | Sign with single or multiple signers | Support for multisig workflows |
| **Transaction Submission** | Submit to Horizon and handle responses | Error handling and parsing |
| **Status Tracking** | Monitor transaction confirmation | Poll ledger for transaction inclusion |
| **Retry Logic** | Automatic retry with exponential backoff | Handle tx_bad_seq and temporary failures |
| **Memo Support** | Attach memos to transactions | Text, ID, Hash, and Return memo types |
| **Time Bounds** | Set validity windows for transactions | Min/max time constraints |

**Example Usage:**
```typescript
// Build and send transaction with fluent API
const tx = await sdk.transaction()
  .addPayment({
    destination: 'GDEST...',
    asset: Asset.native(),
    amount: '50'
  })
  .addMemo(Memo.text('Invoice #1234'))
  .setTimeout(30) // 30 seconds validity
  .build();

// Estimate fees
const fees = await tx.estimateFees();
console.log(`Estimated fee: ${fees.fee} stroops`);

// Sign and submit
await tx.sign(wallet);
const result = await tx.submit();

// Track confirmation
await result.waitForConfirmation();
console.log(`Confirmed in ledger: ${result.ledger}`);
```

---

### 4. API Client Module

**Goal:** Provide a complete, type-safe wrapper for interacting with the Wirex Pay backend services.

| Feature | Description | Endpoints |
|---------|-------------|-----------|
| **Authentication** | User login, logout, token management | POST /auth/login, /auth/logout, /auth/refresh |
| **User Management** | Profile CRUD, KYC/AML status | GET/PUT /user/profile, GET /user/kyc-status |
| **Card Operations** | Request, activate, suspend cards | POST /cards/request, PUT /cards/{id}/activate |
| **Transaction History** | Query on-chain and off-chain transactions | GET /transactions, GET /transactions/{id} |
| **Wallet Information** | Fetch balances and linked accounts | GET /wallet/balances, GET /wallet/accounts |
| **Payment Operations** | Initiate payments, conversions, top-ups | POST /payments, POST /conversions |
| **Limits & Fees** | Query spending limits and fee schedules | GET /limits, GET /fees |

**Note:** This module is completely blockchain-agnostic and only interacts with Wirex Pay's REST API.

**Example Usage:**
```typescript
// Authentication
await sdk.api.auth.login({
  email: 'user@example.com',
  password: 'secure_password'
});

// Get user profile
const profile = await sdk.api.user.getProfile();

// Request virtual card
const card = await sdk.api.cards.request({
  type: 'virtual',
  currency: 'USD'
});

// Get transaction history
const history = await sdk.api.transactions.list({
  limit: 50,
  offset: 0,
  startDate: '2024-01-01'
});

// Check wallet balance
const balance = await sdk.api.wallet.getBalance();
```

---

### 5. WebSocket Module

**Goal:** Enable real-time communication for live updates on transactions, deposits, and account events.

| Feature | Description | Technical Implementation |
|---------|-------------|-------------------------|
| **Event Subscription** | Subscribe to specific event streams | Filter by event type, account, asset |
| **Automatic Reconnection** | Graceful reconnection on connection loss | Exponential backoff reconnection strategy |
| **Event Routing** | Route events to appropriate handlers | Type-based event dispatcher |
| **Type-Safe Handlers** | Strongly typed event interfaces | TypeScript interfaces for all event types |
| **Connection Management** | Monitor connection status | Connected, disconnected, error callbacks |
| **Heartbeat & Ping** | Keep-alive mechanism | Automatic ping/pong |

**Supported Events:**
- `transaction.confirmed` - Transaction included in ledger
- `transaction.failed` - Transaction failed
- `payment.received` - Incoming payment detected
- `account.updated` - Account data changed
- `card.statusChanged` - Card status updated

**Example Usage:**
```typescript
const ws = sdk.websocket;

// Subscribe to events
ws.on('payment.received', (event) => {
  console.log(`Received ${event.amount} ${event.asset.code}`);
  console.log(`From: ${event.from}`);
});

ws.on('transaction.confirmed', (event) => {
  console.log(`TX ${event.hash} confirmed in ledger ${event.ledger}`);
});

// Connection status
ws.on('connected', () => {
  console.log('WebSocket connected');
});

ws.on('disconnected', () => {
  console.log('WebSocket disconnected, reconnecting...');
});

// Connect
await ws.connect();

// Filter events for specific account
ws.subscribe({
  events: ['payment.received'],
  account: 'GABC...'
});
```

---

### 6. Configuration Module

**Goal:** Manage environment-specific parameters and operational settings for easy switching between development and production.

| Feature | Description | Configuration Options |
|---------|-------------|----------------------|
| **Environment Management** | Switch between testnet and mainnet | `network: 'testnet' \| 'mainnet'` |
| **Horizon Configuration** | Configure Horizon server endpoints | Custom Horizon URL or default |
| **Soroban RPC** | Configure Soroban RPC endpoints | Custom RPC URL for contract calls |
| **API Endpoints** | Wirex Pay backend base URLs | Separate testnet/mainnet endpoints |
| **Network Parameters** | Stellar network passphrase and settings | Auto-configured per network |
| **Logging & Debugging** | Control log verbosity | `none`, `error`, `warn`, `info`, `debug` |
| **Timeout Configuration** | Set request timeouts | Horizon, API, WebSocket timeouts |
| **Retry Policies** | Configure retry behavior | Max retries, backoff multiplier |

**Example Configuration:**
```typescript
import { WirexSDK } from '@wirex/stellar-sdk';

// Testnet configuration
const sdkTestnet = new WirexSDK({
  network: 'testnet',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  wirexApiUrl: 'https://api-testnet.wirex.app',
  logging: {
    level: 'debug',
    console: true
  },
  timeout: {
    horizon: 30000,
    api: 15000,
    websocket: 60000
  },
  retry: {
    maxAttempts: 3,
    backoffMultiplier: 2
  }
});

// Mainnet configuration (production)
const sdkMainnet = new WirexSDK({
  network: 'mainnet',
  wirexApiUrl: 'https://api.wirex.app',
  logging: {
    level: 'error'
  }
});
```

---

## Technical Stack

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Language** | TypeScript | Type safety, excellent developer experience |
| **Runtime** | Node.js 18+, Browser (ES2020+) | Cross-platform compatibility |
| **Stellar SDK** | `@stellar/stellar-sdk` (v11+) | Official Stellar SDK with Soroban support |
| **HTTP Client** | `axios` | Robust, well-tested, interceptor support |
| **WebSocket** | `ws` (Node), native WebSocket (Browser) | Standard WebSocket implementation |
| **Cryptography** | `tweetnacl`, `bip39`, `bip32` | Ed25519, mnemonic generation, HD wallets |
| **Testing** | Jest, Stellar Test Network | Unit tests, integration tests |
| **Build Tool** | Rollup | Tree-shaking, multiple output formats |
| **Package Manager** | pnpm | Fast, efficient, workspace support |
| **Documentation** | TypeDoc | Auto-generated from TypeScript types |

**Output Formats:**
- ESM (modern bundlers)
- CommonJS (Node.js)
- UMD (browser script tag)

---

## Stellar-Specific Features & Considerations

### Account Creation & Funding
On Stellar, accounts must be funded with a minimum balance (base reserve). The SDK handles this:

```typescript
// Check if account exists
const exists = await sdk.stellar.accountExists('GABC...');

if (!exists) {
  // Fund from existing account
  await sdk.stellar.createAccount({
    source: fundingAccount,
    destination: newAccount.publicKey,
    startingBalance: '2' // XLM (above minimum reserve)
  });
}
```

### Trustlines
Before receiving custom assets, accounts must establish trustlines:

```typescript
// Establish trustline for USDC
await sdk.transaction()
  .changeTrust({
    asset: new Asset('USDC', 'GISSUER...'),
    limit: '1000000' // Optional limit
  })
  .sign(wallet)
  .submit();
```

### Claimable Balances
Enable conditional payments and airdrops:

```typescript
// Create claimable balance (airdrop)
await sdk.stellar.createClaimableBalance({
  asset: Asset.native(),
  amount: '100',
  claimants: [
    {
      destination: 'GDEST...',
      predicate: sdk.stellar.Claimant.predicateBeforeRelativeTime('86400') // 24h
    }
  ]
});

// Claim balance
await sdk.stellar.claimClaimableBalance({
  balanceId: '00000000...'
});
```

### Path Payments
Find optimal conversion paths automatically:

```typescript
// Send EUR, recipient receives USD (automatic conversion)
await sdk.stellar.pathPaymentStrictSend({
  sendAsset: new Asset('EUR', 'EISSUER...'),
  sendAmount: '100',
  destination: 'GDEST...',
  destAsset: new Asset('USD', 'UISSUER...'),
  destMin: '95' // Minimum acceptable amount
});
```

### Sponsored Reserves
Sponsor account creation and trustline reserves:

```typescript
// Sponsor new account creation (sponsor pays reserves)
await sdk.stellar.beginSponsoringFutureReserves({
  sponsoredId: newAccount.publicKey
});

await sdk.stellar.createAccount({
  destination: newAccount.publicKey,
  startingBalance: '0' // Sponsored, no balance needed
});

await sdk.stellar.endSponsoringFutureReserves();
```

### Soroban Smart Contracts
Interact with Stellar's smart contract platform:

```typescript
// Invoke contract method
const result = await sdk.stellar.invokeContract({
  contractId: 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE',
  method: 'transfer',
  args: [
    sdk.stellar.nativeToScVal(fromAddress, 'address'),
    sdk.stellar.nativeToScVal(toAddress, 'address'),
    sdk.stellar.nativeToScVal(amount, 'i128')
  ]
});

// Query contract state (read-only)
const balance = await sdk.stellar.readContract({
  contractId: 'CA3D5...',
  method: 'balance',
  args: [sdk.stellar.nativeToScVal(address, 'address')]
});
```

---

## Complete Usage Example

```typescript
import { WirexSDK, Asset } from '@wirex/stellar-sdk';

// 1. Initialize SDK
const sdk = new WirexSDK({
  network: 'testnet',
  wirexApiUrl: 'https://api-testnet.wirex.app',
  logging: { level: 'info' }
});

// 2. Authenticate with Wirex backend
await sdk.api.auth.login({
  email: 'user@example.com',
  password: 'password123'
});

// 3. Create or import wallet
const wallet = await sdk.wallet.create();
console.log('Wallet created:', wallet.publicKey);

// Fund account on testnet (using Friendbot)
await sdk.stellar.fundTestAccount(wallet.publicKey);

// 4. Check balance
const balances = await sdk.stellar.getBalances(wallet.publicKey);
console.log('Balances:', balances);

// 5. Create trustline for USDC
const usdcAsset = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');

await sdk.transaction()
  .changeTrust({ asset: usdcAsset })
  .sign(wallet)
  .submit();

// 6. Send payment
const tx = await sdk.transaction()
  .addPayment({
    destination: 'GDESTINATION...',
    asset: usdcAsset,
    amount: '50'
  })
  .addMemo(sdk.stellar.Memo.text('Payment for services'))
  .build();

await tx.sign(wallet);
const result = await tx.submit();
console.log('Transaction hash:', result.hash);

// 7. Monitor transaction
await result.waitForConfirmation();
console.log('Transaction confirmed!');

// 8. Subscribe to real-time events
sdk.websocket.on('payment.received', (event) => {
  console.log('Payment received:', event);
});

await sdk.websocket.connect();

// 9. Get transaction history from Wirex API
const history = await sdk.api.transactions.list({
  limit: 10
});

console.log('Recent transactions:', history);
```

---

## Error Handling

The SDK provides comprehensive error handling with typed errors:

```typescript
import { StellarError, ApiError, WalletError } from '@wirex/stellar-sdk';

try {
  await sdk.stellar.sendPayment({...});
} catch (error) {
  if (error instanceof StellarError) {
    // Stellar-specific errors
    if (error.code === 'tx_insufficient_balance') {
      console.error('Insufficient XLM balance for transaction');
    } else if (error.code === 'tx_bad_seq') {
      console.error('Sequence number mismatch, retrying...');
    }
  } else if (error instanceof ApiError) {
    // Wirex API errors
    console.error('API error:', error.statusCode, error.message);
  } else if (error instanceof WalletError) {
    // Wallet-related errors
    console.error('Wallet error:', error.message);
  }
}
```

---

## Development Roadmap

### Phase 1: Core Foundation (Weeks 1-4)
- ✅ Project setup (TypeScript, build pipeline, testing)
- ✅ Configuration Module implementation
- ✅ Core types and interfaces
- ✅ Error handling framework

### Phase 2: Stellar Integration (Weeks 5-10)
- ✅ Wallet Management Module (creation, import, signing)
- ✅ Stellar Blockchain Interaction Module (operations, assets)
- ✅ Transaction Management Module (builder, submission, tracking)
- ✅ Soroban contract support

### Phase 3: Backend Integration (Weeks 11-14)
- ✅ API Client Module (REST endpoints)
- ✅ Authentication and session management
- ✅ WebSocket Module (real-time events)

### Phase 4: Testing & Polish (Weeks 15-18)
- ✅ Comprehensive unit tests (>80% coverage)
- ✅ Integration tests on Stellar Testnet
- ✅ End-to-end testing scenarios
- ✅ Performance optimization

### Phase 5: Documentation & Release (Weeks 19-20)
- ✅ API documentation (TypeDoc)
- ✅ Usage guides and examples
- ✅ Migration guides
- ✅ NPM package publishing

**Total Estimated Timeline: 18-20 weeks (4-5 months)**

---

## Testing Strategy

### Unit Tests
- Mock Stellar SDK responses
- Test business logic in isolation
- Target >80% code coverage

### Integration Tests
- Use Stellar Testnet
- Test against real Horizon servers
- Validate Soroban contract interactions

### End-to-End Tests
- Complete user workflows
- Real Wirex API (staging environment)
- WebSocket event handling

### Test Accounts
The SDK will include utilities for managing test accounts:
```typescript
// Create and fund test account automatically
const testWallet = await sdk.testing.createFundedAccount();
```

---

## Documentation Deliverables

1. **API Reference** - Auto-generated TypeDoc documentation
2. **Getting Started Guide** - Quick start tutorial
3. **Module Guides** - Deep dive into each module
4. **Code Examples** - Common use cases and patterns
5. **Migration Guide** - For users of other Stellar SDKs
6. **Troubleshooting** - Common errors and solutions

---

## Package Distribution

**NPM Package Name:** `@wirex/stellar-sdk`

**Installation:**
```bash
npm install @wirex/stellar-sdk
# or
yarn add @wirex/stellar-sdk
# or
pnpm add @wirex/stellar-sdk
```

**Browser CDN:**
```html
<script src="https://cdn.jsdelivr.net/npm/@wirex/stellar-sdk/dist/wirex-sdk.umd.js"></script>
```

---

## Success Metrics

- ✅ **Developer Adoption** - NPM downloads, GitHub stars
- ✅ **Integration Time** - Reduce integration from days to hours
- ✅ **Code Quality** - >80% test coverage, zero critical bugs
- ✅ **Performance** - Transaction submission <2s, API calls <500ms
- ✅ **Documentation** - Complete API docs + 10+ code examples
- ✅ **Community** - Active GitHub issues/PRs, community contributions

---

## Benefits of This SDK

✅ **Simplified Integration** - Abstract Stellar complexity behind intuitive APIs
✅ **Type Safety** - Full TypeScript support prevents runtime errors
✅ **Modular Design** - Use only what you need, tree-shakeable
✅ **Developer Experience** - Fluent APIs, comprehensive documentation
✅ **Production Ready** - Error handling, retry logic, extensive testing
✅ **Future Proof** - Soroban support, extensible architecture
✅ **Multi-Platform** - Node.js, Browser, React Native

---

## Next Steps

1. ✅ **Validate this proposal** with Wirex stakeholders
2. **Finalize feature priorities** within each module
3. **Set up project repository** (GitHub, CI/CD, project structure)
4. **Begin Phase 1 development** - Core foundation
5. **Apply for Stellar Development Grant** with this proposal

---

**Prepared by:** Vottun Development Team
**Date:** December 2025
**Version:** 1.0 (Stellar-Focused)
**Target:** Stellar Development Foundation Grant Application
