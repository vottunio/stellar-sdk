/**
 * Path Payment Example
 *
 * Pay USDC by sending XLM — Stellar's built-in DEX automatically converts
 * the asset through the order book. Useful when:
 *   - You hold XLM but the recipient wants USDC
 *   - You want to lock in a minimum receive amount (slippage protection)
 *
 * NOTE: This example requires a live USDC order book on the testnet DEX,
 * which is not guaranteed. The flow demonstrates the API surface; for an
 * always-reliable run, swap in any two assets that have an existing order
 * book in your environment.
 *
 * Run: npx ts-node examples/path-payment-conversion.ts
 */
/* eslint-disable no-console */
import { WirexSDK, StellarError } from '../src';

const TESTNET_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

const sdk = new WirexSDK({ network: 'testnet', logging: { level: 'info' } });

async function fund(addr: string) {
  const r = await fetch(`https://friendbot.stellar.org?addr=${addr}`);
  if (!r.ok) throw new Error(`Friendbot ${r.status}`);
}

async function main(): Promise<void> {
  // Setup: two accounts, one funded
  const alice = sdk.wallet.create();
  const bob = sdk.wallet.create();
  await fund(alice.publicKey);
  await fund(bob.publicKey);

  console.log('Alice:', alice.publicKey);
  console.log('Bob:  ', bob.publicKey);
  console.log();

  // Bob opens a USDC trustline so he can receive USDC
  console.log('Opening USDC trustline for Bob...');
  await sdk.stellar.changeTrust(
    {
      sourceAccount: bob.publicKey,
      asset: { code: 'USDC', issuer: TESTNET_USDC_ISSUER },
    },
    bob,
  );
  console.log('  ✓ trustline open');
  console.log();

  // ─── Path payment: Alice sends XLM, Bob receives USDC ────────────────────
  // sendAmount   — how much XLM Alice is willing to send
  // destMin      — minimum USDC Bob will accept (slippage floor)
  // destination  — Bob's address
  console.log('Attempting path payment: 50 XLM → ≥ 4 USDC for Bob...');
  try {
    const result = await sdk.stellar.pathPaymentStrictSend(
      {
        sourceAccount: alice.publicKey,
        sendAsset: { code: 'XLM' },
        sendAmount: '50',
        destination: bob.publicKey,
        destAsset: { code: 'USDC', issuer: TESTNET_USDC_ISSUER },
        destMin: '4',                            // refuse if conversion gives <4 USDC
        // path: []                              // empty = direct order book
      },
      alice,
    );

    console.log('  ✓ path payment landed:', result.hash);
    console.log('  ledger:', result.ledger);
  } catch (e) {
    if (e instanceof StellarError && e.message.includes('PATH_PAYMENT')) {
      console.warn('  ✗ No path found in current testnet DEX state.');
      console.warn('    This is expected if no liquidity exists for XLM/USDC.');
      console.warn('    On mainnet with real liquidity, the same call succeeds.');
    } else {
      throw e;
    }
  }

  // ─── Inspect the on-chain order book ─────────────────────────────────────
  console.log('\nQuerying current XLM/USDC order book...');
  const book = await sdk.api.horizon.getOrderBook({
    selling_asset_type: 'native',
    buying_asset_type: 'credit_alphanum4',
    buying_asset_code: 'USDC',
    buying_asset_issuer: TESTNET_USDC_ISSUER,
    limit: 5,
  });

  console.log('  bids:', book.data.bids.length);
  console.log('  asks:', book.data.asks.length);
  if (book.data.asks.length > 0) {
    console.log('  top ask price:', book.data.asks[0].price);
  }
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
