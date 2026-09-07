#!/usr/bin/env node
/**
 * Mainnet Transaction Proof (Phase 3.4.8)
 *
 * Submits a single small payment on Stellar mainnet and captures the
 * confirmation artifacts. Used to satisfy the the grant acceptance criterion:
 *   "Successful mainnet transactions executed using the SDK."
 *
 * Supports two ways to load the source wallet:
 *
 *   (A) Mnemonic — BIP39 phrase (12 or 24 words), SEP-0005 derivation path
 *       export MAINNET_MNEMONIC="word1 word2 word3 ... word24"
 *       # optional: export MAINNET_DERIVE_INDEX=0   (defaults to 0)
 *
 *   (B) Secret key — Stellar S… key directly
 *       export MAINNET_SECRET="S....."
 *
 * If both are set, MAINNET_MNEMONIC takes precedence.
 *
 * Destination:
 *   export MAINNET_DEST="G....."        # any mainnet account
 *   # OR
 *   export MAINNET_DEST="self"          # send to source (self-payment proof)
 *
 * Optional:
 *   export MAINNET_AMOUNT="0.0001"      # XLM (default 0.0001)
 *   export MAINNET_DRY_RUN="1"          # skip the actual submission
 *
 * Run:
 *   nvm use 22
 *   npx tsx scripts/mainnet-proof.ts
 *
 * The script prints the full plan and waits for `y` confirmation before
 * submitting. After confirmation, it writes the proof artifacts to
 *   docs/release/mainnet-proof-record.md
 * which you commit + reference in the GitHub v1.0.0 release.
 *
 * Security:
 *   - Never paste your secret key or mnemonic into chat, tickets, or PRs.
 *   - The script never logs the secret or mnemonic — only the derived public key.
 *   - The Logger is at level 'info' which excludes any debug-only key references.
 */
/* eslint-disable no-console */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

import { WirexSDK, Wallet } from '../src';

// ─── Inputs from env ─────────────────────────────────────────────────────

const MNEMONIC = process.env.MAINNET_MNEMONIC?.trim();
const SECRET = process.env.MAINNET_SECRET?.trim();
const DEST_RAW = process.env.MAINNET_DEST?.trim();
const AMOUNT = (process.env.MAINNET_AMOUNT ?? '0.0001').trim();
const DERIVE_INDEX = parseInt(process.env.MAINNET_DERIVE_INDEX ?? '0', 10);
const DRY_RUN = process.env.MAINNET_DRY_RUN === '1';

// ─── Validation ──────────────────────────────────────────────────────────

if (!MNEMONIC && !SECRET) {
  console.error(
    'Missing source wallet. Set ONE of:\n' +
    '  MAINNET_MNEMONIC="word1 word2 ... word24"\n' +
    '  MAINNET_SECRET="S....."\n',
  );
  process.exit(1);
}
if (SECRET && !SECRET.startsWith('S')) {
  console.error('MAINNET_SECRET must start with "S" (Stellar secret key)');
  process.exit(1);
}
if (!DEST_RAW) {
  console.error(
    'Missing destination. Set:\n' +
    '  MAINNET_DEST="G....."   (any mainnet account)\n' +
    '  or\n' +
    '  MAINNET_DEST="self"     (self-payment — sends to source account)\n',
  );
  process.exit(1);
}
if (DERIVE_INDEX < 0 || !Number.isInteger(DERIVE_INDEX)) {
  console.error('MAINNET_DERIVE_INDEX must be a non-negative integer');
  process.exit(1);
}
if (!/^\d+(\.\d{1,7})?$/.test(AMOUNT) || parseFloat(AMOUNT) <= 0) {
  console.error('MAINNET_AMOUNT must be a positive decimal with ≤ 7 fractional digits');
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function divider(): void {
  console.log('═'.repeat(72));
}

function isoNow(): string {
  return new Date().toISOString();
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(question, (answer) => {
      rl.close();
      res(answer.trim());
    });
  });
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  divider();
  console.log('  Stellar Mainnet Proof Transaction (Phase 3.4.8)');
  divider();

  // 1. Build the SDK on mainnet
  const sdk = new WirexSDK({ network: 'mainnet', logging: { level: 'info' } });

  // 2. Load wallet from mnemonic or secret
  let wallet: Wallet;
  let sourceMethod: string;
  if (MNEMONIC) {
    wallet = sdk.wallet.importFromMnemonic(MNEMONIC, DERIVE_INDEX);
    sourceMethod = `mnemonic (BIP39, m/44'/148'/${DERIVE_INDEX}')`;
  } else {
    wallet = sdk.wallet.importFromSecret(SECRET as string);
    sourceMethod = 'secret key (S…)';
  }

  // 3. Resolve destination
  const destination = DEST_RAW === 'self' ? wallet.publicKey : (DEST_RAW as string);
  if (destination !== wallet.publicKey && !destination.startsWith('G')) {
    console.error('MAINNET_DEST must start with "G" or be "self"');
    process.exit(1);
  }
  const isSelfPayment = destination === wallet.publicKey;

  // 4. Print the plan
  console.log('  source loaded via : ' + sourceMethod);
  console.log('  source pubkey     : ' + wallet.publicKey);
  console.log('  destination       : ' + destination + (isSelfPayment ? '  (self-payment)' : ''));
  console.log('  asset             : XLM (native)');
  console.log('  amount            : ' + AMOUNT + ' XLM');
  console.log('  memo (text)       : wirex-sdk-1.0.0-proof');
  console.log('  network           : ' + sdk.config.network);
  console.log('  horizonUrl        : ' + sdk.config.horizonUrl);
  console.log('  dry run?          : ' + (DRY_RUN ? 'YES (no submission)' : 'NO (REAL XLM moves)'));
  divider();

  // 5. Balance check
  console.log('\nChecking source balance on mainnet Horizon...');
  let balanceXlm = 0;
  try {
    const balances = await sdk.stellar.getBalances(wallet.publicKey);
    const xlm = balances.find((b) => b.code === 'XLM');
    balanceXlm = xlm ? parseFloat(xlm.balance) : 0;
    console.log('  current XLM balance : ' + balanceXlm);
  } catch (err) {
    console.error('\n✗ Could not load source account from mainnet Horizon.');
    console.error('  Error: ' + (err as Error).message);
    console.error('\n  This usually means the account is not yet on-chain.');
    console.error('  Fund the source address with at least 2 XLM from an exchange first.');
    process.exit(1);
  }

  const required = 1 + parseFloat(AMOUNT) + 0.5; // 1 XLM reserve + amount + ~0.5 XLM headroom for fees
  if (balanceXlm < required) {
    console.error(`\n✗ Insufficient XLM. Need ≥ ${required} XLM, have ${balanceXlm}.`);
    console.error('  (1 XLM base reserve + ' + AMOUNT + ' XLM amount + 0.5 XLM fee headroom)');
    process.exit(1);
  }

  // 6. Final confirmation
  if (!DRY_RUN) {
    console.log('');
    console.log('  ⚠ This transaction will be submitted to STELLAR MAINNET.');
    console.log('  ⚠ Real XLM will move. There is no undo.');
    console.log('');
    const answer = await prompt('Type "yes" to submit, anything else to abort: ');
    if (answer.toLowerCase() !== 'yes') {
      console.log('Aborted by user. No transaction submitted.');
      process.exit(0);
    }
  } else {
    console.log('\n[DRY RUN] Skipping submission.');
  }

  // 7. Build + sign + submit
  console.log('\nBuilding transaction...');
  const builder = await sdk
    .transaction({ sourceAccount: wallet.publicKey })
    .addPayment({ destination, asset: { code: 'XLM' }, amount: AMOUNT })
    .addMemo({ type: 'text', value: 'wirex-sdk-1.0.0-proof' })
    .build();

  console.log('Signing...');
  await builder.sign(wallet);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Transaction built + signed locally. Not submitting.');
    console.log('  XDR length: ' + builder.getSignedXDR().length + ' chars');
    console.log('\n  Re-run without MAINNET_DRY_RUN=1 to execute for real.');
    process.exit(0);
  }

  console.log('Submitting to mainnet...');
  const t0 = Date.now();
  const result = await builder.submit();
  const elapsedMs = Date.now() - t0;

  // 8. Capture explorer URLs
  const explorerExpert = `https://stellar.expert/explorer/public/tx/${result.hash}`;
  const explorerHorizon = `https://horizon.stellar.org/transactions/${result.hash}`;
  const explorerChain = `https://stellarchain.io/tx/${result.hash}`;

  divider();
  console.log('  ✓ MAINNET TRANSACTION CONFIRMED');
  divider();
  console.log('  hash         : ' + result.hash);
  console.log('  ledger       : ' + result.ledger);
  console.log('  successful   : ' + result.successful);
  console.log('  elapsed      : ' + elapsedMs + ' ms (build+sign+submit)');
  console.log('');
  console.log('  Explorer URLs:');
  console.log('    ' + explorerExpert);
  console.log('    ' + explorerHorizon);
  console.log('    ' + explorerChain);
  divider();

  // 9. Auto-write the proof record
  const recordPath = resolveRecordPath();
  const record = buildRecordMarkdown({
    hash: result.hash,
    ledger: result.ledger,
    timestampIso: isoNow(),
    source: wallet.publicKey,
    sourceMethod,
    destination,
    asset: 'XLM',
    amount: AMOUNT,
    elapsedMs,
    explorerExpert,
    explorerHorizon,
    explorerChain,
  });

  try {
    mkdirSync(dirname(recordPath), { recursive: true });
    writeFileSync(recordPath, record, 'utf8');
    console.log('\n  Proof record written to:');
    console.log('    ' + recordPath);
    console.log('\n  Next steps:');
    console.log('    1. Review the file and add any missing fields (fee_charged, sign-off)');
    console.log('    2. git add docs/release/mainnet-proof-record.md');
    console.log('    3. git commit -m "Add mainnet proof tx for v1.0.0"');
    console.log('    4. Reference it in the GitHub v1.0.0 release notes');
  } catch (err) {
    console.warn('\n  Could not auto-write proof record: ' + (err as Error).message);
    console.warn('  Copy the values above into docs/release/mainnet-proof-record.md manually.');
  }
}

// ─── Proof record markdown ───────────────────────────────────────────────

interface RecordInput {
  hash: string;
  ledger: number;
  timestampIso: string;
  source: string;
  sourceMethod: string;
  destination: string;
  asset: string;
  amount: string;
  elapsedMs: number;
  explorerExpert: string;
  explorerHorizon: string;
  explorerChain: string;
}

function buildRecordMarkdown(r: RecordInput): string {
  return `# Wirex Stellar SDK 1.0.0 — Mainnet Proof of Acceptance

Captured automatically by \`scripts/mainnet-proof.ts\` for the grant acceptance criterion 3.4.8.

## Transaction

| Field | Value |
|---|---|
| **Network** | Stellar Mainnet (\`Public Global Stellar Network ; September 2015\`) |
| **Tx hash** | \`${r.hash}\` |
| **Ledger** | ${r.ledger} |
| **Timestamp (UTC)** | ${r.timestampIso} |
| **Source account** | \`${r.source}\` |
| **Source loaded via** | ${r.sourceMethod} |
| **Destination account** | \`${r.destination}\` |
| **Asset** | ${r.asset} (native) |
| **Amount** | ${r.amount} ${r.asset} |
| **Memo (text)** | \`wirex-sdk-1.0.0-proof\` |
| **End-to-end elapsed** | ${r.elapsedMs} ms (build + sign + submit) |

## Explorer Links

- [Stellar Expert](${r.explorerExpert})
- [Horizon JSON](${r.explorerHorizon})
- [StellarChain](${r.explorerChain})

## SDK Version

\`@vottun/stellar-sdk@1.0.0\`

## Sign-off

Vottun: ______________ Date: __________
Wirex (witness): ______________ Date: __________
`;
}

function resolveRecordPath(): string {
  // Resolve the path relative to this script's location, so it works
  // whether invoked from the repo root or any sub-directory.
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', 'docs', 'release', 'mainnet-proof-record.md');
}

main().catch((err) => {
  console.error('\n✗ FAILED');
  console.error('  ' + (err as Error).message);
  if ((err as Error).stack) {
    console.error('\n  Stack:');
    console.error('  ' + (err as Error).stack);
  }
  process.exit(1);
});
