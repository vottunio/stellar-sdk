import { Horizon } from '@stellar/stellar-sdk';

import { StellarError } from '../errors/StellarError';
import { ResolvedConfig } from '../types/config.types';
import { TransactionConfirmation, TransactionStatus } from '../types/transaction.types';

/**
 * Tracks a submitted transaction's status by polling Horizon.
 */
export class TransactionTracker {
  private readonly config: ResolvedConfig;

  constructor(config: ResolvedConfig) {
    this.config = config;
  }

  /** Poll for transaction confirmation until it's confirmed or failed. */
  async waitForConfirmation(
    hash: string,
    options?: { maxAttempts?: number; intervalMs?: number },
  ): Promise<TransactionConfirmation> {
    const maxAttempts = options?.maxAttempts ?? 30;
    const intervalMs = options?.intervalMs ?? 2000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const status = await this.getStatus(hash);

      if (status.status === 'confirmed' || status.status === 'failed') {
        return status;
      }

      if (attempt < maxAttempts) {
        await this.sleep(intervalMs);
      }
    }

    throw new StellarError(
      `Transaction ${hash} not confirmed after ${maxAttempts} attempts`,
      'TX_CONFIRMATION_TIMEOUT',
      { hash, maxAttempts },
    );
  }

  /** Get the current status of a transaction. */
  async getStatus(hash: string): Promise<TransactionConfirmation> {
    const server = new Horizon.Server(this.config.horizonUrl);

    try {
      const tx = await server.transactions().transaction(hash).call();

      const status: TransactionStatus = tx.successful ? 'confirmed' : 'failed';
      return {
        hash: tx.hash,
        status,
        ledger: tx.ledger_attr,
        createdAt: tx.created_at,
      };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const resp = error as { response?: { status?: number } };
        if (resp.response?.status === 404) {
          return { hash, status: 'not_found' };
        }
      }
      return { hash, status: 'pending' };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
