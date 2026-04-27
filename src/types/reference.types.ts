import { TransactionResult } from './transaction.types';

/**
 * Supported settlement asset types.
 */
export type SettlementAsset = 'XLM' | 'USDC' | 'EURC';

/**
 * Well-known asset issuers per network.
 */
export const ASSET_ISSUERS: Record<'testnet' | 'mainnet', Record<string, string>> = {
  testnet: {
    USDC: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    EURC: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  },
  mainnet: {
    USDC: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    EURC: 'GDHU26QVJGZL7SXLEEC6PDB5UDDASLZSYXLN55YTIJAXHL6JRZA7W3NT',
  },
};

/**
 * Parameters for creating a settlement flow.
 */
export interface SettlementParams {
  /** The asset to settle in — 'XLM', 'USDC', or 'EURC'. */
  asset: SettlementAsset;
  /** Amount to send (as a string, e.g. '100.50'). */
  amount: string;
  /** Destination Stellar public key (G...). */
  destination: string;
  /** Optional memo to attach to the settlement transaction. */
  memo?: { type: 'text' | 'id' | 'hash' | 'return'; value: string };
  /**
   * Custom asset issuer — override the well-known issuer for the asset.
   * Only applies to non-native assets (USDC, EURC).
   */
  issuer?: string;
}

/**
 * Status of a settlement step.
 */
export type SettlementStepStatus = 'pending' | 'skipped' | 'success' | 'failed';

/**
 * A single step in the settlement flow.
 */
export interface SettlementStep {
  /** Step name. */
  name: string;
  /** Current status. */
  status: SettlementStepStatus;
  /** Transaction hash if the step submitted a transaction. */
  hash?: string;
  /** Error message if the step failed. */
  error?: string;
  /** Duration of the step in milliseconds. */
  durationMs?: number;
}

/**
 * Result of a complete settlement flow.
 */
export interface SettlementResult {
  /** Whether the settlement completed successfully. */
  successful: boolean;
  /** The settlement transaction result (from the payment step). */
  transaction?: TransactionResult;
  /** Ordered list of steps executed during the settlement. */
  steps: SettlementStep[];
  /** Total duration of the settlement flow in milliseconds. */
  totalDurationMs: number;
}
