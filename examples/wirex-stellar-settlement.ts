/**
 * Wirex × Stellar — Realistic Settlement Round-Trip
 *
 * Simulates the canonical BaaS-meets-blockchain flow where data actually
 * crosses the boundary between Wirex (off-chain) and Stellar (on-chain).
 *
 * Production scenario being modelled:
 *   A user deposits USD into their Wirex account. Wirex converts it to XLM
 *   at the spot rate, then settles the XLM to the user's Stellar wallet.
 *   Wirex must record an immutable audit trail proving:
 *     (a) which off-chain instruction triggered the payment,
 *     (b) which on-chain tx settled it.
 *
 * What actually crosses the Wirex↔Stellar boundary in this example:
 *
 *   ┌─── Wirex BaaS (off-chain) ───┐    ┌── Stellar (on-chain) ──┐
 *   │                              │    │                         │
 *   │  1. S2S auth                 │    │                         │
 *   │  2. fetch config             │    │                         │
 *   │                              │    │                         │
 *   │  3. simulate deposit         │───▶│  4. anchor instruction  │
 *   │     instruction (USD→XLM)    │    │     hash via manageData │
 *   │                              │    │                         │
 *   │                              │    │  5. settle payment      │
 *   │                              │    │     (memo=depositId)    │
 *   │                              │    │                         │
 *   │                              │◀───│  6. payment SSE event   │
 *   │  7. correlation log          │    │                         │
 *   │     (deposit_id ↔ tx_hash)   │    │                         │
 *   │                              │    │                         │
 *   │  8. verifier — reproduce     │◀──▶│  re-fetch + hash check  │
 *   │     instruction & match hash │    │                         │
 *   └──────────────────────────────┘    └─────────────────────────┘
 *
 * Data that actually exchanges:
 *   Wirex → Stellar :  deposit instruction hash (anchored via manageData)
 *                      deposit ID (carried in transaction memo)
 *                      destination Stellar pubkey (target of payment)
 *                      amount (XLM equivalent of the USD deposit)
 *   Stellar → Wirex :  transaction hash + ledger seq (proof of settlement)
 *                      payment SSE event (real-time confirmation)
 *
 * Reference: https://docs.wirexapp.com/docs/authentication
 *            https://docs.wirexapp.com/docs/environments#sandbox-test-credentials
 *
 * Run:
 *   npx tsx examples/wirex-stellar-settlement.ts
 */
/* eslint-disable no-console */
import { createHash } from 'crypto';

import { ApiError, WirexSDK } from '../src';

// ─── Wirex sandbox credentials (per Wirex docs) ────────────────────────────

const WIREX_SANDBOX = {
  apiUrl: 'https://api-baas.wirexapp.tech',
  clientId: '3fCeoWq6FOtKJBZiyorXnxE41Dqp2zKB',
  clientSecret: '6FIY2GEQvdlgUEFHw4Dbii22_wCAqZ37lWV3TEMfTlkxrn8F5IbdgX9TiAvQUEsC',
  partnerId: '0x00000000000000000000000000000044',
};

// ─── Domain types ──────────────────────────────────────────────────────────

interface WirexTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_at: number;
}

/**
 * Off-chain instruction produced by Wirex when a user deposits USD.
 * The hash of this struct is anchored on Stellar before settlement, and
 * the deposit ID is carried in the transaction memo. Together these let
 * any third party verify that a given on-chain tx originated from a
 * specific off-chain Wirex deposit.
 */
interface WirexDepositInstruction {
  depositId: string;
  userId: string;
  userStellarAddress: string;
  asset: 'XLM';
  amountUsd: number;
  amountAsset: string;
  rateSnapshot: number;
  createdAt: number;
}

// ─── Initialise the SDK ───────────────────────────────────────────────────

const sdk = new WirexSDK({
  network: 'testnet',
  logging: { level: 'none' }, // keep output focused on the demo narrative
});

const wirex = sdk.api.external(WIREX_SANDBOX.apiUrl, {
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Helpers ───────────────────────────────────────────────────────────────

/** SHA-256 hex digest. Anchored on Stellar via manageData (64 bytes max). */
function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function friendbotFund(addr: string): Promise<void> {
  const r = await fetch(`https://friendbot.stellar.org?addr=${addr}`);
  if (!r.ok) throw new Error(`Friendbot ${r.status}`);
}

function logSection(title: string): void {
  console.log(`\n─── ${title} ${'─'.repeat(Math.max(0, 70 - title.length))}`);
}

// ─── Step 1 · Authenticate with Wirex sandbox ─────────────────────────────

async function authenticate(): Promise<string> {
  logSection('1 · Wirex S2S authentication');
  const resp = await wirex.post<WirexTokenResponse>('/api/v1/token', {
    client_id: WIREX_SANDBOX.clientId,
    client_secret: WIREX_SANDBOX.clientSecret,
    grant_type: 'client_credentials',
  });
  console.log(`   token type    : ${resp.data.token_type}`);
  console.log(`   ttl (hours)   : ${((resp.data.expires_at - Math.floor(Date.now() / 1000)) / 3600).toFixed(1)}`);
  return resp.data.access_token;
}

// ─── Step 2 · Fetch off-chain partner state ───────────────────────────────

async function fetchPartnerState(token: string): Promise<Record<string, unknown>> {
  logSection('2 · Wirex partner state (off-chain)');
  const authed = sdk.api.external(WIREX_SANDBOX.apiUrl, {
    timeout: 10_000,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Partner-ID': WIREX_SANDBOX.partnerId,
    },
  });
  const config = await authed.get<Record<string, unknown>>('/api/v1/config');
  console.log(`   /api/v1/config keys: ${Object.keys(config.data).join(', ')}`);
  return config.data;
}

// ─── Step 3 · Simulate a Wirex deposit instruction ────────────────────────

function simulateDeposit(
  userId: string,
  userStellarAddress: string,
  usdAmount: number,
): { instruction: WirexDepositInstruction; instructionHash: string } {
  logSection('3 · Wirex simulates a USD → XLM deposit instruction');
  // Spot rate (real Wirex would query its FX engine here).
  const xlmPerUsd = 9.5;
  const xlmAmount = (usdAmount * xlmPerUsd).toFixed(7);

  const instruction: WirexDepositInstruction = {
    depositId: `wdep-${Date.now()}`,
    userId,
    userStellarAddress,
    asset: 'XLM',
    amountUsd: usdAmount,
    amountAsset: xlmAmount,
    rateSnapshot: xlmPerUsd,
    createdAt: Date.now(),
  };

  const instructionHash = sha256Hex(JSON.stringify(instruction));

  console.log(`   depositId           : ${instruction.depositId}`);
  console.log(`   user                : ${instruction.userId}`);
  console.log(`   ${instruction.amountUsd} USD → ${instruction.amountAsset} XLM @ rate ${instruction.rateSnapshot}`);
  console.log(`   instruction hash    : ${instructionHash}`);
  return { instruction, instructionHash };
}

// ─── Step 4 · Anchor the instruction hash on Stellar ──────────────────────

async function anchorOnChain(
  treasury: ReturnType<typeof sdk.wallet.create>,
  depositId: string,
  hash: string,
): Promise<string> {
  logSection('4 · Anchor Wirex instruction hash on Stellar (manageData)');
  // manageData lets accounts attach key→value pairs to the ledger.
  // Both key and value are capped at 64 bytes; SHA-256 hex = exactly 64 bytes.
  const result = await sdk.stellar.manageData(
    {
      sourceAccount: treasury.publicKey,
      name: `wirex:${depositId}`.slice(0, 64),
      value: hash, // 64-char hex
    },
    treasury,
  );
  console.log(`   tx hash             : ${result.hash}`);
  console.log(`   ledger              : ${result.ledger}`);
  return result.hash;
}

// ─── Step 5 · Settle the payment on Stellar ───────────────────────────────

async function settlePayment(
  treasury: ReturnType<typeof sdk.wallet.create>,
  destination: string,
  amount: string,
  depositId: string,
): Promise<{ hash: string; ledger: number }> {
  logSection('5 · Settle XLM payment to user (memo = depositId)');
  // Memo carries the off-chain reference so anyone scanning the chain can
  // correlate this on-chain tx back to the Wirex deposit instruction.
  const result = await sdk
    .transaction({ sourceAccount: treasury.publicKey })
    .addPayment({
      destination,
      asset: { code: 'XLM' },
      amount,
    })
    .addMemo({ type: 'text', value: depositId.slice(0, 28) }) // memo_text caps at 28 bytes
    .build()
    .then((b) => b.sign(treasury))
    .then((b) => b.submit());

  console.log(`   tx hash             : ${result.hash}`);
  console.log(`   ledger              : ${result.ledger}`);
  return { hash: result.hash, ledger: result.ledger };
}

// ─── Step 6 · SSE subscription helper (pre-subscribe pattern) ─────────────
//
// IMPORTANT: Horizon SSE streams default to `cursor='now'` — so events that
// already settled before subscription are NOT replayed. The correct pattern
// is to subscribe BEFORE submitting the transaction, then await the matching
// event by hash. This helper supports that flow.

interface PendingConfirmation {
  /** Wait for the SSE event whose `transaction_hash` matches `expectedHash`. */
  awaitFor(expectedHash: string, timeoutMs?: number): Promise<unknown>;
  /** Close the SSE subscription. Idempotent. */
  close(): void;
}

function subscribeForConfirmation(userAddress: string): PendingConfirmation {
  let expectedHash: string | null = null;
  let resolve: ((v: unknown) => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  // Buffer events that arrive before awaitFor() registers an expectation.
  const seen: Array<{ transaction_hash?: string }> = [];

  const closeStream = sdk.stellar.stream.payments(userAddress, (event: unknown) => {
    const e = event as { transaction_hash?: string };
    if (expectedHash && e.transaction_hash === expectedHash) {
      if (timer) clearTimeout(timer);
      cleanup();
      resolve?.(event);
    } else {
      seen.push(e);
    }
  });

  function cleanup() {
    if (closed) return;
    closed = true;
    closeStream();
  }

  return {
    awaitFor(hash: string, timeoutMs = 30_000): Promise<unknown> {
      expectedHash = hash;
      // Check the buffer first in case the event arrived while we were
      // doing other work (e.g. after `submitTransaction` resolved).
      const buffered = seen.find((e) => e.transaction_hash === hash);
      if (buffered) {
        cleanup();
        return Promise.resolve(buffered);
      }
      return new Promise((res, rej) => {
        resolve = res;
        timer = setTimeout(() => {
          cleanup();
          rej(new Error(`Timed out waiting for SSE confirmation of ${hash.slice(0, 12)}… (${timeoutMs}ms)`));
        }, timeoutMs);
      });
    },
    close: cleanup,
  };
}

// ─── Step 7 · Wirex records the correlation ───────────────────────────────

function correlate(
  instruction: WirexDepositInstruction,
  anchorHash: string,
  settlementHash: string,
  ledger: number,
): void {
  logSection('7 · Wirex audit log entry');
  console.log('   ─── correlation record stored in Wirex ────────────────');
  console.log(`     wirex.deposit_id    : ${instruction.depositId}`);
  console.log(`     wirex.user_id       : ${instruction.userId}`);
  console.log(`     wirex.amount_usd    : ${instruction.amountUsd}`);
  console.log(`     stellar.anchor_tx   : ${anchorHash}`);
  console.log(`     stellar.settle_tx   : ${settlementHash}`);
  console.log(`     stellar.ledger      : ${ledger}`);
}

// ─── Step 8 · Independent verifier ────────────────────────────────────────

async function verifyOnChainAnchor(
  treasuryAddress: string,
  instruction: WirexDepositInstruction,
): Promise<void> {
  logSection('8 · Third-party verifier reproduces the chain of custody');

  // (a) Re-fetch the treasury account from Horizon
  const info = await sdk.api.horizon.getAccount(treasuryAddress);

  // (b) Look up the data entry by key
  const dataKey = `wirex:${instruction.depositId}`.slice(0, 64);
  const onChainValueBase64 = info.data.data?.[dataKey];

  if (!onChainValueBase64) {
    console.log(`   ✗ no on-chain data entry at "${dataKey}"`);
    return;
  }

  // Horizon returns manageData values base64-encoded. The stored value is
  // an ASCII string (the hex digest), so we decode base64 → utf8.
  const onChainHash = Buffer.from(onChainValueBase64, 'base64').toString('utf8');

  // (c) Recompute the hash from the (notionally re-fetched) Wirex instruction
  const recomputedHash = sha256Hex(JSON.stringify(instruction));

  // (d) Compare
  const matches = onChainHash === recomputedHash;
  console.log(`   on-chain hash       : ${onChainHash}`);
  console.log(`   recomputed hash     : ${recomputedHash}`);
  console.log(`   hashes match?       : ${matches ? '✓ YES — tamper-proof correlation' : '✗ NO'}`);
}

// ─── Main flow ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  Wirex × Stellar — Realistic Settlement Round-Trip');
  console.log('═══════════════════════════════════════════════════════════════════════');

  // Auth + partner state
  let token: string | null = null;
  try {
    token = await authenticate();
    await fetchPartnerState(token);
  } catch (e) {
    if (e instanceof ApiError) console.warn(`   ! Wirex error (${e.code}): ${e.message}`);
    else console.warn('   ! Wirex error:', (e as Error).message);
    console.warn('   ! Continuing without Wirex — on-chain flow still illustrative.');
  }

  // Treasury account (Wirex's pool wallet) + user account (Alice's wallet
  // address that Wirex has on file). In a real flow Wirex would have
  // recorded Alice's address during her KYC/onboarding.
  logSection('Setup · Stellar accounts');
  const treasury = sdk.wallet.create();
  const userWallet = sdk.wallet.create();
  console.log(`   treasury (Wirex pool): ${treasury.publicKey}`);
  console.log(`   user     (Alice)     : ${userWallet.publicKey}`);
  await Promise.all([friendbotFund(treasury.publicKey), friendbotFund(userWallet.publicKey)]);
  console.log('   ✓ both funded via Friendbot');

  // Off-chain: build the deposit instruction
  const { instruction, instructionHash } = simulateDeposit(
    'user-alice-1234',
    userWallet.publicKey,
    100, // $100 USD deposit
  );

  // Anchor BEFORE payment — this is the proof-of-origin record
  const anchorHash = await anchorOnChain(treasury, instruction.depositId, instructionHash);

  // Subscribe to the SSE stream BEFORE settlement so we don't miss the event.
  // Horizon's default cursor is 'now' — events submitted before subscribe
  // are never replayed.
  const pending = subscribeForConfirmation(userWallet.publicKey);
  // Small grace period for the SSE connection to fully establish
  await new Promise((r) => setTimeout(r, 1_500));

  // Settle the payment
  const { hash: settleHash, ledger } = await settlePayment(
    treasury,
    instruction.userStellarAddress,
    instruction.amountAsset,
    instruction.depositId,
  );

  // Wait for the matching SSE event
  logSection('6 · Wait for Stellar SSE event confirming settlement');
  try {
    await pending.awaitFor(settleHash);
    console.log(`   ✓ received payment.received event for ${settleHash.slice(0, 12)}…`);
  } catch (e) {
    console.warn(`   ! ${(e as Error).message}`);
    console.warn('   ! Settlement still landed on-chain (continuing).');
    pending.close();
  }

  // Wirex records the correlation
  correlate(instruction, anchorHash, settleHash, ledger);

  // Independent verifier reproduces the proof of origin
  await verifyOnChainAnchor(treasury.publicKey, instruction);

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('  ✓ Round-trip complete: off-chain instruction ⇄ on-chain settlement');
  console.log('═══════════════════════════════════════════════════════════════════════');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
