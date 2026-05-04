import { Horizon } from '@stellar/stellar-sdk';

import { Logger } from '../config/Logger';
import { ResolvedConfig } from '../types/config.types';
import { FeeEstimate, FeeStrategy } from '../types/transaction.types';

/** Maps fee strategy to the fee_charged percentile field from Horizon /fee_stats. */
const STRATEGY_PERCENTILE: Record<FeeStrategy, string> = {
  low: 'p10',
  medium: 'p50',
  high: 'p90',
  aggressive: 'p99',
};

/**
 * Estimates transaction fees by querying the Stellar network.
 *
 * Supports two modes:
 * - **Basic** (`estimate`): Uses `fetchBaseFee()` — fast, suitable for testnet.
 * - **Dynamic** (`estimateDynamic`): Queries `/fee_stats` and selects a fee
 *   percentile based on a configurable strategy. Recommended for mainnet to
 *   handle network congestion gracefully.
 */
export class FeeEstimator {
  private readonly config: ResolvedConfig;
  private readonly logger: Logger;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.logger = new Logger(config.logging.level, 'FeeEstimator');
  }

  /** Basic fee estimate using `fetchBaseFee()`. */
  async estimate(operationCount = 1): Promise<FeeEstimate> {
    const server = new Horizon.Server(this.config.horizonUrl);
    const baseFee = await server.fetchBaseFee();
    const count = Math.max(operationCount, 1);

    return {
      baseFee: String(baseFee),
      estimatedFee: String(baseFee * count),
      operationCount: count,
    };
  }

  /**
   * Dynamic fee estimation using Horizon `/fee_stats` percentiles.
   *
   * Queries real-time network fee data and selects the appropriate percentile
   * based on the chosen strategy. The per-operation fee is then multiplied by
   * the operation count.
   *
   * @param operationCount - Number of operations in the transaction.
   * @param strategy - Fee strategy (`low`, `medium`, `high`, `aggressive`). Defaults to `medium`.
   * @returns Fee estimate with strategy metadata and network capacity usage.
   */
  async estimateDynamic(
    operationCount = 1,
    strategy: FeeStrategy = 'medium',
  ): Promise<FeeEstimate> {
    const server = new Horizon.Server(this.config.horizonUrl);
    const count = Math.max(operationCount, 1);

    const feeStats = await server.feeStats();
    const percentileKey = STRATEGY_PERCENTILE[strategy] as keyof typeof feeStats.fee_charged;
    const perOpFee = parseInt(feeStats.fee_charged[percentileKey], 10);
    const baseFee = parseInt(feeStats.last_ledger_base_fee, 10);
    const capacityUsage = parseFloat(feeStats.ledger_capacity_usage);

    // Ensure fee is at least the base fee
    const effectiveFee = Math.max(perOpFee, baseFee);

    this.logger.debug(
      `Fee estimate [${strategy}]: ${effectiveFee} stroops/op, ` +
      `capacity: ${(capacityUsage * 100).toFixed(1)}%, ` +
      `ops: ${count}`,
    );

    return {
      baseFee: String(baseFee),
      estimatedFee: String(effectiveFee * count),
      operationCount: count,
      strategy,
      capacityUsage,
    };
  }

  /**
   * Suggest the optimal fee strategy based on current network conditions.
   *
   * Returns `low` when the network is under-utilized (<25% capacity),
   * `medium` for normal load, `high` for congested, and `aggressive`
   * when the ledger is near-full (>90%).
   */
  async suggestStrategy(): Promise<{ strategy: FeeStrategy; capacityUsage: number }> {
    const server = new Horizon.Server(this.config.horizonUrl);
    const feeStats = await server.feeStats();
    const capacityUsage = parseFloat(feeStats.ledger_capacity_usage);

    let strategy: FeeStrategy;
    if (capacityUsage < 0.25) {
      strategy = 'low';
    } else if (capacityUsage < 0.5) {
      strategy = 'medium';
    } else if (capacityUsage < 0.9) {
      strategy = 'high';
    } else {
      strategy = 'aggressive';
    }

    this.logger.debug(
      `Suggested strategy: ${strategy} (capacity: ${(capacityUsage * 100).toFixed(1)}%)`,
    );

    return { strategy, capacityUsage };
  }
}
