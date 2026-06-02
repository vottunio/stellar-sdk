/**
 * HD Wallet Derivation Example
 *
 * Demonstrates BIP39 mnemonic generation, BIP44 path derivation, and how to
 * manage multiple Stellar accounts from a single seed phrase. Follows the
 * Stellar Ecosystem Proposal SEP-0005 (m/44'/148'/{index}').
 *
 * Run: npx ts-node examples/hd-wallet-derivation.ts
 */
/* eslint-disable no-console */
import { WirexSDK } from '../src';

const sdk = new WirexSDK({ network: 'testnet' });

async function main(): Promise<void> {
  // ─── Generate a new 24-word mnemonic ─────────────────────────────────────
  const hd = sdk.wallet.createHD();
  const mnemonic = hd.exportMnemonic();
  console.log('Mnemonic (write this down — only way to recover):');
  console.log('  ', mnemonic);
  console.log();

  // ─── Derive multiple accounts from the same seed ─────────────────────────
  console.log('Derived accounts:');
  console.log(`  account[0] (primary): ${hd.publicKey}`);

  for (let i = 1; i < 5; i++) {
    const account = hd.deriveAccount(i);
    console.log(`  account[${i}]          : ${account.publicKey}`);
  }
  console.log();

  // ─── Restore from the same mnemonic — deterministic ──────────────────────
  console.log('Restoring from mnemonic — same accounts every time:');
  const restored = sdk.wallet.createHD(mnemonic);
  console.log(`  account[0] restored   : ${restored.publicKey}`);
  console.log(`  matches?              : ${restored.publicKey === hd.publicKey}`);
  console.log();

  // ─── Single account import (no HD context needed for downstream use) ─────
  const account3 = sdk.wallet.importFromMnemonic(mnemonic, 3);
  console.log(`Importing index=3 directly: ${account3.publicKey}`);
  console.log();

  // ─── Sign a tx with a derived account ────────────────────────────────────
  // Fund + send a small payment from account[1] to account[2] using friendbot
  const sender = hd.deriveAccount(1);
  const receiver = hd.deriveAccount(2);

  console.log(`Funding ${sender.publicKey.slice(0, 8)}…`);
  const fund = await fetch(`https://friendbot.stellar.org?addr=${sender.publicKey}`);
  if (!fund.ok) {
    console.warn('  (Friendbot temporarily unavailable — skipping live tx)');
    return;
  }
  console.log('  ✓ funded');

  console.log('Funding receiver too (so it exists on-chain)…');
  await fetch(`https://friendbot.stellar.org?addr=${receiver.publicKey}`);

  console.log('Sending 5 XLM from account[1] → account[2]…');
  const result = await sdk
    .transaction({ sourceAccount: sender.publicKey })
    .addPayment({
      destination: receiver.publicKey,
      asset: { code: 'XLM' },
      amount: '5',
    })
    .addMemo({ type: 'text', value: 'hd-demo' })
    .build()
    .then((b) => b.sign(sender))
    .then((b) => b.submit());

  console.log('  ✓ hash:', result.hash);
  console.log('  ✓ ledger:', result.ledger);
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
