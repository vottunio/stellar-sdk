import {
  Horizon,
  Keypair,
  Account,
} from '@stellar/stellar-sdk';

import { ConfigManager } from '../../../src/config/ConfigManager';
import { PaymentService } from '../../../src/stellar/PaymentService';
import { StellarError } from '../../../src/errors/StellarError';
import { StellarOperationErrorCode } from '../../../src/types/stellar.types';

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

describe('PaymentService', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  const sender = Keypair.random();
  const receiver = Keypair.random();
  let service: PaymentService;

  const mockWallet = {
    publicKey: sender.publicKey(),
    sign: jest.fn(),
    getBalances: jest.fn(),
  };

  const successResponse = {
    hash: 'pay_hash_123',
    ledger: 500,
    successful: true,
    result_xdr: 'resultXdr',
    envelope_xdr: 'envelopeXdr',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    service = new PaymentService(config);

    mockLoadAccount.mockResolvedValue(new Account(sender.publicKey(), '100'));
    mockFetchBaseFee.mockResolvedValue(100);
    mockWallet.sign.mockImplementation(async (xdr: string) => xdr);
    mockSubmitTransaction.mockResolvedValue(successResponse);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── sendPayment (2.2.3) ───────────────────────────────────────────────

  describe('sendPayment', () => {
    it('should send an XLM payment', async () => {
      const result = await service.sendPayment(
        {
          sourceAccount: sender.publicKey(),
          destination: receiver.publicKey(),
          asset: { code: 'XLM' },
          amount: '25.5',
        },
        mockWallet,
      );
      expect(result.hash).toBe('pay_hash_123');
      expect(result.successful).toBe(true);
      expect(mockWallet.sign).toHaveBeenCalledTimes(1);
    });

    it('should send a payment with memo', async () => {
      const result = await service.sendPayment(
        {
          sourceAccount: sender.publicKey(),
          destination: receiver.publicKey(),
          asset: { code: 'XLM' },
          amount: '10',
          memo: { type: 'text', value: 'test payment' },
        },
        mockWallet,
      );
      expect(result.successful).toBe(true);
    });

    it('should send a non-native asset payment', async () => {
      const result = await service.sendPayment(
        {
          sourceAccount: sender.publicKey(),
          destination: receiver.publicKey(),
          asset: { code: 'USDC', issuer: Keypair.random().publicKey() },
          amount: '100',
        },
        mockWallet,
      );
      expect(result.successful).toBe(true);
    });

    it('should throw for non-native asset without issuer', async () => {
      await expect(
        service.sendPayment(
          {
            sourceAccount: sender.publicKey(),
            destination: receiver.publicKey(),
            asset: { code: 'USDC' },
            amount: '100',
          },
          mockWallet,
        ),
      ).rejects.toThrow(/requires an issuer/);
    });

    it('should throw for invalid source address', async () => {
      await expect(
        service.sendPayment(
          {
            sourceAccount: 'INVALID',
            destination: receiver.publicKey(),
            asset: { code: 'XLM' },
            amount: '10',
          },
          mockWallet,
        ),
      ).rejects.toThrow(/Invalid Stellar address/);
    });

    it('should throw for invalid destination address', async () => {
      await expect(
        service.sendPayment(
          {
            sourceAccount: sender.publicKey(),
            destination: 'INVALID',
            asset: { code: 'XLM' },
            amount: '10',
          },
          mockWallet,
        ),
      ).rejects.toThrow(/Invalid Stellar address/);
    });
  });

  // ─── pathPaymentStrictSend (2.2.6) ────────────────────────────────────

  describe('pathPaymentStrictSend', () => {
    it('should execute a strict send path payment', async () => {
      const issuer = Keypair.random().publicKey();
      const result = await service.pathPaymentStrictSend(
        {
          sourceAccount: sender.publicKey(),
          sendAsset: { code: 'XLM' },
          sendAmount: '10',
          destination: receiver.publicKey(),
          destAsset: { code: 'USDC', issuer },
          destMin: '1',
        },
        mockWallet,
      );
      expect(result.hash).toBe('pay_hash_123');
      expect(result.successful).toBe(true);
    });

    it('should support intermediate path assets', async () => {
      const issuer1 = Keypair.random().publicKey();
      const issuer2 = Keypair.random().publicKey();
      const result = await service.pathPaymentStrictSend(
        {
          sourceAccount: sender.publicKey(),
          sendAsset: { code: 'XLM' },
          sendAmount: '10',
          destination: receiver.publicKey(),
          destAsset: { code: 'USDC', issuer: issuer1 },
          destMin: '1',
          path: [{ code: 'EURC', issuer: issuer2 }],
        },
        mockWallet,
      );
      expect(result.successful).toBe(true);
    });

    it('should throw for invalid addresses', async () => {
      await expect(
        service.pathPaymentStrictSend(
          {
            sourceAccount: 'BAD',
            sendAsset: { code: 'XLM' },
            sendAmount: '10',
            destination: receiver.publicKey(),
            destAsset: { code: 'XLM' },
            destMin: '1',
          },
          mockWallet,
        ),
      ).rejects.toThrow(/Invalid Stellar address/);
    });
  });

  // ─── pathPaymentStrictReceive (2.2.7) ─────────────────────────────────

  describe('pathPaymentStrictReceive', () => {
    it('should execute a strict receive path payment', async () => {
      const issuer = Keypair.random().publicKey();
      const result = await service.pathPaymentStrictReceive(
        {
          sourceAccount: sender.publicKey(),
          sendAsset: { code: 'XLM' },
          sendMax: '100',
          destination: receiver.publicKey(),
          destAsset: { code: 'USDC', issuer },
          destAmount: '10',
        },
        mockWallet,
      );
      expect(result.hash).toBe('pay_hash_123');
      expect(result.successful).toBe(true);
    });

    it('should throw for invalid destination', async () => {
      await expect(
        service.pathPaymentStrictReceive(
          {
            sourceAccount: sender.publicKey(),
            sendAsset: { code: 'XLM' },
            sendMax: '100',
            destination: 'BAD',
            destAsset: { code: 'XLM' },
            destAmount: '10',
          },
          mockWallet,
        ),
      ).rejects.toThrow(/Invalid Stellar address/);
    });
  });
});
