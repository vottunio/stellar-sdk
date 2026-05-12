import { Horizon, TransactionBuilder } from '@stellar/stellar-sdk';

import { Logger } from '../config/Logger';
import { StellarError } from '../errors/StellarError';
import { getErrorMessage } from '../errors/utils';
import { ResolvedConfig } from '../types/config.types';
import { TransactionResult } from '../types/transaction.types';

/**
 * Submits signed transactions to the Stellar network with idempotency-safe retry logic.
 *
 * **Retry policy (3.1.7 production-hardened):**
 * - **Retried** (transient): network errors, timeouts, 5xx server errors
 * - **NOT retried** (deterministic failures): `tx_bad_seq`, `tx_too_late`,
 *   `tx_insufficient_balance`, validation errors. Re-submitting the same
 *   signed XDR with these codes will fail the same way — the caller must
 *   rebuild the transaction with a fresh sequence number / fee / etc.
 *
 * **Idempotency:** On retry, the submitter first checks whether the transaction
 * already landed in a ledger (via `getTransaction(hash)`). Stellar deduplicates
 * by transaction hash, so resubmission of an already-confirmed tx is safe — but
 * skipping the network round-trip is faster and avoids spurious errors.
 *
 * **Backoff:** Exponential with full jitter to prevent thundering-herd retries
 * after a Horizon hiccup.
 */
export class TransactionSubmitter {
  private readonly config: ResolvedConfig;
  private readonly logger: Logger;

  /** Transaction result codes that are deterministic — never retry these. */
  private static readonly NON_RETRYABLE_TX_CODES = new Set([
    'tx_bad_seq',
    'tx_too_late',
    'tx_too_early',
    'tx_missing_operation',
    'tx_bad_auth',
    'tx_bad_auth_extra',
    'tx_insufficient_balance',
    'tx_insufficient_fee',
    'tx_no_source_account',
    'tx_malformed',
  ]);

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.logger = new Logger(config.logging.level, 'TransactionSubmitter');
  }

  /** Submit a signed transaction XDR to the network. Retries on transient errors only. */
  async submit(signedXdr: string): Promise<TransactionResult> {
    const server = new Horizon.Server(this.config.horizonUrl);
    const { maxAttempts, backoffMultiplier } = this.config.retry;

    // Derive the transaction hash once, so retries can perform idempotency checks
    // (avoids re-parsing the XDR each attempt).
    const tx = TransactionBuilder.fromXDR(signedXdr, this.config.networkPassphrase);
    const expectedHash = tx.hash().toString('hex');

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Idempotency check on retry attempts: if a prior attempt landed, return it.
      if (attempt > 1) {
        const existing = await this.lookupTransaction(server, expectedHash);
        if (existing) {
          this.logger.info(
            `Transaction ${expectedHash} already confirmed on retry attempt ${attempt}`,
          );
          return existing;
        }
      }

      try {
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

        const delay = this.computeBackoff(attempt, backoffMultiplier);
        this.logger.debug(
          `Submission attempt ${attempt}/${maxAttempts} failed (transient), ` +
          `retrying in ${delay}ms`,
        );
        await this.sleep(delay);
      }
    }

    throw this.normalizeError(lastError);
  }

  /**
   * Check whether a transaction with the given hash has already been confirmed.
   * Returns the result if found, null otherwise. Used for idempotency on retry.
   */
  private async lookupTransaction(
    server: Horizon.Server,
    hash: string,
  ): Promise<TransactionResult | null> {
    try {
      const tx = await server.transactions().transaction(hash).call();
      return {
        hash: tx.hash,
        ledger: tx.ledger_attr,
        successful: tx.successful,
        resultXdr: tx.result_xdr,
        envelopeXdr: tx.envelope_xdr,
      };
    } catch {
      // 404 expected if not yet on-chain — fall through
      return null;
    }
  }

  /**
   * Determine whether an error is transient (worth retrying) or deterministic.
   *
   * - HTTP-level errors: retry on network, timeout, 5xx
   * - Stellar tx errors: never retry — re-submitting the same XDR is futile
   */
  private isRetryable(error: unknown): boolean {
    // Stellar transaction errors arrive with a structured `extras.result_codes`.
    // These are deterministic — re-submitting the same XDR will fail identically.
    if (error && typeof error === 'object' && 'response' in error) {
      const resp = error as {
        response?: {
          status?: number;
          data?: { extras?: { result_codes?: { transaction?: string } } };
        };
      };
      const txCode = resp.response?.data?.extras?.result_codes?.transaction;
      if (txCode && TransactionSubmitter.NON_RETRYABLE_TX_CODES.has(txCode)) {
        return false;
      }
      // 5xx server errors are transient
      const status = resp.response?.status;
      if (status !== undefined && status >= 500 && status < 600) {
        return true;
      }
      // 429 rate limited is retryable
      if (status === 429) {
        return true;
      }
      // 4xx (other than 429) — deterministic client error
      if (status !== undefined && status >= 400 && status < 500) {
        return false;
      }
    }

    // Network-level errors (no response): timeout, ECONNRESET, etc.
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('timeout') ||
        msg.includes('econnreset') ||
        msg.includes('econnaborted') ||
        msg.includes('socket hang up') ||
        msg.includes('network error')
      );
    }

    return false;
  }

  /**
   * Compute backoff delay with full jitter.
   *
   * Full jitter (delay ∈ [0, base * multiplier^attempt]) prevents the
   * thundering-herd problem when many clients retry simultaneously after
   * a brief Horizon outage.
   *
   * Capped at 30 seconds to bound worst-case retry latency.
   */
  private computeBackoff(attempt: number, multiplier: number): number {
    const base = 1000;
    const max = Math.min(Math.pow(multiplier, attempt - 1) * base, 30_000);
    // Full jitter: uniform random in [0, max]
    return Math.floor(Math.random() * max);
  }

  private normalizeError(error: unknown): StellarError {
    if (error instanceof StellarError) {
      return error;
    }

    if (error && typeof error === 'object' && 'response' in error) {
      const resp = error as {
        response?: {
          data?: {
            detail?: string;
            extras?: {
              result_codes?: { transaction?: string; operations?: string[] };
            };
          };
        };
      };
      const resultCodes = resp.response?.data?.extras?.result_codes;
      const txCode = resultCodes?.transaction ?? 'unknown';
      const opCodes = resultCodes?.operations ?? [];
      const detail = resp.response?.data?.detail ?? getErrorMessage(error);

      return new StellarError(
        `Transaction failed: ${txCode}`,
        `TX_${txCode.toUpperCase()}`,
        { transaction: txCode, operations: opCodes, detail },
      );
    }

    return new StellarError(
      `Transaction submission failed: ${getErrorMessage(error)}`,
      'TX_FAILED',
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
