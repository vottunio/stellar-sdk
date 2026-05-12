import { WirexPaymentFlow } from '../../../src/reference/WirexPaymentFlow';
import { ConfigManager } from '../../../src/config/ConfigManager';
import { ResolvedConfig } from '../../../src/types/config.types';
import { Wallet, Balance } from '../../../src/types/wallet.types';
import { TransactionResult } from '../../../src/types/transaction.types';
import { SettlementParams } from '../../../src/types/reference.types';

// ─── Mock StellarClient ────────────────────────────────────────────────────

const mockAccountExists = jest.fn();
const mockGetBalances = jest.fn();
const mockChangeTrust = jest.fn();
const mockSendPayment = jest.fn();

jest.mock('../../../src/stellar/StellarClient', () => ({
  StellarClient: jest.fn().mockImplementation(() => ({
    accountExists: mockAccountExists,
    getBalances: mockGetBalances,
    changeTrust: mockChangeTrust,
    sendPayment: mockSendPayment,
  })),
}));

jest.mock('../../../src/wallet/WalletManager', () => ({
  WalletManager: jest.fn().mockImplementation(() => ({})),
}));

describe('WirexPaymentFlow', () => {
  const config: ResolvedConfig = new ConfigManager({
    network: 'testnet',
    logging: { level: 'none' },
  }).getConfig();

  let flow: WirexPaymentFlow;

  const SOURCE_KEY = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDE';
  const DEST_KEY = 'GXYZ1234567890ABCDEF1234567890ABCDEF1234567890ABCDE';

  const mockWallet: Wallet = {
    publicKey: SOURCE_KEY,
    sign: jest.fn().mockResolvedValue('signed_xdr'),
    getBalances: jest.fn().mockResolvedValue([]),
  };

  const successfulTxResult: TransactionResult = {
    hash: 'abc123def456',
    ledger: 12345,
    successful: true,
    resultXdr: 'AAAA',
    envelopeXdr: 'BBBB',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    flow = new WirexPaymentFlow(config);

    // Default: both accounts exist
    mockAccountExists.mockResolvedValue(true);
    // Default: no balances (no trustlines)
    mockGetBalances.mockResolvedValue([]);
    // Default: payment succeeds
    mockSendPayment.mockResolvedValue(successfulTxResult);
    // Default: change trust succeeds
    mockChangeTrust.mockResolvedValue({ ...successfulTxResult, hash: 'trust_hash' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── XLM Settlement (Phase 2.5.2) ────────────────────────────────────────

  describe('XLM settlement', () => {
    const xlmParams: SettlementParams = {
      asset: 'XLM',
      amount: '100',
      destination: DEST_KEY,
    };

    it('should complete an XLM settlement successfully', async () => {
      const result = await flow.createSettlement(xlmParams, mockWallet);

      expect(result.successful).toBe(true);
      expect(result.transaction).toEqual(successfulTxResult);
      expect(result.steps).toHaveLength(5); // validate_source, validate_dest, trustline(skipped), payment, confirm
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should skip trustline step for XLM', async () => {
      const result = await flow.createSettlement(xlmParams, mockWallet);

      const trustlineStep = result.steps.find((s) => s.name === 'check_trustline');
      expect(trustlineStep).toBeDefined();
      expect(trustlineStep!.status).toBe('skipped');
    });

    it('should call sendPayment with correct XLM params', async () => {
      await flow.createSettlement(xlmParams, mockWallet);

      expect(mockSendPayment).toHaveBeenCalledWith(
        {
          sourceAccount: SOURCE_KEY,
          destination: DEST_KEY,
          asset: { code: 'XLM' },
          amount: '100',
          memo: undefined,
        },
        mockWallet,
      );
    });

    it('should include memo when provided', async () => {
      const params: SettlementParams = {
        ...xlmParams,
        memo: { type: 'text', value: 'settlement-ref-001' },
      };
      await flow.createSettlement(params, mockWallet);

      expect(mockSendPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          memo: { type: 'text', value: 'settlement-ref-001' },
        }),
        mockWallet,
      );
    });

    it('should fail if source account does not exist', async () => {
      mockAccountExists.mockResolvedValueOnce(false);

      const result = await flow.createSettlement(xlmParams, mockWallet);

      expect(result.successful).toBe(false);
      const sourceStep = result.steps.find((s) => s.name === 'validate_source');
      expect(sourceStep!.status).toBe('failed');
      expect(sourceStep!.error).toContain('Source account does not exist');
    });

    it('should fail if destination account does not exist', async () => {
      mockAccountExists
        .mockResolvedValueOnce(true)  // source exists
        .mockResolvedValueOnce(false); // dest doesn't exist

      const result = await flow.createSettlement(xlmParams, mockWallet);

      expect(result.successful).toBe(false);
      const destStep = result.steps.find((s) => s.name === 'validate_destination');
      expect(destStep!.status).toBe('failed');
      expect(destStep!.error).toContain('Destination account does not exist');
    });

    it('should fail if payment submission fails', async () => {
      mockSendPayment.mockRejectedValue(new Error('insufficient balance'));

      const result = await flow.createSettlement(xlmParams, mockWallet);

      expect(result.successful).toBe(false);
      const paymentStep = result.steps.find((s) => s.name === 'send_payment');
      expect(paymentStep!.status).toBe('failed');
      expect(paymentStep!.error).toContain('insufficient balance');
    });

    it('should fail if transaction result is unsuccessful', async () => {
      mockSendPayment.mockResolvedValue({
        ...successfulTxResult,
        successful: false,
        resultXdr: 'tx_bad_auth',
      });

      const result = await flow.createSettlement(xlmParams, mockWallet);

      expect(result.successful).toBe(false);
      const confirmStep = result.steps.find((s) => s.name === 'confirm');
      expect(confirmStep!.status).toBe('failed');
    });

    it('should record step durations', async () => {
      const result = await flow.createSettlement(xlmParams, mockWallet);

      for (const step of result.steps) {
        if (step.status !== 'skipped') {
          expect(step.durationMs).toBeDefined();
          expect(step.durationMs).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  // ─── USDC Settlement (Phase 2.5.3) ────────────────────────────────────────

  describe('USDC settlement', () => {
    const TESTNET_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

    const usdcParams: SettlementParams = {
      asset: 'USDC',
      amount: '25.50',
      destination: DEST_KEY,
    };

    it('should fail when destination lacks USDC trustline', async () => {
      mockGetBalances.mockResolvedValue([
        { code: 'XLM', balance: '100', asset: 'native' },
      ]);

      const result = await flow.createSettlement(usdcParams, mockWallet);

      expect(result.successful).toBe(false);
      const trustStep = result.steps.find((s) => s.name === 'check_trustline');
      expect(trustStep!.status).toBe('failed');
      expect(trustStep!.error).toContain('lacks a USDC trustline');
    });

    it('should succeed when destination has USDC trustline', async () => {
      mockGetBalances.mockResolvedValue([
        { code: 'XLM', balance: '100', asset: 'native' },
        { code: 'USDC', issuer: TESTNET_USDC_ISSUER, balance: '0', asset: 'credit_alphanum4' },
      ]);

      const result = await flow.createSettlement(usdcParams, mockWallet);

      expect(result.successful).toBe(true);
      expect(mockChangeTrust).not.toHaveBeenCalled();
    });

    it('should auto-add trustline when source === destination', async () => {
      const selfParams: SettlementParams = {
        asset: 'USDC',
        amount: '25.50',
        destination: SOURCE_KEY, // same as wallet
      };
      mockGetBalances.mockResolvedValue([]); // no trustline yet

      const result = await flow.createSettlement(selfParams, mockWallet);

      expect(result.successful).toBe(true);
      expect(mockChangeTrust).toHaveBeenCalledWith(
        {
          sourceAccount: SOURCE_KEY,
          asset: { code: 'USDC', issuer: TESTNET_USDC_ISSUER },
        },
        mockWallet,
      );
    });

    it('should call sendPayment with correct USDC params', async () => {
      mockGetBalances.mockResolvedValue([
        { code: 'USDC', issuer: TESTNET_USDC_ISSUER, balance: '100', asset: 'credit_alphanum4' },
      ]);

      await flow.createSettlement(usdcParams, mockWallet);

      expect(mockSendPayment).toHaveBeenCalledWith(
        {
          sourceAccount: SOURCE_KEY,
          destination: DEST_KEY,
          asset: { code: 'USDC', issuer: TESTNET_USDC_ISSUER },
          amount: '25.50',
          memo: undefined,
        },
        mockWallet,
      );
    });

    it('should use custom issuer when provided', async () => {
      const customIssuer = 'GCUSTOM1234567890ABCDEF1234567890ABCDEF1234567890ABC';
      const params: SettlementParams = {
        ...usdcParams,
        issuer: customIssuer,
      };
      mockGetBalances.mockResolvedValue([
        { code: 'USDC', issuer: customIssuer, balance: '50', asset: 'credit_alphanum4' },
      ]);

      await flow.createSettlement(params, mockWallet);

      expect(mockSendPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          asset: { code: 'USDC', issuer: customIssuer },
        }),
        mockWallet,
      );
    });

    it('should record trustline step hash when trustline is added', async () => {
      const selfParams: SettlementParams = {
        asset: 'USDC',
        amount: '10',
        destination: SOURCE_KEY,
      };
      mockGetBalances.mockResolvedValue([]);

      const result = await flow.createSettlement(selfParams, mockWallet);

      const trustStep = result.steps.find((s) => s.name === 'check_trustline');
      expect(trustStep!.status).toBe('success');
      expect(trustStep!.hash).toBe('trust_hash');
    });
  });

  // ─── EURC Settlement ──────────────────────────────────────────────────────

  describe('EURC settlement', () => {
    const TESTNET_EURC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

    it('should settle EURC when destination has trustline', async () => {
      mockGetBalances.mockResolvedValue([
        { code: 'EURC', issuer: TESTNET_EURC_ISSUER, balance: '0', asset: 'credit_alphanum4' },
      ]);

      const result = await flow.createSettlement(
        { asset: 'EURC', amount: '50', destination: DEST_KEY },
        mockWallet,
      );

      expect(result.successful).toBe(true);
      expect(mockSendPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          asset: { code: 'EURC', issuer: TESTNET_EURC_ISSUER },
        }),
        mockWallet,
      );
    });
  });

  // ─── resolveIssuer ────────────────────────────────────────────────────────

  describe('resolveIssuer', () => {
    it('should return testnet USDC issuer', () => {
      const issuer = flow.resolveIssuer({ asset: 'USDC', amount: '1', destination: DEST_KEY });
      expect(issuer).toBe('GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');
    });

    it('should prefer custom issuer over well-known', () => {
      const issuer = flow.resolveIssuer({
        asset: 'USDC',
        amount: '1',
        destination: DEST_KEY,
        issuer: 'GCUSTOM',
      });
      expect(issuer).toBe('GCUSTOM');
    });

    it('should throw for unknown asset on mainnet', () => {
      const mainnetConfig = new ConfigManager({
        network: 'mainnet',
        logging: { level: 'none' },
      }).getConfig();
      const mainnetFlow = new WirexPaymentFlow(mainnetConfig);

      // XLM is native, no issuer needed — but calling resolveIssuer for XLM would
      // fail because it's not in the table. This is expected since XLM bypasses issuer lookup.
      expect(() =>
        mainnetFlow.resolveIssuer({ asset: 'XLM', amount: '1', destination: DEST_KEY }),
      ).toThrow('No known issuer');
    });
  });

  // ─── Step ordering ────────────────────────────────────────────────────────

  describe('step ordering', () => {
    it('should produce 5 steps for XLM settlement', async () => {
      const result = await flow.createSettlement(
        { asset: 'XLM', amount: '10', destination: DEST_KEY },
        mockWallet,
      );

      expect(result.steps.map((s) => s.name)).toEqual([
        'validate_source',
        'validate_destination',
        'check_trustline',
        'send_payment',
        'confirm',
      ]);
    });

    it('should produce 5 steps for USDC settlement', async () => {
      mockGetBalances.mockResolvedValue([
        { code: 'USDC', issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', balance: '0', asset: 'credit_alphanum4' },
      ]);

      const result = await flow.createSettlement(
        { asset: 'USDC', amount: '10', destination: DEST_KEY },
        mockWallet,
      );

      expect(result.steps.map((s) => s.name)).toEqual([
        'validate_source',
        'validate_destination',
        'check_trustline',
        'send_payment',
        'confirm',
      ]);
    });

    it('should stop at the failed step and not continue', async () => {
      mockAccountExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await flow.createSettlement(
        { asset: 'XLM', amount: '10', destination: DEST_KEY },
        mockWallet,
      );

      // Only 2 steps should be recorded (source ok, dest failed)
      expect(result.steps).toHaveLength(2);
      expect(result.steps[1].status).toBe('failed');
      expect(mockSendPayment).not.toHaveBeenCalled();
    });
  });
});
