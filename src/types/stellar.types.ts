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
