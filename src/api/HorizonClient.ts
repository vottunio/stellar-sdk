import { Logger } from '../config/Logger';
import { ResolvedConfig } from '../types/config.types';
import { ApiResponse, PaginationParams } from '../types/api.types';

import { ApiClient } from './ApiClient';
import { ResponseMapper, HorizonCollectionResponse } from './ResponseMapper';

// ─── Horizon Response Types ─────────────────────────────────────────────────

/** Horizon account response. */
export interface HorizonAccount {
  id: string;
  account_id: string;
  sequence: string;
  subentry_count: number;
  last_modified_ledger: number;
  balances: HorizonBalance[];
  signers: HorizonSigner[];
  thresholds: { low_threshold: number; med_threshold: number; high_threshold: number };
  flags: { auth_required: boolean; auth_revocable: boolean; auth_immutable: boolean; auth_clawback_enabled: boolean };
  data: Record<string, string>;
}

export interface HorizonBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
  buying_liabilities?: string;
  selling_liabilities?: string;
}

export interface HorizonSigner {
  key: string;
  weight: number;
  type: string;
}

/** Horizon transaction response. */
export interface HorizonTransaction {
  id: string;
  hash: string;
  ledger: number;
  created_at: string;
  source_account: string;
  source_account_sequence: string;
  fee_charged: string;
  max_fee: string;
  operation_count: number;
  memo_type: string;
  memo?: string;
  successful: boolean;
  envelope_xdr: string;
  result_xdr: string;
  fee_meta_xdr: string;
}

/** Horizon operation response. */
export interface HorizonOperation {
  id: string;
  type: string;
  type_i: number;
  created_at: string;
  transaction_hash: string;
  source_account: string;
  [key: string]: unknown;
}

/** Horizon payment operation response. */
export interface HorizonPayment {
  id: string;
  type: string;
  type_i: number;
  created_at: string;
  transaction_hash: string;
  source_account: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  from: string;
  to: string;
  amount: string;
}

// ─── Query Parameter Types ──────────────────────────────────────────────────

export interface GetTransactionsParams extends PaginationParams {
  /** Filter by account public key. */
  account?: string;
}

export interface GetOperationsParams extends PaginationParams {
  /** Filter by account public key. */
  account?: string;
  /** Filter by transaction hash. */
  transaction?: string;
}

export interface GetPaymentsParams extends PaginationParams {
  /** Filter by account public key. */
  account?: string;
}

// ─── Default Values ─────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 10;
const DEFAULT_ORDER: 'asc' | 'desc' = 'desc';

/**
 * Horizon REST API client. Wraps Stellar Horizon endpoints with
 * standardized `ApiResponse<T>` responses and typed error handling.
 *
 * Accessed via `sdk.api.horizon`.
 *
 * @example
 * ```typescript
 * const horizon = new HorizonClient(config);
 *
 * // Get account info
 * const account = await horizon.getAccount('G...');
 *
 * // List transactions with pagination
 * const txs = await horizon.getTransactions({ account: 'G...', limit: 5 });
 * console.log(txs.pagination?.cursor); // cursor for next page
 * ```
 */
export class HorizonClient {
  private readonly client: ApiClient;
  private readonly logger: Logger;

  constructor(config: ResolvedConfig) {
    this.client = new ApiClient(config, config.horizonUrl, config.timeout.horizon);
    this.logger = new Logger(config.logging.level, 'HorizonClient');
  }

  // ─── 2.3.2: Accounts ─────────────────────────────────────────────────────

  /**
   * Get a Stellar account by address.
   * @param address - Stellar public key (G...).
   * @returns Account data including balances, signers, thresholds, flags, data.
   */
  async getAccount(address: string): Promise<ApiResponse<HorizonAccount>> {
    this.logger.debug(`Getting account: ${address}`);
    const response = await this.client.get<HorizonAccount>(`/accounts/${address}`);
    return ResponseMapper.single(response.data);
  }

  // ─── 2.3.3: Transactions (list) ──────────────────────────────────────────

  /**
   * List transactions, optionally filtered by account.
   * @param params - Query parameters (account, cursor, limit, order).
   * @returns Paginated list of transactions.
   */
  async getTransactions(
    params?: GetTransactionsParams,
  ): Promise<ApiResponse<HorizonTransaction[]>> {
    const limit = params?.limit ?? DEFAULT_LIMIT;
    const order = params?.order ?? DEFAULT_ORDER;

    const path = params?.account
      ? `/accounts/${params.account}/transactions`
      : '/transactions';

    const query: Record<string, unknown> = { limit, order };
    if (params?.cursor) query.cursor = params.cursor;

    this.logger.debug(`Getting transactions: ${path}`);
    const response = await this.client.get<HorizonCollectionResponse>(path, query);
    return ResponseMapper.collection<HorizonTransaction>(response.data, limit, order);
  }

  // ─── 2.3.4: Single Transaction ────────────────────────────────────────────

  /**
   * Get a single transaction by hash.
   * @param hash - Transaction hash.
   * @returns Full transaction details.
   */
  async getTransaction(hash: string): Promise<ApiResponse<HorizonTransaction>> {
    this.logger.debug(`Getting transaction: ${hash}`);
    const response = await this.client.get<HorizonTransaction>(`/transactions/${hash}`);
    return ResponseMapper.single(response.data);
  }

  // ─── 2.3.5: Operations ────────────────────────────────────────────────────

  /**
   * List operations, optionally filtered by account or transaction.
   * @param params - Query parameters.
   * @returns Paginated list of operations.
   */
  async getOperations(
    params?: GetOperationsParams,
  ): Promise<ApiResponse<HorizonOperation[]>> {
    const limit = params?.limit ?? DEFAULT_LIMIT;
    const order = params?.order ?? DEFAULT_ORDER;

    let path: string;
    if (params?.transaction) {
      path = `/transactions/${params.transaction}/operations`;
    } else if (params?.account) {
      path = `/accounts/${params.account}/operations`;
    } else {
      path = '/operations';
    }

    const query: Record<string, unknown> = { limit, order };
    if (params?.cursor) query.cursor = params.cursor;

    this.logger.debug(`Getting operations: ${path}`);
    const response = await this.client.get<HorizonCollectionResponse>(path, query);
    return ResponseMapper.collection<HorizonOperation>(response.data, limit, order);
  }

  // ─── 2.3.6: Payments ─────────────────────────────────────────────────────

  /**
   * List payment operations, optionally filtered by account.
   * @param params - Query parameters.
   * @returns Paginated list of payment operations.
   */
  async getPayments(
    params?: GetPaymentsParams,
  ): Promise<ApiResponse<HorizonPayment[]>> {
    const limit = params?.limit ?? DEFAULT_LIMIT;
    const order = params?.order ?? DEFAULT_ORDER;

    const path = params?.account
      ? `/accounts/${params.account}/payments`
      : '/payments';

    const query: Record<string, unknown> = { limit, order };
    if (params?.cursor) query.cursor = params.cursor;

    this.logger.debug(`Getting payments: ${path}`);
    const response = await this.client.get<HorizonCollectionResponse>(path, query);
    return ResponseMapper.collection<HorizonPayment>(response.data, limit, order);
  }
}
