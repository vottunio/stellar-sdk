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

// ─── Stellar Operations Types (Phase 2.2) ────────────────────────────────────

/**
 * Parameters for a high-level send payment operation.
 */
export interface StellarSendPaymentParams {
  /** Source account public key. */
  sourceAccount: string;
  /** Destination account public key. */
  destination: string;
  /** Asset to send. */
  asset: { code: string; issuer?: string };
  /** Amount to send (as string, e.g. '100.50'). */
  amount: string;
  /** Optional memo to attach. */
  memo?: { type: 'text' | 'id' | 'hash' | 'return'; value: string };
  /** Optional fee in stroops. */
  fee?: string;
}

/**
 * Parameters for creating a new Stellar account on-chain.
 */
export interface StellarCreateAccountParams {
  /** Source account public key that funds the new account. */
  sourceAccount: string;
  /** New account public key. */
  destination: string;
  /** Starting balance in XLM (as string). */
  startingBalance: string;
}

/**
 * Parameters for a change trust operation.
 */
export interface StellarChangeTrustParams {
  /** Source account public key. */
  sourceAccount: string;
  /** Asset to trust. */
  asset: { code: string; issuer: string };
  /** Trust limit (omit or '0' to remove trustline). */
  limit?: string;
}

/**
 * Parameters for a path payment strict send operation.
 */
export interface StellarPathPaymentStrictSendParams {
  sourceAccount: string;
  sendAsset: { code: string; issuer?: string };
  sendAmount: string;
  destination: string;
  destAsset: { code: string; issuer?: string };
  destMin: string;
  path?: { code: string; issuer?: string }[];
}

/**
 * Parameters for a path payment strict receive operation.
 */
export interface StellarPathPaymentStrictReceiveParams {
  sourceAccount: string;
  sendAsset: { code: string; issuer?: string };
  sendMax: string;
  destination: string;
  destAsset: { code: string; issuer?: string };
  destAmount: string;
  path?: { code: string; issuer?: string }[];
}

/**
 * Claimant predicate for claimable balances.
 */
export interface ClaimantSpec {
  destination: string;
  predicate?: 'unconditional' | { before: number } | { after: number };
}

/**
 * Parameters for creating a claimable balance.
 */
export interface CreateClaimableBalanceParams {
  sourceAccount: string;
  asset: { code: string; issuer?: string };
  amount: string;
  claimants: ClaimantSpec[];
}

/**
 * Parameters for claiming a claimable balance.
 */
export interface ClaimClaimableBalanceParams {
  sourceAccount: string;
  balanceId: string;
}

/**
 * Parameters for sponsored reserves operations.
 */
export interface SponsoredOperationParams {
  sourceAccount: string;
  sponsoredAccount: string;
}

/**
 * Parameters for manage data operation.
 */
export interface ManageDataOperationParams {
  sourceAccount: string;
  name: string;
  value?: string | Buffer | null;
}

/**
 * Error codes for Stellar operation failures.
 */
export enum StellarOperationErrorCode {
  ACCOUNT_NOT_FOUND = 'STELLAR_ACCOUNT_NOT_FOUND',
  ACCOUNT_ALREADY_EXISTS = 'STELLAR_ACCOUNT_ALREADY_EXISTS',
  FUND_FAILED = 'STELLAR_FUND_FAILED',
  PAYMENT_FAILED = 'STELLAR_PAYMENT_FAILED',
  TRUSTLINE_FAILED = 'STELLAR_TRUSTLINE_FAILED',
  PATH_PAYMENT_FAILED = 'STELLAR_PATH_PAYMENT_FAILED',
  CLAIMABLE_BALANCE_FAILED = 'STELLAR_CLAIMABLE_BALANCE_FAILED',
  SPONSORSHIP_FAILED = 'STELLAR_SPONSORSHIP_FAILED',
  MANAGE_DATA_FAILED = 'STELLAR_MANAGE_DATA_FAILED',
  INVALID_ADDRESS = 'STELLAR_INVALID_ADDRESS',
  BUILD_FAILED = 'STELLAR_BUILD_FAILED',
}

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
  /** Base fee in stroops (default: '100'). Soroban may require higher fees on mainnet. */
  fee?: string;
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
