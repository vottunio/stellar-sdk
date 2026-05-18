/**
 * Wirex BaaS × Stellar — Full External-Connection Example
 *
 * Demonstrates the recommended end-to-end pattern for integrating a partner
 * BaaS (Banking-as-a-Service) backend with the on-chain Stellar SDK in a
 * single coherent flow.
 *
 *   ┌────────────────┐  1. OAuth   ┌──────────────────┐  3. on-chain  ┌────────────┐
 *   │  Your Service  │────────────▶│  Wirex BaaS API  │               │  Stellar   │
 *   │   (this code)  │             │   (sandbox)      │               │  Testnet   │
 *   └────────┬───────┘             └────────┬─────────┘               └─────▲──────┘
 *            │                              │                               │
 *            │  2. partner-level queries (config, validation rules)         │
 *            │                                                              │
 *            │  4. settlement (Wirex pattern: create → trustline → pay → confirm)
 *            └──────────────────────────────────────────────────────────────┘
 *
 * What this example does
 * ──────────────────────
 *   1. Authenticate against Wirex sandbox via S2S token exchange
 *      (POST /api/v1/token — client_credentials grant)
 *   2. Fetch partner-level config and validation rules (off-chain BaaS state)
 *   3. Create a non-custodial Stellar wallet client-side
 *   4. Fund it via Stellar testnet Friendbot
 *   5. Run the full Wirex settlement flow on-chain
 *      (validate_source → validate_destination → check_trustline → send_payment → confirm)
 *   6. Subscribe to real-time payment events for the wallet
 *   7. Use Soroban to read on-chain token state (name, balance)
 *
 * Non-custodial: the user's secret key stays in this process. Wirex never
 * sees it. Only signed transaction envelopes are submitted to Stellar.
 *
 * Reference: https://docs.wirexapp.com/docs/authentication
 *            https://docs.wirexapp.com/docs/environments#sandbox-test-credentials
 *
 * Auth credentials are the shared Wirex sandbox creds. For production,
 * request dedicated credentials from Wirex.
 *
 * Prerequisites:
 *   - Node.js 18+
 *   - Internet access (Wirex sandbox + Stellar testnet)
 *   - The Wirex sandbox is publicly accessible; no whitelisting needed
 *
 * Run:
 *   npx tsx examples/wirex-baas-full-flow.ts
 */
/* eslint-disable no-console */
import { WirexSDK, ApiError } from '../src';

// ─── Configuration ─────────────────────────────────────────────────────────

const WIREX_SANDBOX = {
  // Sandbox uses `.tech`; production uses `.com`
  apiUrl: 'https://api-baas.wirexapp.tech',
  clientId: '3fCeoWq6FOtKJBZiyorXnxE41Dqp2zKB',
  clientSecret: '6FIY2GEQvdlgUEFHw4Dbii22_wCAqZ37lWV3TEMfTlkxrn8F5IbdgX9TiAvQUEsC',
  partnerId: '0x00000000000000000000000000000044',
};

// Native XLM Stellar Asset Contract (testnet, permanent)
const XLM_SAC_CONTRACT = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

// ─── Wirex API response shapes (per docs.wirexapp.com) ────────────────────

interface WirexTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  /** Unix timestamp (seconds) when the token expires. Tokens are valid for 48 hours. */
  expires_at: number;
}

// ─── Step 1: Initialize the SDK ────────────────────────────────────────────

const sdk = new WirexSDK({
  network: 'testnet',
  logging: { level: 'info' },
});

console.log('SDK initialized:');
console.log('  network:', sdk.config.network);
console.log('  horizonUrl:', sdk.config.horizonUrl);

// ─── Step 2: Wirex BaaS — S2S token exchange ───────────────────────────────

async function authenticateWithWirex(): Promise<string | null> {
  console.log('\n[Wirex] S2S token exchange — POST /api/v1/token...');

  // Create a typed external API client pointed at Wirex sandbox.
  // The SDK applies the same rate-limit, retry, and error-mapping behavior
  // as for Horizon/Soroban calls.
  const wirex = sdk.api.external(WIREX_SANDBOX.apiUrl, {
    timeout: 10_000,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    // Per Wirex docs: POST /api/v1/token with client_credentials grant
    // (https://docs.wirexapp.com/docs/authentication)
    const resp = await wirex.post<WirexTokenResponse>('/api/v1/token', {
      client_id: WIREX_SANDBOX.clientId,
      client_secret: WIREX_SANDBOX.clientSecret,
      grant_type: 'client_credentials',
    });

    const ttlSeconds = resp.data.expires_at - Math.floor(Date.now() / 1000);
    console.log(
      `[Wirex] ✓ authenticated, token type=${resp.data.token_type}, ttl=${(ttlSeconds / 3600).toFixed(1)}h`,
    );
    return resp.data.access_token;
  } catch (e) {
    // Sandbox shape can drift; surface the error and continue with on-chain
    // demo so the example is always runnable.
    if (e instanceof ApiError) {
      console.warn(`[Wirex] auth failed (${e.code}): ${e.message}`);
    } else {
      console.warn('[Wirex] auth failed:', (e as Error).message);
    }
    console.warn('[Wirex] (continuing without Wirex auth — on-chain flow still works)');
    return null;
  }
}

// ─── Step 3: Off-chain partner-level queries ───────────────────────────────

async function queryPartnerEndpoints(token: string): Promise<void> {
  console.log('\n[Wirex] Fetching partner-level endpoints...');

  // Endpoints that DON'T require user-identity headers (per Wirex docs):
  //   GET  /api/v1/config            — application configuration
  //   GET  /api/v1/validation/rules  — validation rules
  //   POST /api/v1/user              — user registration (v1)
  //   POST /api/v2/user              — user registration (v2)
  const wirex = sdk.api.external(WIREX_SANDBOX.apiUrl, {
    timeout: 10_000,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Partner-ID': WIREX_SANDBOX.partnerId,
    },
  });

  // (a) Application configuration
  try {
    const config = await wirex.get<Record<string, unknown>>('/api/v1/config');
    const keys = Object.keys(config.data).slice(0, 5);
    console.log(`[Wirex] /api/v1/config → ${keys.length} top-level keys: ${keys.join(', ')}`);
  } catch (e) {
    console.warn('[Wirex] /api/v1/config failed:', (e as Error).message);
  }

  // (b) Validation rules
  try {
    const rules = await wirex.get<Record<string, unknown>>('/api/v1/validation/rules');
    const keys = Object.keys(rules.data).slice(0, 5);
    console.log(
      `[Wirex] /api/v1/validation/rules → ${keys.length} rule sets: ${keys.join(', ')}`,
    );
  } catch (e) {
    console.warn('[Wirex] /api/v1/validation/rules failed:', (e as Error).message);
  }
}

// ─── Step 4: Create + fund Stellar wallet ──────────────────────────────────

async function createAndFundWallet() {
  console.log('\n[Stellar] Creating non-custodial wallet...');
  const wallet = sdk.wallet.create();
  console.log('[Stellar] publicKey:', wallet.publicKey);

  console.log('[Stellar] Funding via Friendbot...');
  const r = await fetch(`https://friendbot.stellar.org?addr=${wallet.publicKey}`);
  if (!r.ok) throw new Error(`Friendbot failed: ${r.status}`);
  console.log('[Stellar] ✓ funded (10,000 XLM)');

  return wallet;
}

// ─── Step 5: On-chain settlement via the reference flow ────────────────────

async function runSettlement(alice: ReturnType<typeof sdk.wallet.create>) {
  console.log('\n[Stellar] Creating recipient + running XLM settlement...');
  const bob = sdk.wallet.create();
  const r = await fetch(`https://friendbot.stellar.org?addr=${bob.publicKey}`);
  if (!r.ok) throw new Error(`Friendbot failed for Bob: ${r.status}`);

  // sdk.reference.createSettlement does the whole flow:
  //   validate_source → validate_destination → check_trustline → send_payment → confirm
  const result = await sdk.reference.createSettlement(
    {
      asset: 'XLM',
      amount: '12.5',
      destination: bob.publicKey,
      memo: { type: 'text', value: 'wirex-baas-demo' },
    },
    alice,
  );

  console.log(
    `[Stellar] ✓ settlement: ${result.successful ? 'SUCCESS' : 'FAILED'} in ${result.totalDurationMs}ms`,
  );
  for (const s of result.steps) {
    const hash = s.hash ? ` ${s.hash.slice(0, 12)}…` : '';
    const dur = s.durationMs ? ` (${s.durationMs}ms)` : '';
    console.log(`  • ${s.name}: ${s.status}${dur}${hash}`);
  }
  return { result, bob };
}

// ─── Step 6: Live event streaming ──────────────────────────────────────────

async function streamPaymentsBriefly(addr: string): Promise<number> {
  console.log('\n[Stellar] Streaming payments for 8s...');
  let count = 0;
  const close = sdk.stellar.stream.payments(addr, (_p) => {
    count++;
    console.log(`  [stream] payment event #${count}`);
  });
  await new Promise((r) => setTimeout(r, 8_000));
  close();
  console.log(`[Stellar] ✓ closed stream (received ${count} events)`);
  return count;
}

// ─── Step 7: Soroban read ──────────────────────────────────────────────────

async function readOnChainTokenState(addr: string): Promise<void> {
  console.log('\n[Soroban] Reading XLM SAC contract state...');
  const name = await sdk.soroban.readContract({
    contractId: XLM_SAC_CONTRACT,
    method: 'name',
    args: [],
    sourceAccount: addr,
  });
  const balance = await sdk.soroban.readContract({
    contractId: XLM_SAC_CONTRACT,
    method: 'balance',
    args: [sdk.soroban.nativeToScVal(addr, 'address')],
    sourceAccount: addr,
  });
  console.log('[Soroban] token name :', name.returnValue);
  console.log('[Soroban] balance    :', balance.returnValue, 'stroops');
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Wirex BaaS × Stellar — Full External-Connection Example');
  console.log('═══════════════════════════════════════════════════════════════');

  // 1. Wirex S2S auth (flow continues even if sandbox auth fails)
  const token = await authenticateWithWirex();
  if (token) await queryPartnerEndpoints(token);

  // 2. Stellar wallet creation + funding
  const alice = await createAndFundWallet();

  // 3. On-chain settlement
  const { bob } = await runSettlement(alice);

  // 4. Stream events
  await streamPaymentsBriefly(bob.publicKey);

  // 5. Soroban read
  await readOnChainTokenState(bob.publicKey);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ✓ End-to-end Wirex + Stellar flow complete');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
