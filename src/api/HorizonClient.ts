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

/** Horizon effect response. */
export interface HorizonEffect {
  id: string;
  type: string;
  type_i: number;
  created_at: string;
  account: string;
  [key: string]: unknown;
}

/** Horizon ledger response. */
export interface HorizonLedger {
  id: string;
  sequence: number;
  hash: string;
  prev_hash: string;
  closed_at: string;
  transaction_count: number;
  successful_transaction_count: number;
  failed_transaction_count: number;
  operation_count: number;
  base_fee_in_stroops: number;
  base_reserve_in_stroops: number;
  max_tx_set_size: number;
  protocol_version: number;
  total_coins: string;
  fee_pool: string;
}

/** Horizon asset response. */
export interface HorizonAsset {
  asset_type: string;
  asset_code: string;
  asset_issuer: string;
  amount: string;
  num_accounts: number;
  flags: {
    auth_required: boolean;
    auth_revocable: boolean;
    auth_immutable: boolean;
    auth_clawback_enabled: boolean;
  };
}

/** Horizon order book response. */
export interface HorizonOrderBook {
  bids: HorizonOrderBookEntry[];
  asks: HorizonOrderBookEntry[];
  base: { asset_type: string; asset_code?: string; asset_issuer?: string };
  counter: { asset_type: string; asset_code?: string; asset_issuer?: string };
}

export interface HorizonOrderBookEntry {
  price: string;
  price_r: { n: number; d: number };
  amount: string;
}

/** Horizon trade aggregation response. */
export interface HorizonTradeAggregation {
  timestamp: string;
  trade_count: string;
  base_volume: string;
  counter_volume: string;
  avg: string;
  high: string;
  high_r: { n: number; d: number };
  low: string;
  low_r: { n: number; d: number };
  open: string;
  open_r: { n: number; d: number };
  close: string;
  close_r: { n: number; d: number };
}

/** Horizon fee stats response. */
export interface HorizonFeeStats {
  last_ledger: string;
  last_ledger_base_fee: string;
  ledger_capacity_usage: string;
  fee_charged: {
    max: string;
    min: string;
    mode: string;
    p10: string;
    p20: string;
    p30: string;
    p40: string;
    p50: string;
    p60: string;
    p70: string;
    p80: string;
    p90: string;
    p95: string;
    p99: string;
  };
  max_fee: {
    max: string;
    min: string;
    mode: string;
    p10: string;
    p20: string;
    p30: string;
    p40: string;
    p50: string;
    p60: string;
    p70: string;
    p80: string;
    p90: string;
    p95: string;
    p99: string;
  };
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

export interface GetEffectsParams extends PaginationParams {
  /** Filter by account public key. */
  account?: string;
}

export interface GetAssetsParams extends PaginationParams {
  /** Filter by asset code. */
  asset_code?: string;
  /** Filter by asset issuer. */
  asset_issuer?: string;
}

export interface GetOrderBookParams {
  /** Selling asset. Use 'native' for XLM or provide code:issuer. */
  selling_asset_type: string;
  selling_asset_code?: string;
  selling_asset_issuer?: string;
  /** Buying asset. */
  buying_asset_type: string;
  buying_asset_code?: string;
  buying_asset_issuer?: string;
  /** Number of offers to include (default 20). */
  limit?: number;
}

export interface GetTradeAggregationsParams {
  /** Base asset. */
  base_asset_type: string;
  base_asset_code?: string;
  base_asset_issuer?: string;
  /** Counter asset. */
  counter_asset_type: string;
  counter_asset_code?: string;
  counter_asset_issuer?: string;
  /** Resolution in milliseconds (e.g. 60000 for 1 minute). */
  resolution: number;
  /** Start time as Unix timestamp in ms. */
  start_time?: number;
  /** End time as Unix timestamp in ms. */
  end_time?: number;
  /** Offset in ms (for partial-hour resolutions). */
  offset?: number;
  order?: 'asc' | 'desc';
  limit?: number;
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

  // ─── 2.3.7: Effects ──────────────────────────────────────────────────────

  /**
   * List effects, optionally filtered by account.
   * @param params - Query parameters.
   * @returns Paginated list of effects.
   */
  async getEffects(
    params?: GetEffectsParams,
  ): Promise<ApiResponse<HorizonEffect[]>> {
    const limit = params?.limit ?? DEFAULT_LIMIT;
    const order = params?.order ?? DEFAULT_ORDER;

    const path = params?.account
      ? `/accounts/${params.account}/effects`
      : '/effects';

    const query: Record<string, unknown> = { limit, order };
    if (params?.cursor) query.cursor = params.cursor;

    this.logger.debug(`Getting effects: ${path}`);
    const response = await this.client.get<HorizonCollectionResponse>(path, query);
    return ResponseMapper.collection<HorizonEffect>(response.data, limit, order);
  }

  // ─── 2.3.8: Ledgers ─────────────────────────────────────────────────────

  /**
   * Get a specific ledger by sequence number, or the latest ledger.
   * @param sequence - Ledger sequence number (omit for latest).
   * @returns Ledger information.
   */
  async getLedger(sequence?: number): Promise<ApiResponse<HorizonLedger>> {
    const path = sequence !== undefined ? `/ledgers/${sequence}` : '/ledgers';

    if (sequence !== undefined) {
      this.logger.debug(`Getting ledger: ${sequence}`);
      const response = await this.client.get<HorizonLedger>(path);
      return ResponseMapper.single(response.data);
    }

    // No sequence — fetch latest (first record from descending list)
    this.logger.debug('Getting latest ledger');
    const response = await this.client.get<HorizonCollectionResponse>(path, {
      limit: 1,
      order: 'desc',
    });
    const records = response.data._embedded?.records ?? [];
    return ResponseMapper.single(records[0] as HorizonLedger);
  }

  // ─── 2.3.9: Assets ──────────────────────────────────────────────────────

  /**
   * List Stellar assets, optionally filtered by code and/or issuer.
   * @param params - Query parameters.
   * @returns Paginated list of assets.
   */
  async getAssets(
    params?: GetAssetsParams,
  ): Promise<ApiResponse<HorizonAsset[]>> {
    const limit = params?.limit ?? DEFAULT_LIMIT;
    const order = params?.order ?? DEFAULT_ORDER;

    const query: Record<string, unknown> = { limit, order };
    if (params?.cursor) query.cursor = params.cursor;
    if (params?.asset_code) query.asset_code = params.asset_code;
    if (params?.asset_issuer) query.asset_issuer = params.asset_issuer;

    this.logger.debug('Getting assets');
    const response = await this.client.get<HorizonCollectionResponse>('/assets', query);
    return ResponseMapper.collection<HorizonAsset>(response.data, limit, order);
  }

  // ─── 2.3.10: Order Book ──────────────────────────────────────────────────

  /**
   * Get the order book for a trading pair.
   * @param params - Selling and buying asset parameters.
   * @returns Order book with bids and asks.
   */
  async getOrderBook(params: GetOrderBookParams): Promise<ApiResponse<HorizonOrderBook>> {
    const query: Record<string, unknown> = {
      selling_asset_type: params.selling_asset_type,
      buying_asset_type: params.buying_asset_type,
      limit: params.limit ?? 20,
    };
    if (params.selling_asset_code) query.selling_asset_code = params.selling_asset_code;
    if (params.selling_asset_issuer) query.selling_asset_issuer = params.selling_asset_issuer;
    if (params.buying_asset_code) query.buying_asset_code = params.buying_asset_code;
    if (params.buying_asset_issuer) query.buying_asset_issuer = params.buying_asset_issuer;

    this.logger.debug('Getting order book');
    const response = await this.client.get<HorizonOrderBook>('/order_book', query);
    return ResponseMapper.single(response.data);
  }

  // ─── 2.3.11: Trade Aggregations ──────────────────────────────────────────

  /**
   * Get trade aggregation (OHLC) data for a trading pair.
   * @param params - Base/counter assets, resolution, and time range.
   * @returns Paginated list of trade aggregation candles.
   */
  async getTradeAggregations(
    params: GetTradeAggregationsParams,
  ): Promise<ApiResponse<HorizonTradeAggregation[]>> {
    const limit = params.limit ?? DEFAULT_LIMIT;
    const order = params.order ?? DEFAULT_ORDER;

    const query: Record<string, unknown> = {
      base_asset_type: params.base_asset_type,
      counter_asset_type: params.counter_asset_type,
      resolution: params.resolution,
      limit,
      order,
    };
    if (params.base_asset_code) query.base_asset_code = params.base_asset_code;
    if (params.base_asset_issuer) query.base_asset_issuer = params.base_asset_issuer;
    if (params.counter_asset_code) query.counter_asset_code = params.counter_asset_code;
    if (params.counter_asset_issuer) query.counter_asset_issuer = params.counter_asset_issuer;
    if (params.start_time !== undefined) query.start_time = params.start_time;
    if (params.end_time !== undefined) query.end_time = params.end_time;
    if (params.offset !== undefined) query.offset = params.offset;

    this.logger.debug('Getting trade aggregations');
    const response = await this.client.get<HorizonCollectionResponse>(
      '/trade_aggregations',
      query,
    );
    return ResponseMapper.collection<HorizonTradeAggregation>(response.data, limit, order);
  }

  // ─── 2.3.12: Fee Stats ───────────────────────────────────────────────────

  /**
   * Get network fee statistics (percentiles for charged and max fees).
   * @returns Fee stats including p10-p99 percentiles.
   */
  async getFeeStats(): Promise<ApiResponse<HorizonFeeStats>> {
    this.logger.debug('Getting fee stats');
    const response = await this.client.get<HorizonFeeStats>('/fee_stats');
    return ResponseMapper.single(response.data);
  }
}
