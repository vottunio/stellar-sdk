import { Logger } from '../config/Logger';
import { ApiResponse } from '../types/api.types';
import { ResolvedConfig } from '../types/config.types';

import { ApiClient } from './ApiClient';
import { ResponseMapper } from './ResponseMapper';

// ─── Soroban RPC Response Types ─────────────────────────────────────────────

/** Soroban getHealth response. */
export interface SorobanHealth {
  status: string;
  latestLedger: number;
  oldestLedger: number;
  ledgerRetentionWindow: number;
}

/** Soroban getTransaction response. */
export interface SorobanTransaction {
  status: 'SUCCESS' | 'NOT_FOUND' | 'FAILED';
  latestLedger: number;
  latestLedgerCloseTime: string;
  oldestLedger: number;
  oldestLedgerCloseTime: string;
  ledger?: number;
  createdAt?: string;
  applicationOrder?: number;
  feeBump?: boolean;
  envelopeXdr?: string;
  resultXdr?: string;
  resultMetaXdr?: string;
  returnValue?: string;
}

/** Soroban event entry. */
export interface SorobanEvent {
  type: string;
  ledger: number;
  ledgerClosedAt: string;
  contractId: string;
  id: string;
  pagingToken: string;
  topic: string[];
  value: string;
  inSuccessfulContractCall: boolean;
}

/** Soroban getEvents response. */
export interface SorobanEventsResponse {
  events: SorobanEvent[];
  latestLedger: number;
}

/** Soroban ledger entry. */
export interface SorobanLedgerEntry {
  key: string;
  xdr: string;
  lastModifiedLedgerSeq: number;
  liveUntilLedgerSeq?: number;
}

/** Soroban getLedgerEntries response. */
export interface SorobanLedgerEntriesResponse {
  entries: SorobanLedgerEntry[];
  latestLedger: number;
}

/** Soroban getNetwork response. */
export interface SorobanNetwork {
  friendbotUrl?: string;
  passphrase: string;
  protocolVersion: number;
}

// ─── Soroban RPC Request Types ──────────────────────────────────────────────

/** Filter for getEvents. */
export interface SorobanEventFilter {
  type?: 'contract' | 'system' | 'diagnostic';
  contractIds?: string[];
  topics?: string[][];
}

export interface GetEventsParams {
  startLedger: number;
  filters?: SorobanEventFilter[];
  pagination?: { limit?: number; cursor?: string };
}

// ─── JSON-RPC Helpers ───────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * Soroban JSON-RPC client. Wraps Soroban RPC endpoints with
 * standardized `ApiResponse<T>` responses.
 *
 * Accessed via `sdk.api.soroban`.
 *
 * @example
 * ```typescript
 * const soroban = new SorobanRpcClient(config);
 *
 * const health = await soroban.getHealth();
 * console.log(health.data.status); // "healthy"
 *
 * const tx = await soroban.getTransaction('abc123...');
 * console.log(tx.data.status); // "SUCCESS" | "FAILED" | "NOT_FOUND"
 * ```
 */
export class SorobanRpcClient {
  private readonly client: ApiClient;
  private readonly logger: Logger;
  private requestId = 0;

  constructor(config: ResolvedConfig) {
    this.client = new ApiClient(config, config.sorobanRpcUrl, config.timeout.api);
    this.logger = new Logger(config.logging.level, 'SorobanRpcClient');
  }

  // ─── 2.3.13: getHealth ───────────────────────────────────────────────────

  /**
   * Check the health status of the Soroban RPC node.
   * @returns Node health status including latest/oldest ledger.
   */
  async getHealth(): Promise<ApiResponse<SorobanHealth>> {
    this.logger.debug('Getting Soroban health');
    const result = await this.rpcCall<SorobanHealth>('getHealth');
    return ResponseMapper.single(result);
  }

  // ─── 2.3.14: getTransaction ──────────────────────────────────────────────

  /**
   * Get a Soroban transaction status and result by hash.
   * @param hash - Transaction hash.
   * @returns Transaction status (SUCCESS, FAILED, NOT_FOUND) and result data.
   */
  async getTransaction(hash: string): Promise<ApiResponse<SorobanTransaction>> {
    this.logger.debug(`Getting Soroban transaction: ${hash}`);
    const result = await this.rpcCall<SorobanTransaction>('getTransaction', { hash });
    return ResponseMapper.single(result);
  }

  // ─── 2.3.15: getEvents ──────────────────────────────────────────────────

  /**
   * Query Soroban contract events.
   * @param params - Start ledger, optional filters, and pagination.
   * @returns List of matching events.
   */
  async getEvents(params: GetEventsParams): Promise<ApiResponse<SorobanEventsResponse>> {
    this.logger.debug(`Getting Soroban events from ledger ${params.startLedger}`);

    const rpcParams: Record<string, unknown> = {
      startLedger: params.startLedger,
    };
    if (params.filters && params.filters.length > 0) {
      rpcParams.filters = params.filters;
    }
    if (params.pagination) {
      rpcParams.pagination = params.pagination;
    }

    const result = await this.rpcCall<SorobanEventsResponse>('getEvents', rpcParams);
    return ResponseMapper.single(result);
  }

  // ─── 2.3.16: getLedgerEntries ────────────────────────────────────────────

  /**
   * Read ledger entries (contract data, account state) by their XDR keys.
   * @param keys - Array of base64-encoded XDR ledger entry keys.
   * @returns Matching ledger entries with their current values.
   */
  async getLedgerEntries(keys: string[]): Promise<ApiResponse<SorobanLedgerEntriesResponse>> {
    this.logger.debug(`Getting ${keys.length} ledger entries`);
    const result = await this.rpcCall<SorobanLedgerEntriesResponse>('getLedgerEntries', {
      keys,
    });
    return ResponseMapper.single(result);
  }

  // ─── 2.3.17: getNetwork ─────────────────────────────────────────────────

  /**
   * Get the network configuration (passphrase and protocol version).
   * @returns Network passphrase and protocol version.
   */
  async getNetwork(): Promise<ApiResponse<SorobanNetwork>> {
    this.logger.debug('Getting Soroban network info');
    const result = await this.rpcCall<SorobanNetwork>('getNetwork');
    return ResponseMapper.single(result);
  }

  // ─── JSON-RPC Call Helper ────────────────────────────────────────────────

  private async rpcCall<T>(method: string, params?: unknown): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
    };
    if (params !== undefined) {
      request.params = params;
    }

    const response = await this.client.post<JsonRpcResponse<T>>('/', request);
    const body = response.data;

    if (body.error) {
      throw new Error(
        `Soroban RPC error (${body.error.code}): ${body.error.message}`,
      );
    }

    if (body.result === undefined) {
      throw new Error(`Soroban RPC returned no result for method: ${method}`);
    }

    return body.result;
  }
}
