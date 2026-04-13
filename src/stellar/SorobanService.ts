import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
  StrKey,
} from '@stellar/stellar-sdk';

import { Logger } from '../config/Logger';
import { StellarError } from '../errors/StellarError';
import { ResolvedConfig } from '../types/config.types';
import {
  ContractInvocationResult,
  ContractReadResult,
  InvokeContractParams,
  ReadContractParams,
  ScValType,
  SorobanErrorCode,
} from '../types/stellar.types';
import { Wallet } from '../types/wallet.types';

/**
 * Service for interacting with Soroban smart contracts on Stellar.
 *
 * Provides methods for invoking contracts (read-write), reading contract state
 * (simulation only), ScVal encoding/decoding, and transaction preparation.
 *
 * @example
 * ```typescript
 * const soroban = new SorobanService(config);
 *
 * // Read a contract value (no transaction submission)
 * const result = await soroban.readContract({
 *   contractId: 'C...',
 *   method: 'balance',
 *   args: [soroban.nativeToScVal('G...', 'address')],
 *   sourceAccount: 'G...',
 * });
 *
 * // Invoke a contract method (builds, signs, submits)
 * const invocation = await soroban.invokeContract(
 *   { contractId: 'C...', method: 'transfer', args: [...], sourceAccount: 'G...' },
 *   wallet,
 * );
 * ```
 */
export class SorobanService {
  private config: ResolvedConfig;
  private readonly logger: Logger;
  private server: SorobanRpc.Server;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.logger = new Logger(config.logging.level, 'SorobanService');
    this.server = this.createServer();
  }

  // ─── Client Initialization (2.1.1) ──────────────────────────────────────────

  private createServer(): SorobanRpc.Server {
    try {
      const server = new SorobanRpc.Server(this.config.sorobanRpcUrl, {
        allowHttp: this.config.sorobanRpcUrl.startsWith('http://'),
      });
      this.logger.debug(`Soroban RPC connected: ${this.config.sorobanRpcUrl}`);
      return server;
    } catch (error) {
      throw this.normalizeError(
        error,
        SorobanErrorCode.CONNECTION_FAILED,
        'Failed to initialize Soroban RPC client',
      );
    }
  }

  /** Get the underlying SorobanRpc.Server instance for advanced usage. */
  getServer(): SorobanRpc.Server {
    return this.server;
  }

  /** Reinitialize the server (e.g. after a network switch). */
  reconnect(config?: ResolvedConfig): void {
    if (config) {
      this.config = config;
    }
    this.server = this.createServer();
  }

  // ─── Contract Instance (2.1.6) ─────────────────────────────────────────────

  /**
   * Get a Contract instance for the given contract ID.
   *
   * @param contractId - The Soroban contract ID (C... address).
   * @returns A Contract instance for building invocations.
   */
  getContract(contractId: string): Contract {
    this.validateContractId(contractId);
    return new Contract(contractId);
  }

  // ─── Invoke Contract (2.1.2) ────────────────────────────────────────────────

  /**
   * Invoke a Soroban contract method (read-write). Builds the transaction,
   * simulates it, prepares resource footprint, signs, and submits.
   *
   * @param params - Contract invocation parameters.
   * @param wallet - Wallet to sign the transaction with.
   * @returns The invocation result including transaction hash and decoded return value.
   */
  async invokeContract(
    params: InvokeContractParams,
    wallet: Wallet,
  ): Promise<ContractInvocationResult> {
    this.validateContractId(params.contractId);
    this.logger.info(`Invoking contract ${params.contractId}.${params.method}`);

    try {
      // Build the invocation transaction
      const contract = this.getContract(params.contractId);
      const account = await this.server.getAccount(params.sourceAccount);

      const tx = new TransactionBuilder(account, {
        fee: params.fee ?? '100',
        networkPassphrase: this.config.networkPassphrase,
      })
        .addOperation(contract.call(params.method, ...(params.args ?? [])))
        .setTimeout(30)
        .build();

      // Prepare (simulate + add resource footprint — may adjust fee upward)
      const preparedTx = await this.prepareTransaction(tx);

      // Sign
      const signedXdr = await wallet.sign(preparedTx.toXDR(), this.config.networkPassphrase);
      const signedTx = TransactionBuilder.fromXDR(
        signedXdr,
        this.config.networkPassphrase,
      );

      // Submit and poll for result
      const sendResponse = await this.server.sendTransaction(signedTx);
      this.logger.debug(`Transaction sent: ${sendResponse.hash}`);

      if (sendResponse.status === 'ERROR') {
        throw new StellarError(
          `Transaction submission failed: ${sendResponse.status}`,
          SorobanErrorCode.TRANSACTION_FAILED,
          { hash: sendResponse.hash, errorResult: sendResponse.errorResult?.toXDR('base64') },
        );
      }

      // Poll for completion
      const result = await this.pollTransaction(sendResponse.hash);
      return result;
    } catch (error) {
      if (error instanceof StellarError) throw error;
      throw this.normalizeError(
        error,
        SorobanErrorCode.INVOKE_FAILED,
        `Failed to invoke ${params.contractId}.${params.method}`,
      );
    }
  }

  // ─── Read Contract / Query (2.1.3) ─────────────────────────────────────────

  /**
   * Read a Soroban contract value via simulation (no transaction submitted).
   *
   * @param params - Contract read parameters.
   * @returns The simulation result including decoded return value and estimated cost.
   */
  async readContract(params: ReadContractParams): Promise<ContractReadResult> {
    this.validateContractId(params.contractId);
    this.logger.info(`Reading contract ${params.contractId}.${params.method}`);

    try {
      const contract = this.getContract(params.contractId);
      const account = await this.server.getAccount(params.sourceAccount);

      const tx = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.config.networkPassphrase,
      })
        .addOperation(contract.call(params.method, ...(params.args ?? [])))
        .setTimeout(30)
        .build();

      const simulation = await this.server.simulateTransaction(tx);

      if (SorobanRpc.Api.isSimulationError(simulation)) {
        throw new StellarError(
          `Contract simulation failed: ${simulation.error}`,
          SorobanErrorCode.SIMULATION_FAILED,
          { error: simulation.error },
        );
      }

      const successSim = simulation as SorobanRpc.Api.SimulateTransactionSuccessResponse;
      const resultXdr = successSim.result?.retval;

      return {
        returnValue: resultXdr ? scValToNative(resultXdr) : undefined,
        rawResultXdr: resultXdr?.toXDR('base64'),
        cost: successSim.cost
          ? { cpuInsns: successSim.cost.cpuInsns, memBytes: successSim.cost.memBytes }
          : undefined,
      };
    } catch (error) {
      if (error instanceof StellarError) throw error;
      throw this.normalizeError(
        error,
        SorobanErrorCode.SIMULATION_FAILED,
        `Failed to read ${params.contractId}.${params.method}`,
      );
    }
  }

  // ─── ScVal Encoding / Decoding (2.1.4, 2.1.5) ─────────────────────────────

  /**
   * Convert a native JS value to a Soroban ScVal.
   *
   * @param value - The JS value to convert.
   * @param type - Optional type hint for the conversion.
   * @returns The encoded ScVal.
   */
  nativeToScVal(value: unknown, type?: ScValType): xdr.ScVal {
    try {
      return nativeToScVal(value, type ? { type } as never : undefined);
    } catch (error) {
      throw new StellarError(
        `Failed to encode value to ScVal: ${(error as Error).message}`,
        SorobanErrorCode.ENCODING_ERROR,
        { value: String(value), type },
      );
    }
  }

  /**
   * Convert a Soroban ScVal to a native JS value.
   *
   * @param val - The ScVal to decode.
   * @returns The decoded JS value.
   */
  scValToNative(val: xdr.ScVal): unknown {
    try {
      return scValToNative(val);
    } catch (error) {
      throw new StellarError(
        `Failed to decode ScVal: ${(error as Error).message}`,
        SorobanErrorCode.DECODING_ERROR,
        { scValType: val.switch().name },
      );
    }
  }

  // ─── Prepare Transaction (2.1.7) ───────────────────────────────────────────

  /**
   * Prepare a transaction by simulating it and adding the Soroban resource footprint.
   *
   * @param transaction - The unsigned transaction to prepare.
   * @returns The prepared transaction with resource footprint attached.
   */
  async prepareTransaction(
    transaction: ReturnType<TransactionBuilder['build']>,
  ): Promise<ReturnType<TransactionBuilder['build']>> {
    try {
      const prepared = await this.server.prepareTransaction(transaction);
      this.logger.debug('Transaction prepared with resource footprint');
      return prepared as ReturnType<TransactionBuilder['build']>;
    } catch (error) {
      if (error instanceof StellarError) throw error;
      throw this.normalizeError(
        error,
        SorobanErrorCode.PREPARE_FAILED,
        'Failed to prepare Soroban transaction',
      );
    }
  }

  // ─── Transaction Polling ───────────────────────────────────────────────────

  /**
   * Poll the Soroban RPC for a transaction result until it completes or times out.
   */
  private async pollTransaction(hash: string): Promise<ContractInvocationResult> {
    const maxAttempts = this.config.retry.maxAttempts * 5; // Soroban can be slow
    const baseDelay = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await this.server.getTransaction(hash);

      if (response.status === 'SUCCESS') {
        this.logger.info(`Transaction ${hash} confirmed in ledger ${response.ledger}`);

        const returnValue = response.returnValue
          ? scValToNative(response.returnValue)
          : undefined;

        return {
          hash,
          returnValue,
          rawResultXdr: response.returnValue?.toXDR('base64'),
          ledger: response.ledger,
        };
      }

      if (response.status === 'FAILED') {
        throw new StellarError(
          `Soroban transaction failed: ${hash}`,
          SorobanErrorCode.TRANSACTION_FAILED,
          { hash, status: response.status },
        );
      }

      // NOT_FOUND — still pending, wait and retry
      const delay = Math.min(baseDelay * Math.pow(this.config.retry.backoffMultiplier, attempt), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    throw new StellarError(
      `Transaction ${hash} did not complete within timeout`,
      SorobanErrorCode.TIMEOUT,
      { hash, maxAttempts },
    );
  }

  // ─── Error Normalization (2.1.8) ───────────────────────────────────────────

  /**
   * Normalize an unknown error into a typed StellarError with Soroban error code.
   */
  private normalizeError(
    error: unknown,
    code: SorobanErrorCode,
    contextMessage: string,
  ): StellarError {
    const originalMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(`${contextMessage}: ${originalMessage}`);

    return new StellarError(`${contextMessage}: ${originalMessage}`, code, {
      originalError: originalMessage,
    });
  }

  // ─── Validation ────────────────────────────────────────────────────────────

  private validateContractId(contractId: string): void {
    if (!contractId || typeof contractId !== 'string') {
      throw new StellarError(
        'Contract ID is required',
        SorobanErrorCode.INVALID_CONTRACT_ID,
      );
    }

    try {
      StrKey.decodeContract(contractId);
    } catch {
      throw new StellarError(
        `Invalid Soroban contract ID: ${contractId}`,
        SorobanErrorCode.INVALID_CONTRACT_ID,
        { contractId },
      );
    }
  }
}
