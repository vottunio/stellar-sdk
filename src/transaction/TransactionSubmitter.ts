import { Horizon, TransactionBuilder } from '@stellar/stellar-sdk';

import { StellarError } from '../errors/StellarError';
import { ResolvedConfig } from '../types/config.types';
import { TransactionResult } from '../types/transaction.types';

/**
 * Submits signed transactions to the Stellar network with retry logic.
 * Retries on `tx_bad_seq` and timeout errors with exponential backoff.
 */
export class TransactionSubmitter {
  private readonly config: ResolvedConfig;

  constructor(config: ResolvedConfig) {
    this.config = config;
  }

  /** Submit a signed transaction XDR to the network. Retries on transient errors. */
  async submit(signedXdr: string): Promise<TransactionResult> {
    const server = new Horizon.Server(this.config.horizonUrl);
    const { maxAttempts, backoffMultiplier } = this.config.retry;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const tx = TransactionBuilder.fromXDR(signedXdr, this.config.networkPassphrase);
        const response = await server.submitTransaction(tx);

        return {
          hash: response.hash,
          ledger: response.ledger,
          successful: response.successful,
          resultXdr: response.result_xdr,
          envelopeXdr: response.envelope_xdr,
        };
      } catch (error: unknown) {
        lastError = error;

        if (!this.isRetryable(error) || attempt === maxAttempts) {
          break;
        }

        const delay = Math.pow(backoffMultiplier, attempt - 1) * 1000;
        await this.sleep(delay);
      }
    }

    throw this.normalizeError(lastError);
  }

  private isRetryable(error: unknown): boolean {
    if (error && typeof error === 'object' && 'response' in error) {
      const resp = error as { response?: { data?: { extras?: { result_codes?: { transaction?: string } } } } };
      const txCode = resp.response?.data?.extras?.result_codes?.transaction;
      return txCode === 'tx_bad_seq' || txCode === 'tx_too_late';
    }
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return msg.includes('timeout') || msg.includes('econnreset');
    }
    return false;
  }

  private normalizeError(error: unknown): StellarError {
    if (error instanceof StellarError) {
      return error;
    }

    if (error && typeof error === 'object' && 'response' in error) {
      const resp = error as { response?: { data?: { detail?: string; extras?: { result_codes?: { transaction?: string; operations?: string[] } } } } };
      const resultCodes = resp.response?.data?.extras?.result_codes;
      const txCode = resultCodes?.transaction ?? 'unknown';
      const opCodes = resultCodes?.operations ?? [];
      const detail = resp.response?.data?.detail ?? String(error);

      return new StellarError(
        `Transaction failed: ${txCode}`,
        `TX_${txCode.toUpperCase()}`,
        { transaction: txCode, operations: opCodes, detail },
      );
    }

    return new StellarError(
      `Transaction submission failed: ${String(error)}`,
      'TX_FAILED',
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
