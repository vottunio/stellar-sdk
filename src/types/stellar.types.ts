import { xdr } from '@stellar/stellar-sdk';

import { Balance } from './wallet.types';

/**
 * Stellar account information.
 */
export interface AccountInfo {
  id: string;
  accountId: string;
  sequence: string;
  balances: Balance[];
  signers: AccountSigner[];
  thresholds: AccountThresholds;
  flags: AccountFlags;
  data: Record<string, string>;
}

/**
 * Account signer entry.
 */
export interface AccountSigner {
  key: string;
  weight: number;
  type: string;
}

/**
 * Account threshold levels.
 */
export interface AccountThresholds {
  lowThreshold: number;
  medThreshold: number;
  highThreshold: number;
}

/**
 * Account flags.
 */
export interface AccountFlags {
  authRequired: boolean;
  authRevocable: boolean;
  authImmutable: boolean;
  authClawbackEnabled: boolean;
}

/**
 * Ledger information.
 */
export interface LedgerInfo {
  sequence: number;
  hash: string;
  closedAt: string;
  transactionCount: number;
  operationCount: number;
  baseFeeInStroops: number;
}

/**
 * Streaming event callback.
 */
export type StreamCallback<T> = (event: T) => void;

/**
 * Stream close function returned when subscribing.
 */
export type StreamCloseFn = () => void;

// ─── Soroban Types ───────────────────────────────────────────────────────────

/**
 * Soroban ScVal type hints for nativeToScVal conversion.
 */
export type ScValType =
  | 'address'
  | 'bytes'
  | 'boolean'
  | 'i32'
  | 'i64'
  | 'i128'
  | 'i256'
  | 'u32'
  | 'u64'
  | 'u128'
  | 'u256'
  | 'string'
  | 'symbol';

/**
 * Parameters for invoking a Soroban smart contract method (read-write).
 */
export interface InvokeContractParams {
  /** The Soroban contract ID (C... address). */
  contractId: string;
  /** The contract method name to invoke. */
  method: string;
  /** Arguments to pass to the contract method. */
  args?: xdr.ScVal[];
  /** The source account public key that will sign the transaction. */
  sourceAccount: string;
}

/**
 * Parameters for reading a Soroban smart contract (simulation only, no submit).
 */
export interface ReadContractParams {
  /** The Soroban contract ID (C... address). */
  contractId: string;
  /** The contract method name to call. */
  method: string;
  /** Arguments to pass to the contract method. */
  args?: xdr.ScVal[];
  /** The source account public key used for simulation context. */
  sourceAccount: string;
}

/**
 * Result of a Soroban contract invocation.
 */
export interface ContractInvocationResult {
  /** The transaction hash. */
  hash: string;
  /** The decoded return value from the contract, or undefined if void. */
  returnValue?: unknown;
  /** The raw XDR result from the Soroban RPC. */
  rawResultXdr?: string;
  /** The ledger the transaction was included in. */
  ledger?: number;
}

/**
 * Result of a Soroban contract read (simulation).
 */
export interface ContractReadResult {
  /** The decoded return value from the simulation. */
  returnValue?: unknown;
  /** The raw ScVal result. */
  rawResultXdr?: string;
  /** Estimated cost of the simulation. */
  cost?: {
    cpuInsns: string;
    memBytes: string;
  };
}

/**
 * Soroban error codes for typed error mapping.
 */
export enum SorobanErrorCode {
  CONNECTION_FAILED = 'SOROBAN_CONNECTION_FAILED',
  SIMULATION_FAILED = 'SOROBAN_SIMULATION_FAILED',
  PREPARE_FAILED = 'SOROBAN_PREPARE_FAILED',
  INVOKE_FAILED = 'SOROBAN_INVOKE_FAILED',
  CONTRACT_NOT_FOUND = 'SOROBAN_CONTRACT_NOT_FOUND',
  INVALID_CONTRACT_ID = 'SOROBAN_INVALID_CONTRACT_ID',
  ENCODING_ERROR = 'SOROBAN_ENCODING_ERROR',
  DECODING_ERROR = 'SOROBAN_DECODING_ERROR',
  TRANSACTION_FAILED = 'SOROBAN_TRANSACTION_FAILED',
  TIMEOUT = 'SOROBAN_TIMEOUT',
}
