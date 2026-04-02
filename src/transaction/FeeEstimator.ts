import { Horizon } from '@stellar/stellar-sdk';

import { ResolvedConfig } from '../types/config.types';
import { FeeEstimate } from '../types/transaction.types';

/**
 * Estimates transaction fees by querying the Stellar network.
 */
export class FeeEstimator {
  private readonly config: ResolvedConfig;

  constructor(config: ResolvedConfig) {
    this.config = config;
  }

  /** Estimate the fee for a transaction with the given number of operations. */
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
}
