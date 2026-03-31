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
 * Fee estimation result.
 */
export interface FeeEstimate {
  baseFee: string;
  estimatedFee: string;
  operationCount: number;
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
