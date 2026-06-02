/**
 * Memo types supported by Stellar.
 */
export type MemoType = 'text' | 'id' | 'hash' | 'return' | 'none';

/**
 * Memo specification for a transaction.
 */
export interface MemoSpec {
  type: MemoType;
  value?: string;
}

/**
 * Payment operation parameters.
 */
export interface PaymentParams {
  destination: string;
  asset: AssetSpec;
  amount: string;
}

/**
 * Create account operation parameters.
 */
export interface CreateAccountParams {
  destination: string;
  startingBalance: string;
}

/**
 * Change trust operation parameters.
 */
export interface ChangeTrustParams {
  asset: AssetSpec;
  limit?: string;
}

/**
 * Manage data operation parameters.
 */
export interface ManageDataParams {
  name: string;
  value?: string | Buffer;
}

/**
 * Path payment (strict send) operation parameters.
 */
export interface PathPaymentStrictSendParams {
  sendAsset: AssetSpec;
  sendAmount: string;
  destination: string;
  destAsset: AssetSpec;
  destMin: string;
  path?: AssetSpec[];
}

/**
 * Path payment (strict receive) operation parameters.
 */
export interface PathPaymentStrictReceiveParams {
  sendAsset: AssetSpec;
  sendMax: string;
  destination: string;
  destAsset: AssetSpec;
  destAmount: string;
  path?: AssetSpec[];
}

/**
 * Asset specification — either native XLM or a code+issuer pair.
 */
export interface AssetSpec {
  code: string;
  issuer?: string;
}

/**
 * Fee strategy for dynamic fee escalation based on network congestion.
 * - `low`: p10 percentile — cheap, may be slow during congestion
 * - `medium`: p50 percentile — balanced (default)
 * - `high`: p90 percentile — fast confirmation in moderate congestion
 * - `aggressive`: p99 percentile — near-guaranteed inclusion even under heavy load
 */
export type FeeStrategy = 'low' | 'medium' | 'high' | 'aggressive';

/**
 * Fee estimation result.
 */
export interface FeeEstimate {
  baseFee: string;
  estimatedFee: string;
  operationCount: number;
  /** The fee strategy used (if dynamic fee estimation was used). */
  strategy?: FeeStrategy;
  /** Network capacity usage at time of estimation (0.0 to 1.0). */
  capacityUsage?: number;
}

/**
 * Transaction submission result.
 */
export interface TransactionResult {
  hash: string;
  ledger: number;
  successful: boolean;
  resultXdr: string;
  envelopeXdr: string;
}

/**
 * Transaction status during polling.
 */
export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'not_found';

/**
 * Transaction confirmation from status tracking.
 */
export interface TransactionConfirmation {
  hash: string;
  status: TransactionStatus;
  ledger?: number;
  createdAt?: string;
}

/**
 * Transaction builder options.
 */
export interface TransactionBuilderOptions {
  sourceAccount: string;
  fee?: string;
  memo?: MemoSpec;
  timeoutSeconds?: number;
}
