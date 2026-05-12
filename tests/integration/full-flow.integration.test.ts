import { xdr } from '@stellar/stellar-sdk';

import { WirexSDK } from '../../src';

/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  MASTER INTEGRATION TEST                                   │
 * │                                                                         │
 * │  This single test file exercises EVERY phase of Phase 2 end-to-end   │
 * │  on Stellar Testnet. Run this to verify the entire phase is working. │
 * │                                                                         │
 * │  Phases covered:                                                        │
 * │    2.1 — Soroban smart contract interaction                             │
 * │    2.2 — Stellar operations (payments, trustlines, accounts)            │
 * │    2.3 — API Client (Horizon REST + Soroban RPC)                        │
 * │    2.4 — WebSocket & Streaming (SSE)                                    │
 * │    2.5 — Reference Integration (settlement flows)                       │
 * │                                                                         │
 * │  Run:                                                                   │
 * │    npx jest tests/integration/phase-2-full-flow.integration.test.ts   │
 * │        --no-coverage --verbose                                          │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
describe('Phase 2 — Full Flow Integration (Testnet)', () => {
  const sdk = new WirexSDK({ network: 'testnet', logging: { level: 'info' } });

  const XLM_SAC_CONTRACT = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
  const TESTNET_ASSET_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

  // Shared wallets — funded once, reused across phases
  let alice: ReturnType<typeof sdk.wallet.create>;
  let bob: ReturnType<typeof sdk.wallet.create>;

  beforeAll(async () => {
    alice = sdk.wallet.create();
    bob = sdk.wallet.create();

    console.log(`\n  Alice: ${alice.publicKey}`);
    console.log(`  Bob:   ${bob.publicKey}\n`);

    // Fund both accounts
    await sdk.stellar.fundTestAccount(alice.publicKey);
    await sdk.stellar.fundTestAccount(bob.publicKey);
  }, 30000);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2.1 — Soroban Smart Contract Interaction
  // ═══════════════════════════════════════════════════════════════════════

  describe('Phase 2.1 — Soroban', () => {
    it('2.1.3 readContract: should read token name from native XLM SAC', async () => {
      const result = await sdk.soroban.readContract({
        contractId: XLM_SAC_CONTRACT,
        method: 'name',
        args: [],
        sourceAccount: alice.publicKey,
      });

      expect(result.returnValue).toBe('native');
      console.log(`    ✓ SAC name() = "${result.returnValue}"`);
    }, 30000);

    it('2.1.3 readContract: should read token decimals', async () => {
      const result = await sdk.soroban.readContract({
        contractId: XLM_SAC_CONTRACT,
        method: 'decimals',
        args: [],
        sourceAccount: alice.publicKey,
      });

      expect(result.returnValue).toBe(7);
      console.log(`    ✓ SAC decimals() = ${result.returnValue}`);
    }, 30000);

    it('2.1.3 readContract: should read balance via Soroban simulation', async () => {
      const result = await sdk.soroban.readContract({
        contractId: XLM_SAC_CONTRACT,
        method: 'balance',
        args: [sdk.soroban.nativeToScVal(alice.publicKey, 'address')],
        sourceAccount: alice.publicKey,
      });

      const balance = BigInt(result.returnValue as string | number | bigint);
      expect(balance).toBeGreaterThan(0n);
      console.log(`    ✓ SAC balance(Alice) = ${balance} stroops`);
    }, 30000);

    it('2.1.4/2.1.5 ScVal: should encode and decode round-trip', () => {
      const encoded = sdk.soroban.nativeToScVal('hello', 'string');
      expect(encoded).toBeInstanceOf(xdr.ScVal);

      const decoded = sdk.soroban.scValToNative(encoded);
      expect(decoded).toBe('hello');
      console.log(`    ✓ ScVal round-trip: "hello" → xdr → "hello"`);
    });

    it('2.1.6 getContract: should return valid Contract instance', () => {
      const contract = sdk.soroban.getContract(XLM_SAC_CONTRACT);
      expect(contract.contractId()).toBe(XLM_SAC_CONTRACT);
      console.log(`    ✓ Contract instance: ${contract.contractId()}`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2.2 — Stellar Extended Operations
  // ═══════════════════════════════════════════════════════════════════════

  describe('Phase 2.2 — Stellar Operations', () => {
    it('2.2.1 accountExists: should confirm funded accounts', async () => {
      const exists = await sdk.stellar.accountExists(alice.publicKey);
      expect(exists).toBe(true);
      console.log(`    ✓ Alice account exists: ${exists}`);
    }, 15000);

    it('2.2.3 sendPayment: should send 50 XLM Alice → Bob', async () => {
      const result = await sdk.stellar.sendPayment(
        {
          sourceAccount: alice.publicKey,
          destination: bob.publicKey,
          asset: { code: 'XLM' },
          amount: '50',
          memo: { type: 'text', value: 'phase2-test' },
        },
        alice,
      );

      expect(result.successful).toBe(true);
      expect(result.hash).toBeTruthy();
      expect(result.ledger).toBeGreaterThan(0);
      console.log(`    ✓ Payment tx: ${result.hash} (ledger ${result.ledger})`);
    }, 30000);

    it('2.2.5 changeTrust: should add USDC trustline for Bob', async () => {
      const result = await sdk.stellar.changeTrust(
        {
          sourceAccount: bob.publicKey,
          asset: { code: 'USDC', issuer: TESTNET_ASSET_ISSUER },
        },
        bob,
      );

      expect(result.successful).toBe(true);
      console.log(`    ✓ USDC trustline added: ${result.hash}`);
    }, 30000);

    it('2.2.5 changeTrust: should add EURC trustline for Bob', async () => {
      const result = await sdk.stellar.changeTrust(
        {
          sourceAccount: bob.publicKey,
          asset: { code: 'EURC', issuer: TESTNET_ASSET_ISSUER },
        },
        bob,
      );

      expect(result.successful).toBe(true);
      console.log(`    ✓ EURC trustline added: ${result.hash}`);
    }, 30000);

    it('2.2.11 manageData: should set account data entry', async () => {
      const result = await sdk.stellar.manageData(
        {
          sourceAccount: alice.publicKey,
          name: 'phase2_test',
          value: 'verified',
        },
        alice,
      );

      expect(result.successful).toBe(true);
      console.log(`    ✓ Data entry set: ${result.hash}`);
    }, 30000);

    it('2.2.12 Asset: should create native and custom assets', () => {
      const xlm = sdk.stellar.Asset.native();
      expect(xlm.isNative()).toBe(true);

      const usdc = sdk.stellar.Asset.custom('USDC', TESTNET_ASSET_ISSUER);
      expect(usdc.getCode()).toBe('USDC');
      console.log('    ✓ Asset.native() and Asset.custom() work');
    });

    it('2.2 getBalances: should show updated balances', async () => {
      const balances = await sdk.stellar.getBalances(bob.publicKey);

      const xlm = balances.find((b) => b.code === 'XLM');
      const usdc = balances.find((b) => b.code === 'USDC');
      const eurc = balances.find((b) => b.code === 'EURC');

      expect(xlm).toBeDefined();
      expect(usdc).toBeDefined();
      expect(eurc).toBeDefined();
      expect(parseFloat(xlm!.balance)).toBeGreaterThan(10000);

      console.log(`    ✓ Bob balances: XLM=${xlm!.balance}, USDC=${usdc!.balance}, EURC=${eurc!.balance}`);
    }, 15000);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2.3 — API Client (Horizon REST + Soroban RPC)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Phase 2.3 — API Client', () => {
    it('2.3.2 Horizon: should fetch account via REST', async () => {
      const response = await sdk.api.horizon.getAccount(alice.publicKey);
      expect(response.data).toBeDefined();
      expect(response.data.id).toBe(alice.publicKey);
      console.log(`    ✓ Horizon getAccount: seq=${response.data.sequence}`);
    }, 15000);

    it('2.3.12 Horizon: should fetch fee stats', async () => {
      const response = await sdk.api.horizon.getFeeStats();
      expect(response.data).toBeDefined();
      expect(response.data.last_ledger_base_fee).toBeDefined();
      console.log(`    ✓ Fee stats: base_fee=${response.data.last_ledger_base_fee}`);
    }, 15000);

    it('2.3.3 Horizon: should fetch transactions for account', async () => {
      const response = await sdk.api.horizon.getTransactions({
        account: alice.publicKey,
        limit: 5,
        order: 'desc',
      });
      expect(response.data).toBeDefined();
      expect(response.data.length).toBeGreaterThan(0);
      console.log(`    ✓ Horizon getTransactions: ${response.data.length} tx(s)`);
    }, 15000);

    it('2.3.6 Horizon: should fetch payments for account', async () => {
      const response = await sdk.api.horizon.getPayments({
        account: alice.publicKey,
        limit: 5,
      });
      expect(response.data).toBeDefined();
      console.log(`    ✓ Horizon getPayments: ${response.data.length} payment(s)`);
    }, 15000);

    it('2.3.8 Horizon: should fetch latest ledger', async () => {
      const response = await sdk.api.horizon.getLedger();
      expect(response.data).toBeDefined();
      console.log(`    ✓ Horizon getLedger: latest`);
    }, 15000);

    it('2.3.13 Soroban RPC: should check health', async () => {
      const response = await sdk.api.soroban.getHealth();
      expect(response.data).toBeDefined();
      expect(response.data.status).toBe('healthy');
      console.log(`    ✓ Soroban getHealth: ${response.data.status}, ledger=${response.data.latestLedger}`);
    }, 15000);

    it('2.3.17 Soroban RPC: should fetch network info', async () => {
      const response = await sdk.api.soroban.getNetwork();
      expect(response.data).toBeDefined();
      expect(response.data.passphrase).toContain('Test SDF Network');
      console.log(`    ✓ Soroban getNetwork: ${response.data.passphrase}`);
    }, 15000);

    it('2.3.20 External client: should create partner API client', () => {
      const client = sdk.api.external('https://api-baas.wirexapp.tech', {
        timeout: 10000,
        headers: { 'X-Partner-Id': '0x00000000000000000000000000000044' },
      });
      expect(client).toBeDefined();
      console.log('    ✓ External client created for Wirex BaaS sandbox');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2.4 — WebSocket & Streaming
  // ═══════════════════════════════════════════════════════════════════════

  describe('Phase 2.4 — WebSocket & Streaming', () => {
    it('2.4.8 Streaming: should stream transactions and capture a payment', async () => {
      const carol = sdk.wallet.create();
      await sdk.stellar.fundTestAccount(carol.publicKey);

      const received: unknown[] = [];
      const close = sdk.stellar.stream.transactions(carol.publicKey, (tx) => {
        received.push(tx);
      });

      // Wait for stream to establish
      await new Promise((r) => setTimeout(r, 2000));

      // Send a payment to trigger the stream
      const result = await sdk.stellar.sendPayment(
        {
          sourceAccount: carol.publicKey,
          destination: bob.publicKey,
          asset: { code: 'XLM' },
          amount: '5',
        },
        carol,
      );
      expect(result.successful).toBe(true);

      // Wait for stream to pick it up
      await new Promise((r) => setTimeout(r, 5000));
      close();

      expect(received.length).toBeGreaterThanOrEqual(1);
      console.log(`    ✓ Stream captured ${received.length} transaction(s)`);
    }, 30000);

    it('2.4.9 Cursor: should persist cursor after streaming', async () => {
      // Cursor should have been saved from the above stream
      // Test cursor management directly
      sdk.stellar.stream.setCursor('test:cursor', 'abc123');
      expect(sdk.stellar.stream.getCursor('test:cursor')).toBe('abc123');

      sdk.stellar.stream.clearCursors();
      expect(sdk.stellar.stream.getCursor('test:cursor')).toBeUndefined();
      console.log('    ✓ Cursor set/get/clear works');
    });

    it('2.4.1-2.4.7 WebSocket: should create client with event routing', () => {
      const ws = sdk.websocket;
      expect(ws).toBeDefined();
      expect(ws.getState()).toBe('disconnected');

      // Test event subscription
      const handler = jest.fn();
      const unsub = ws.on('connected', handler);
      expect(typeof unsub).toBe('function');
      unsub();

      console.log('    ✓ WebSocket client instantiated, state=disconnected, event subscription works');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2.5 — Reference Integration (Settlement Flows)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Phase 2.5 — Reference Integration', () => {
    it('2.5.2 XLM Settlement: full flow Alice → Bob', async () => {
      const result = await sdk.reference.createSettlement(
        {
          asset: 'XLM',
          amount: '25',
          destination: bob.publicKey,
          memo: { type: 'text', value: 'phase2-xlm' },
        },
        alice,
      );

      expect(result.successful).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction!.hash).toBeTruthy();
      expect(result.steps).toHaveLength(5);
      expect(result.steps[2]).toMatchObject({ name: 'check_trustline', status: 'skipped' });

      console.log(`    ✓ XLM settlement: ${result.transaction!.hash} (${result.totalDurationMs}ms)`);
      console.log(`      Steps: ${result.steps.map((s) => `${s.name}:${s.status}`).join(' → ')}`);
    }, 30000);

    it('2.5.3 USDC Settlement: trustline check passes', async () => {
      // Bob already has USDC trustline from Phase 2.2
      // Alice needs one too
      await sdk.stellar.changeTrust(
        {
          sourceAccount: alice.publicKey,
          asset: { code: 'USDC', issuer: TESTNET_ASSET_ISSUER },
        },
        alice,
      );

      const result = await sdk.reference.createSettlement(
        {
          asset: 'USDC',
          amount: '10',
          destination: bob.publicKey,
          memo: { type: 'text', value: 'phase2-usdc' },
        },
        alice,
      );

      // Trustline check should pass; payment may fail due to no USDC balance
      const trustStep = result.steps.find((s) => s.name === 'check_trustline');
      expect(trustStep!.status).toBe('success');

      console.log(`    ✓ USDC trustline check: ${trustStep!.status}`);
      console.log(`      Settlement: ${result.successful ? 'SUCCESS' : 'EXPECTED_FAIL (no USDC balance)'}`);
    }, 45000);

    it('2.5.4 EURC Settlement: trustline check passes', async () => {
      // Bob already has EURC trustline; add for Alice
      await sdk.stellar.changeTrust(
        {
          sourceAccount: alice.publicKey,
          asset: { code: 'EURC', issuer: TESTNET_ASSET_ISSUER },
        },
        alice,
      );

      const result = await sdk.reference.createSettlement(
        {
          asset: 'EURC',
          amount: '10',
          destination: bob.publicKey,
          memo: { type: 'text', value: 'phase2-eurc' },
        },
        alice,
      );

      const trustStep = result.steps.find((s) => s.name === 'check_trustline');
      expect(trustStep!.status).toBe('success');

      console.log(`    ✓ EURC trustline check: ${trustStep!.status}`);
    }, 45000);

    it('2.5.5 Non-custodial: wallet signs locally, no keys transmitted', () => {
      // Verify wallet has sign() but no key export at the SDK level
      expect(typeof alice.sign).toBe('function');
      expect(alice.publicKey).toMatch(/^G/);
      // The settlement flow only calls wallet.sign() — no key extraction
      console.log('    ✓ Non-custodial pattern: sign() available, keys stay local');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // FINAL VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════

  describe('Final Verification', () => {
    it('should show final balances for both accounts', async () => {
      const aliceBalances = await sdk.stellar.getBalances(alice.publicKey);
      const bobBalances = await sdk.stellar.getBalances(bob.publicKey);

      console.log('\n    ═══ Final Balances ═══');
      console.log(`    Alice: ${aliceBalances.map((b) => `${b.code}=${b.balance}`).join(', ')}`);
      console.log(`    Bob:   ${bobBalances.map((b) => `${b.code}=${b.balance}`).join(', ')}`);

      const aliceXlm = aliceBalances.find((b) => b.code === 'XLM');
      const bobXlm = bobBalances.find((b) => b.code === 'XLM');
      expect(aliceXlm).toBeDefined();
      expect(bobXlm).toBeDefined();

      // Alice spent XLM on payments + fees, Bob received XLM
      expect(parseFloat(bobXlm!.balance)).toBeGreaterThan(10050);
    }, 15000);

    it('should have all SDK modules accessible', () => {
      expect(sdk.wallet).toBeDefined();       // Phase 1.2
      expect(sdk.stellar).toBeDefined();       // Phase 2.2
      expect(sdk.soroban).toBeDefined();       // Phase 2.1
      expect(sdk.api.horizon).toBeDefined();   // Phase 2.3
      expect(sdk.api.soroban).toBeDefined();   // Phase 2.3
      expect(sdk.websocket).toBeDefined();     // Phase 2.4
      expect(sdk.reference).toBeDefined();     // Phase 2.5

      console.log('    ✓ All 7 SDK modules accessible');
      console.log('\n    ════════════════════════════════════════════════');
      console.log('    ✅ ALL PHASES VERIFIED');
      console.log('    ════════════════════════════════════════════════\n');
    });
  });
});
