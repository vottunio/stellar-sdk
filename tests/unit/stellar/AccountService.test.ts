import {
  Horizon,
  Keypair,
  Account,
} from '@stellar/stellar-sdk';

import { ConfigManager } from '../../../src/config/ConfigManager';
import { AccountService } from '../../../src/stellar/AccountService';
import { StellarError } from '../../../src/errors/StellarError';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockLoadAccount = jest.fn();
const mockFetchBaseFee = jest.fn();
const mockSubmitTransaction = jest.fn();

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: mockLoadAccount,
        fetchBaseFee: mockFetchBaseFee,
        submitTransaction: mockSubmitTransaction,
      })),
    },
  };
});

// Mock global fetch for Friendbot
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('AccountService', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  const testKeypair = Keypair.random();
  let service: AccountService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    service = new AccountService(config);
    mockFetchBaseFee.mockResolvedValue(100);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── accountExists (2.2.1) ──────────────────────────────────────────────

  describe('accountExists', () => {
    it('should return true when account exists', async () => {
      mockLoadAccount.mockResolvedValue({ id: testKeypair.publicKey() });
      const exists = await service.accountExists(testKeypair.publicKey());
      expect(exists).toBe(true);
    });

    it('should return false when account does not exist (404)', async () => {
      mockLoadAccount.mockRejectedValue({ response: { status: 404 } });
      const exists = await service.accountExists(testKeypair.publicKey());
      expect(exists).toBe(false);
    });

    it('should throw on invalid address', async () => {
      await expect(service.accountExists('INVALID')).rejects.toThrow(StellarError);
      await expect(service.accountExists('INVALID')).rejects.toThrow(/Invalid Stellar address/);
    });

    it('should throw StellarError on non-404 errors', async () => {
      mockLoadAccount.mockRejectedValue({ response: { status: 500 } });
      await expect(service.accountExists(testKeypair.publicKey())).rejects.toThrow(StellarError);
    });
  });

  // ─── fundTestAccount (2.2.2) ────────────────────────────────────────────

  describe('fundTestAccount', () => {
    it('should fund an account via Friendbot on testnet', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      await service.fundTestAccount(testKeypair.publicKey());
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('friendbot.stellar.org'),
      );
    });

    it('should throw on mainnet', async () => {
      const mainnetConfig = new ConfigManager({ network: 'mainnet' }).getConfig();
      const mainnetService = new AccountService(mainnetConfig);
      await expect(
        mainnetService.fundTestAccount(testKeypair.publicKey()),
      ).rejects.toThrow(/only available on testnet/);
    });

    it('should throw on Friendbot failure', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 400 });
      await expect(
        service.fundTestAccount(testKeypair.publicKey()),
      ).rejects.toThrow(StellarError);
    });

    it('should throw on invalid address', async () => {
      await expect(service.fundTestAccount('BAD')).rejects.toThrow(/Invalid Stellar address/);
    });
  });

  // ─── createAccount (2.2.4) ──────────────────────────────────────────────

  describe('createAccount', () => {
    const mockWallet = {
      publicKey: testKeypair.publicKey(),
      sign: jest.fn(),
      getBalances: jest.fn(),
    };

    beforeEach(() => {
      const account = new Account(testKeypair.publicKey(), '100');
      mockLoadAccount.mockResolvedValue(account);
      mockWallet.sign.mockImplementation(async (xdr: string) => xdr);
      mockSubmitTransaction.mockResolvedValue({
        hash: 'create_hash',
        ledger: 100,
        successful: true,
        result_xdr: 'resultXdr',
        envelope_xdr: 'envelopeXdr',
      });
    });

    it('should create a new account on-chain', async () => {
      const dest = Keypair.random().publicKey();
      const result = await service.createAccount(
        { sourceAccount: testKeypair.publicKey(), destination: dest, startingBalance: '10' },
        mockWallet,
      );
      expect(result.hash).toBe('create_hash');
      expect(result.successful).toBe(true);
    });

    it('should throw for invalid source address', async () => {
      await expect(
        service.createAccount(
          { sourceAccount: 'BAD', destination: Keypair.random().publicKey(), startingBalance: '10' },
          mockWallet,
        ),
      ).rejects.toThrow(/Invalid Stellar address/);
    });

    it('should throw for invalid destination address', async () => {
      await expect(
        service.createAccount(
          { sourceAccount: testKeypair.publicKey(), destination: 'BAD', startingBalance: '10' },
          mockWallet,
        ),
      ).rejects.toThrow(/Invalid Stellar address/);
    });
  });

  // ─── getBalances ────────────────────────────────────────────────────────

  describe('getBalances', () => {
    it('should return balances for a funded account', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [
          { asset_type: 'native', balance: '100.0000000' },
          { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GISSUER', balance: '50.00' },
        ],
      });
      const balances = await service.getBalances(testKeypair.publicKey());
      expect(balances).toHaveLength(2);
      expect(balances[0]).toEqual({
        asset: 'native',
        code: 'XLM',
        issuer: undefined,
        balance: '100.0000000',
      });
      expect(balances[1].code).toBe('USDC');
    });

    it('should throw for non-existent account', async () => {
      mockLoadAccount.mockRejectedValue({ response: { status: 404 } });
      await expect(
        service.getBalances(testKeypair.publicKey()),
      ).rejects.toThrow(/Account not found/);
    });
  });

  // ─── manageData (2.2.11) ───────────────────────────────────────────────

  describe('manageData', () => {
    const mockWallet = {
      publicKey: testKeypair.publicKey(),
      sign: jest.fn(),
      getBalances: jest.fn(),
    };

    beforeEach(() => {
      const account = new Account(testKeypair.publicKey(), '100');
      mockLoadAccount.mockResolvedValue(account);
      mockWallet.sign.mockImplementation(async (xdr: string) => xdr);
      mockSubmitTransaction.mockResolvedValue({
        hash: 'data_hash',
        ledger: 200,
        successful: true,
        result_xdr: 'rx',
        envelope_xdr: 'ex',
      });
    });

    it('should set a data entry', async () => {
      const result = await service.manageData(
        { sourceAccount: testKeypair.publicKey(), name: 'test-key', value: 'test-value' },
        mockWallet,
      );
      expect(result.hash).toBe('data_hash');
      expect(result.successful).toBe(true);
    });

    it('should delete a data entry (null value)', async () => {
      const result = await service.manageData(
        { sourceAccount: testKeypair.publicKey(), name: 'test-key', value: null },
        mockWallet,
      );
      expect(result.successful).toBe(true);
    });

    it('should throw for invalid address', async () => {
      await expect(
        service.manageData({ sourceAccount: 'BAD', name: 'k' }, mockWallet),
      ).rejects.toThrow(/Invalid Stellar address/);
    });
  });

  // ─── getAccountInfo ────────────────────────────────────────────────────

  describe('getAccountInfo', () => {
    it('should return full account info', async () => {
      mockLoadAccount.mockResolvedValue({
        id: testKeypair.publicKey(),
        accountId: () => testKeypair.publicKey(),
        sequenceNumber: () => '12345',
        balances: [{ asset_type: 'native', balance: '100.00' }],
        signers: [{ key: testKeypair.publicKey(), weight: 1, type: 'ed25519_public_key' }],
        thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
        flags: { auth_required: false, auth_revocable: false, auth_immutable: false, auth_clawback_enabled: false },
        data_attr: {},
      });

      const info = await service.getAccountInfo(testKeypair.publicKey());
      expect(info.accountId).toBe(testKeypair.publicKey());
      expect(info.sequence).toBe('12345');
      expect(info.balances).toHaveLength(1);
      expect(info.signers).toHaveLength(1);
    });

    it('should throw for non-existent account', async () => {
      mockLoadAccount.mockRejectedValue({ response: { status: 404 } });
      await expect(
        service.getAccountInfo(testKeypair.publicKey()),
      ).rejects.toThrow(/Account not found/);
    });
  });
});
