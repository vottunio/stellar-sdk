import {
  Horizon,
  Keypair,
  Account,
} from '@stellar/stellar-sdk';

import { ConfigManager } from '../../../src/config/ConfigManager';
import { AssetService } from '../../../src/stellar/AssetService';
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

describe('AssetService', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  const testKeypair = Keypair.random();
  let service: AssetService;

  const mockWallet = {
    publicKey: testKeypair.publicKey(),
    sign: jest.fn(),
    getBalances: jest.fn(),
  };

  const successResponse = {
    hash: 'asset_hash_123',
    ledger: 300,
    successful: true,
    result_xdr: 'resultXdr',
    envelope_xdr: 'envelopeXdr',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    service = new AssetService(config);

    mockLoadAccount.mockResolvedValue(new Account(testKeypair.publicKey(), '100'));
    mockFetchBaseFee.mockResolvedValue(100);
    mockWallet.sign.mockImplementation(async (xdr: string) => xdr);
    mockSubmitTransaction.mockResolvedValue(successResponse);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Asset Wrapper (2.2.12) ────────────────────────────────────────────

  describe('Asset wrapper', () => {
    it('should create a native XLM asset', () => {
      const xlm = AssetService.nativeAsset();
      expect(xlm.isNative()).toBe(true);
    });

    it('should create a custom asset', () => {
      const issuer = Keypair.random().publicKey();
      const usdc = AssetService.customAsset('USDC', issuer);
      expect(usdc.getCode()).toBe('USDC');
      expect(usdc.getIssuer()).toBe(issuer);
    });

    it('should resolve asset spec to native', () => {
      const asset = service.resolveAsset({ code: 'XLM' });
      expect(asset.isNative()).toBe(true);
    });

    it('should resolve asset spec to custom', () => {
      const issuer = Keypair.random().publicKey();
      const asset = service.resolveAsset({ code: 'USDC', issuer });
      expect(asset.getCode()).toBe('USDC');
    });

    it('should throw when non-native asset has no issuer', () => {
      expect(() => service.resolveAsset({ code: 'USDC' })).toThrow(/requires an issuer/);
    });
  });

  // ─── changeTrust (2.2.5) ──────────────────────────────────────────────

  describe('changeTrust', () => {
    it('should add a trustline', async () => {
      const issuer = Keypair.random().publicKey();
      const result = await service.changeTrust(
        { sourceAccount: testKeypair.publicKey(), asset: { code: 'USDC', issuer } },
        mockWallet,
      );
      expect(result.hash).toBe('asset_hash_123');
      expect(result.successful).toBe(true);
    });

    it('should remove a trustline with limit 0', async () => {
      const issuer = Keypair.random().publicKey();
      const result = await service.changeTrust(
        { sourceAccount: testKeypair.publicKey(), asset: { code: 'USDC', issuer }, limit: '0' },
        mockWallet,
      );
      expect(result.successful).toBe(true);
    });

    it('should throw for invalid source address', async () => {
      const issuer = Keypair.random().publicKey();
      await expect(
        service.changeTrust(
          { sourceAccount: 'BAD', asset: { code: 'USDC', issuer } },
          mockWallet,
        ),
      ).rejects.toThrow(/Invalid Stellar address/);
    });
  });

  // ─── createClaimableBalance (2.2.8) ───────────────────────────────────

  describe('createClaimableBalance', () => {
    it('should create a claimable balance with unconditional predicate', async () => {
      const claimant = Keypair.random().publicKey();
      const result = await service.createClaimableBalance(
        {
          sourceAccount: testKeypair.publicKey(),
          asset: { code: 'XLM' },
          amount: '100',
          claimants: [{ destination: claimant, predicate: 'unconditional' }],
        },
        mockWallet,
      );
      expect(result.hash).toBe('asset_hash_123');
      expect(result.successful).toBe(true);
    });

    it('should create a claimable balance with time-based predicate', async () => {
      const claimant = Keypair.random().publicKey();
      const result = await service.createClaimableBalance(
        {
          sourceAccount: testKeypair.publicKey(),
          asset: { code: 'XLM' },
          amount: '50',
          claimants: [{ destination: claimant, predicate: { before: 1700000000 } }],
        },
        mockWallet,
      );
      expect(result.successful).toBe(true);
    });

    it('should create with after predicate', async () => {
      const claimant = Keypair.random().publicKey();
      const result = await service.createClaimableBalance(
        {
          sourceAccount: testKeypair.publicKey(),
          asset: { code: 'XLM' },
          amount: '25',
          claimants: [{ destination: claimant, predicate: { after: 1600000000 } }],
        },
        mockWallet,
      );
      expect(result.successful).toBe(true);
    });

    it('should throw for invalid claimant address', async () => {
      await expect(
        service.createClaimableBalance(
          {
            sourceAccount: testKeypair.publicKey(),
            asset: { code: 'XLM' },
            amount: '100',
            claimants: [{ destination: 'BAD' }],
          },
          mockWallet,
        ),
      ).rejects.toThrow(/Invalid Stellar address/);
    });
  });

  // ─── claimClaimableBalance (2.2.9) ────────────────────────────────────

  describe('claimClaimableBalance', () => {
    it('should claim a claimable balance', async () => {
      // Claimable balance IDs are 72-character hex strings (type prefix + 32 bytes)
      const balanceId = '00000000' + 'a'.repeat(64);
      const result = await service.claimClaimableBalance(
        {
          sourceAccount: testKeypair.publicKey(),
          balanceId,
        },
        mockWallet,
      );
      expect(result.hash).toBe('asset_hash_123');
      expect(result.successful).toBe(true);
    });

    it('should throw for invalid address', async () => {
      await expect(
        service.claimClaimableBalance(
          { sourceAccount: 'BAD', balanceId: 'balance123' },
          mockWallet,
        ),
      ).rejects.toThrow(/Invalid Stellar address/);
    });
  });

  // ─── sponsoredOperation (2.2.10) ──────────────────────────────────────

  describe('sponsoredOperation', () => {
    it('should execute sponsored operations', async () => {
      const sponsored = Keypair.random().publicKey();
      const { Operation } = jest.requireActual('@stellar/stellar-sdk');
      const ops = [
        Operation.manageData({ name: 'sponsored-data', value: 'test' }),
      ];

      const result = await service.sponsoredOperation(
        { sourceAccount: testKeypair.publicKey(), sponsoredAccount: sponsored },
        ops,
        mockWallet,
      );
      expect(result.hash).toBe('asset_hash_123');
      expect(result.successful).toBe(true);
    });

    it('should throw for invalid sponsored address', async () => {
      await expect(
        service.sponsoredOperation(
          { sourceAccount: testKeypair.publicKey(), sponsoredAccount: 'BAD' },
          [],
          mockWallet,
        ),
      ).rejects.toThrow(/Invalid Stellar address/);
    });
  });
});
