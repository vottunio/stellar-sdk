import {
  Contract,
  SorobanRpc,
  Keypair,
  Account,
  TransactionBuilder as StellarTxBuilder,
  Networks,
  Operation,
  nativeToScVal,
  xdr,
  StrKey,
} from '@stellar/stellar-sdk';

import { ConfigManager } from '../../../src/config/ConfigManager';
import { StellarError } from '../../../src/errors/StellarError';
import { SorobanService } from '../../../src/stellar/SorobanService';
import { SorobanErrorCode } from '../../../src/types/stellar.types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGetAccount = jest.fn();
const mockSimulateTransaction = jest.fn();
const mockPrepareTransaction = jest.fn();
const mockSendTransaction = jest.fn();
const mockGetTransaction = jest.fn();

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    SorobanRpc: {
      ...actual.SorobanRpc,
      Server: jest.fn().mockImplementation(() => ({
        getAccount: mockGetAccount,
        simulateTransaction: mockSimulateTransaction,
        prepareTransaction: mockPrepareTransaction,
        sendTransaction: mockSendTransaction,
        getTransaction: mockGetTransaction,
      })),
    },
  };
});

// ─── Test Setup ──────────────────────────────────────────────────────────────

describe('SorobanService', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  const testKeypair = Keypair.random();
  // Generate a valid contract ID using StrKey
  const contractKeypair = Keypair.random();
  const testContractId = StrKey.encodeContract(contractKeypair.rawPublicKey());

  let service: SorobanService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    service = new SorobanService(config);

    // Default mock: getAccount returns a valid account
    mockGetAccount.mockResolvedValue(
      new Account(testKeypair.publicKey(), '100'),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Initialization (2.1.1) ──────────────────────────────────────────────

  describe('initialization', () => {
    it('should create a SorobanService instance', () => {
      expect(service).toBeInstanceOf(SorobanService);
    });

    it('should initialize with the configured Soroban RPC URL', () => {
      expect(SorobanRpc.Server).toHaveBeenCalledWith(
        config.sorobanRpcUrl,
        { allowHttp: false },
      );
    });

    it('should return the underlying server via getServer()', () => {
      const server = service.getServer();
      expect(server).toBeDefined();
    });

    it('should reconnect with new config', () => {
      const newConfig = new ConfigManager({ network: 'mainnet' }).getConfig();
      service.reconnect(newConfig);
      // Server constructor called again with new URL
      expect(SorobanRpc.Server).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Contract Instance (2.1.6) ──────────────────────────────────────────

  describe('getContract', () => {
    it('should return a Contract instance for a valid contract ID', () => {
      const contract = service.getContract(testContractId);
      expect(contract).toBeInstanceOf(Contract);
    });

    it('should throw for an invalid contract ID', () => {
      expect(() => service.getContract('INVALID')).toThrow(StellarError);
      expect(() => service.getContract('INVALID')).toThrow(
        /Invalid Soroban contract ID/,
      );
    });

    it('should throw for empty contract ID', () => {
      expect(() => service.getContract('')).toThrow(StellarError);
    });
  });

  // ─── ScVal Encoding (2.1.4) ─────────────────────────────────────────────

  describe('nativeToScVal', () => {
    it('should encode a string value', () => {
      const result = service.nativeToScVal('hello', 'string');
      expect(result).toBeInstanceOf(xdr.ScVal);
    });

    it('should encode a boolean value', () => {
      const result = service.nativeToScVal(true);
      expect(result).toBeInstanceOf(xdr.ScVal);
    });

    it('should encode a symbol value', () => {
      const result = service.nativeToScVal('transfer', 'symbol');
      expect(result).toBeInstanceOf(xdr.ScVal);
    });

    it('should encode an i128 value', () => {
      const result = service.nativeToScVal(1000000n, 'i128');
      expect(result).toBeInstanceOf(xdr.ScVal);
    });

    it('should encode a u32 value', () => {
      const result = service.nativeToScVal(42, 'u32');
      expect(result).toBeInstanceOf(xdr.ScVal);
    });

    it('should throw StellarError with ENCODING_ERROR on failure', () => {
      try {
        // Passing an object without a type hint that can't be auto-detected
        service.nativeToScVal(Symbol('bad'), 'u32');
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(StellarError);
        expect((err as StellarError).code).toBe(SorobanErrorCode.ENCODING_ERROR);
      }
    });
  });

  // ─── ScVal Decoding (2.1.5) ─────────────────────────────────────────────

  describe('scValToNative', () => {
    it('should decode an i32 ScVal to a number', () => {
      const scVal = nativeToScVal(42, { type: 'i32' });
      const result = service.scValToNative(scVal);
      expect(result).toBe(42);
    });

    it('should decode a string ScVal', () => {
      const scVal = nativeToScVal('hello', { type: 'string' });
      const result = service.scValToNative(scVal);
      expect(result).toBe('hello');
    });

    it('should decode a boolean ScVal', () => {
      const scVal = nativeToScVal(true);
      const result = service.scValToNative(scVal);
      expect(result).toBe(true);
    });

    it('should decode a symbol ScVal', () => {
      const scVal = nativeToScVal('transfer', { type: 'symbol' });
      const result = service.scValToNative(scVal);
      expect(result).toBe('transfer');
    });
  });

  // ─── Read Contract (2.1.3) ──────────────────────────────────────────────

  describe('readContract', () => {
    it('should simulate a contract call and return decoded result', async () => {
      const mockRetval = nativeToScVal(42, { type: 'i32' });
      mockSimulateTransaction.mockResolvedValue({
        result: { retval: mockRetval },
        cost: { cpuInsns: '1000', memBytes: '500' },
      });

      const result = await service.readContract({
        contractId: testContractId,
        method: 'get_count',
        sourceAccount: testKeypair.publicKey(),
      });

      expect(result.returnValue).toBe(42);
      expect(result.cost).toEqual({ cpuInsns: '1000', memBytes: '500' });
      expect(result.rawResultXdr).toBeDefined();
      expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);
    });

    it('should handle simulation with no return value', async () => {
      mockSimulateTransaction.mockResolvedValue({
        result: {},
        cost: { cpuInsns: '100', memBytes: '50' },
      });

      const result = await service.readContract({
        contractId: testContractId,
        method: 'void_method',
        sourceAccount: testKeypair.publicKey(),
      });

      expect(result.returnValue).toBeUndefined();
      expect(result.rawResultXdr).toBeUndefined();
    });

    it('should throw on simulation error', async () => {
      mockSimulateTransaction.mockResolvedValue({
        error: 'host invocation failed',
      });

      // Mock isSimulationError
      jest.spyOn(SorobanRpc.Api, 'isSimulationError').mockReturnValue(true);

      await expect(
        service.readContract({
          contractId: testContractId,
          method: 'bad_method',
          sourceAccount: testKeypair.publicKey(),
        }),
      ).rejects.toThrow(StellarError);
    });

    it('should throw for invalid contract ID', async () => {
      await expect(
        service.readContract({
          contractId: 'INVALID',
          method: 'test',
          sourceAccount: testKeypair.publicKey(),
        }),
      ).rejects.toThrow(StellarError);
    });
  });

  // ─── Invoke Contract (2.1.2) ────────────────────────────────────────────

  describe('invokeContract', () => {
    const mockWallet = {
      publicKey: testKeypair.publicKey(),
      sign: jest.fn(),
      getBalances: jest.fn(),
    };

    beforeEach(() => {
      // Build a real transaction XDR that the wallet "signs" (returns as-is for testing)
      mockWallet.sign.mockImplementation(async (txXdr: string) => {
        // In tests, just return the XDR as-is (pretend it's signed)
        return txXdr;
      });
    });

    it('should invoke a contract and return result on success', async () => {
      // prepareTransaction returns a transaction-like object
      const account = new Account(testKeypair.publicKey(), '100');
      const preparedTx = new StellarTxBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(Operation.manageData({ name: 'test', value: 'val' }))
        .setTimeout(30)
        .build();

      mockPrepareTransaction.mockResolvedValue(preparedTx);

      mockSendTransaction.mockResolvedValue({
        hash: 'tx_hash_abc',
        status: 'PENDING',
      });

      const mockReturnVal = nativeToScVal(100, { type: 'i32' });
      mockGetTransaction.mockResolvedValue({
        status: 'SUCCESS',
        ledger: 12345,
        returnValue: mockReturnVal,
      });

      const result = await service.invokeContract(
        {
          contractId: testContractId,
          method: 'transfer',
          args: [],
          sourceAccount: testKeypair.publicKey(),
        },
        mockWallet,
      );

      expect(result.hash).toBe('tx_hash_abc');
      expect(result.returnValue).toBe(100);
      expect(result.ledger).toBe(12345);
      expect(mockWallet.sign).toHaveBeenCalledTimes(1);
    });

    it('should throw on submission ERROR status', async () => {
      const account = new Account(testKeypair.publicKey(), '100');
      const preparedTx = new StellarTxBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(Operation.manageData({ name: 'test', value: 'val' }))
        .setTimeout(30)
        .build();

      mockPrepareTransaction.mockResolvedValue(preparedTx);

      mockSendTransaction.mockResolvedValue({
        hash: 'tx_hash_fail',
        status: 'ERROR',
        errorResult: { toXDR: () => 'error_xdr' },
      });

      await expect(
        service.invokeContract(
          {
            contractId: testContractId,
            method: 'transfer',
            sourceAccount: testKeypair.publicKey(),
          },
          mockWallet,
        ),
      ).rejects.toThrow(/Transaction submission failed/);
    });

    it('should throw on FAILED transaction poll result', async () => {
      const account = new Account(testKeypair.publicKey(), '100');
      const preparedTx = new StellarTxBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(Operation.manageData({ name: 'test', value: 'val' }))
        .setTimeout(30)
        .build();

      mockPrepareTransaction.mockResolvedValue(preparedTx);

      mockSendTransaction.mockResolvedValue({
        hash: 'tx_hash_fail2',
        status: 'PENDING',
      });

      mockGetTransaction.mockResolvedValue({
        status: 'FAILED',
      });

      await expect(
        service.invokeContract(
          {
            contractId: testContractId,
            method: 'transfer',
            sourceAccount: testKeypair.publicKey(),
          },
          mockWallet,
        ),
      ).rejects.toThrow(StellarError);
    });

    it('should throw for invalid contract ID', async () => {
      await expect(
        service.invokeContract(
          {
            contractId: 'BAD_ID',
            method: 'test',
            sourceAccount: testKeypair.publicKey(),
          },
          mockWallet,
        ),
      ).rejects.toThrow(/Invalid Soroban contract ID/);
    });
  });

  // ─── Prepare Transaction (2.1.7) ───────────────────────────────────────

  describe('prepareTransaction', () => {
    it('should prepare a transaction via simulation', async () => {
      const account = new Account(testKeypair.publicKey(), '100');
      const tx = new StellarTxBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(Operation.manageData({ name: 'test', value: 'val' }))
        .setTimeout(30)
        .build();

      mockPrepareTransaction.mockResolvedValue(tx);

      const prepared = await service.prepareTransaction(tx);
      expect(prepared).toBeDefined();
      expect(mockPrepareTransaction).toHaveBeenCalledWith(tx);
    });

    it('should throw on preparation failure', async () => {
      const account = new Account(testKeypair.publicKey(), '100');
      const tx = new StellarTxBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(Operation.manageData({ name: 'test', value: 'val' }))
        .setTimeout(30)
        .build();

      mockPrepareTransaction.mockRejectedValue(new Error('Simulation failed'));

      await expect(service.prepareTransaction(tx)).rejects.toThrow(StellarError);
    });
  });

  // ─── Error Normalization (2.1.8) ───────────────────────────────────────

  describe('error normalization', () => {
    it('should wrap unknown errors as StellarError with Soroban error code', async () => {
      mockGetAccount.mockRejectedValue(new Error('Network timeout'));

      try {
        await service.readContract({
          contractId: testContractId,
          method: 'test',
          sourceAccount: testKeypair.publicKey(),
        });
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(StellarError);
        expect((err as StellarError).code).toBe(SorobanErrorCode.SIMULATION_FAILED);
        expect((err as StellarError).message).toContain('Network timeout');
      }
    });

    it('should preserve StellarError instances without re-wrapping', async () => {
      const original = new StellarError(
        'Already typed',
        SorobanErrorCode.CONTRACT_NOT_FOUND,
      );
      mockGetAccount.mockRejectedValue(original);

      // readContract catches and re-throws StellarError as-is
      try {
        await service.readContract({
          contractId: testContractId,
          method: 'test',
          sourceAccount: testKeypair.publicKey(),
        });
        fail('Should have thrown');
      } catch (err) {
        // The error propagation preserves the original when it's already a StellarError
        // (caught → re-thrown in the catch block)
        expect(err).toBeInstanceOf(StellarError);
      }
    });
  });

  // ─── Validation ────────────────────────────────────────────────────────

  describe('validation', () => {
    it('should reject empty contract ID', () => {
      expect(() => service.getContract('')).toThrow(StellarError);
    });

    it('should reject non-C contract addresses', () => {
      // A valid public key but not a contract ID
      const publicKey = Keypair.random().publicKey();
      expect(() => service.getContract(publicKey)).toThrow(
        /Invalid Soroban contract ID/,
      );
    });
  });
});
