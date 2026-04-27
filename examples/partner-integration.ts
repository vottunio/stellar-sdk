/**
 * Partner Integration Pattern — Phase 2.5.6
 *
 * Demonstrates how a partner (e.g. Wirex) connects their backend API via
 * `sdk.api.external()` to coordinate off-chain and on-chain flows. This is
 * the recommended integration pattern for BaaS providers.
 *
 * Architecture:
 *
 *   ┌──────────────┐      ┌──────────────────┐      ┌──────────────┐
 *   │  Your App    │─────▶│  Partner BaaS API │─────▶│  Stellar     │
 *   │  (SDK user)  │      │  (e.g. Wirex)     │      │  Network     │
 *   └──────────────┘      └──────────────────┘      └──────────────┘
 *        │                                                  ▲
 *        │  sdk.api.external(...)  ← HTTP with retry        │
 *        │  sdk.reference.createSettlement(...)  ← on-chain │
 *        └──────────────────────────────────────────────────┘
 *
 * Non-custodial: The SDK user holds their own keys. The partner API never
 * receives private keys — only unsigned transaction envelopes that the user
 * signs client-side before submission.
 *
 * Prerequisites:
 *   - Node.js 18+
 *   - pnpm install
 *   - Partner API credentials (see PLAN.md for Wirex sandbox creds)
 *
 * Run:
 *   npx ts-node examples/partner-integration.ts
 */

import { WirexSDK } from '../src';

// ─── Configuration ─────────────────────────────────────────────────────────

// Wirex BaaS sandbox credentials (shared, for initial testing).
// Replace with your own credentials for production use.
const PARTNER_CONFIG = {
  apiUrl: 'https://api-baas.wirexapp.tech',
  clientId: '3fCeoWq6FOtKJBZiyorXnxE41Dqp2zKB',
  clientSecret: '6FIY2GEQvdlgUEFHw4Dbii22_wCAqZ37lWV3TEMfTlkxrn8F5IbdgX9TiAvQUEsC',
  partnerId: '0x00000000000000000000000000000044',
};

// ─── Partner Integration Flow ──────────────────────────────────────────────

async function main() {
  const sdk = new WirexSDK({ network: 'testnet', logging: { level: 'info' } });

  // ─── Step 1: Create an external API client for the partner ────────────
  //
  // The ExternalClientFactory reuses the SDK's retry logic, interceptors,
  // and error mapping. You get automatic retry on 429/502/503/504 and
  // standardized ApiError objects.

  console.log('=== Step 1: Connect to partner API ===');

  const partnerClient = sdk.api.external(PARTNER_CONFIG.apiUrl, {
    timeout: 15000,
    headers: {
      'X-Partner-Id': PARTNER_CONFIG.partnerId,
    },
  });

  console.log(`Connected to partner API: ${PARTNER_CONFIG.apiUrl}`);

  // ─── Step 2: Authenticate with the partner API ────────────────────────
  //
  // Most BaaS APIs use OAuth2 client_credentials flow. Here we demonstrate
  // the pattern — the actual endpoint depends on the partner.

  console.log('\n=== Step 2: Authenticate with partner API ===');

  try {
    const authResponse = await partnerClient.post<{
      access_token: string;
      expires_in: number;
    }>('/oauth/token', {
      grant_type: 'client_credentials',
      client_id: PARTNER_CONFIG.clientId,
      client_secret: PARTNER_CONFIG.clientSecret,
    });

    const token = authResponse.data.access_token;
    console.log(`Auth token obtained (expires in ${authResponse.data.expires_in}s)`);

    // Create an authenticated client for subsequent requests
    const authedClient = sdk.api.external(PARTNER_CONFIG.apiUrl, {
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Partner-Id': PARTNER_CONFIG.partnerId,
      },
    });

    // ─── Step 3: Coordinate off-chain + on-chain ──────────────────────
    //
    // Pattern: The partner API may provide pre-built transaction envelopes,
    // account verification, compliance checks, etc. The SDK user handles
    // on-chain operations (signing, submission, settlement).

    console.log('\n=== Step 3: Off-chain coordination ===');

    // Example: Query partner for available accounts or transfers
    // const accounts = await authedClient.get('/v1/accounts');
    // const transfers = await authedClient.get('/v1/transfers');

    // ─── Step 4: On-chain settlement ──────────────────────────────────
    //
    // After off-chain coordination, execute the settlement on-chain using
    // the SDK's reference flow. The wallet signs locally — no keys leave
    // the client.

    console.log('\n=== Step 4: On-chain settlement ===');

    const wallet = sdk.wallet.create();
    await sdk.stellar.fundTestAccount(wallet.publicKey);

    const destination = sdk.wallet.create();
    await sdk.stellar.fundTestAccount(destination.publicKey);

    const result = await sdk.reference.createSettlement(
      {
        asset: 'XLM',
        amount: '50',
        destination: destination.publicKey,
        memo: { type: 'text', value: 'partner-settlement' },
      },
      wallet,
    );

    console.log(`Settlement: ${result.successful ? 'SUCCESS' : 'FAILED'}`);
    if (result.transaction) {
      console.log(`Tx: ${result.transaction.hash}`);
    }

    // ─── Step 5: Report back to partner API ───────────────────────────
    //
    // Notify the partner that the on-chain settlement completed.

    console.log('\n=== Step 5: Report settlement to partner ===');

    if (result.transaction) {
      // Example: POST settlement confirmation back to partner
      // await authedClient.post('/v1/settlements/confirm', {
      //   transactionHash: result.transaction.hash,
      //   ledger: result.transaction.ledger,
      //   asset: 'XLM',
      //   amount: '50',
      // });
      console.log('Settlement confirmation would be sent to partner API.');
    }
  } catch (error) {
    // If the partner API is unavailable (sandbox may be down), we demonstrate
    // the pattern anyway — the on-chain part works independently.
    console.log(`Partner API auth failed (expected in demo): ${(error as Error).message}`);
    console.log('The on-chain settlement pattern works independently of the partner API.');

    // On-chain only demo
    console.log('\n=== Fallback: On-chain only settlement ===');
    const wallet = sdk.wallet.create();
    const destination = sdk.wallet.create();
    await sdk.stellar.fundTestAccount(wallet.publicKey);
    await sdk.stellar.fundTestAccount(destination.publicKey);

    const result = await sdk.reference.createSettlement(
      { asset: 'XLM', amount: '25', destination: destination.publicKey },
      wallet,
    );
    console.log(`Settlement: ${result.successful ? 'SUCCESS' : 'FAILED'}`);
    if (result.transaction) {
      console.log(`Tx: ${result.transaction.hash}`);
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────

  console.log('\n=== Partner Integration Pattern Summary ===');
  console.log('1. sdk.api.external(url, opts) — create partner API client with retry + error mapping');
  console.log('2. Authenticate with partner (OAuth2 / API key)');
  console.log('3. Coordinate off-chain (compliance, account lookup, tx envelopes)');
  console.log('4. sdk.reference.createSettlement(...) — on-chain settlement');
  console.log('5. Report confirmation back to partner API');
  console.log('\nKey: Wallet signs locally. No private keys leave the client.');
}

main().catch((err) => {
  console.error('Partner integration demo failed:', err);
  process.exit(1);
});
