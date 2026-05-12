import {
  Horizon,
  TransactionBuilder,
  Memo,
  Operation,
} from '@stellar/stellar-sdk';

import { StellarError } from '../errors/StellarError';
import { ResolvedConfig } from '../types/config.types';
import { StellarOperationErrorCode } from '../types/stellar.types';
import { TransactionResult } from '../types/transaction.types';
import { Wallet } from '../types/wallet.types';

import { TransactionSubmitter } from '../transaction/TransactionSubmitter';

type StellarOperation = ReturnType<typeof Operation.payment>;

/**
 * Shared helper for building, signing, and submitting Stellar transactions.
 * Used internally by AccountService, AssetService, and PaymentService.
 */
export class TransactionHelper {
  private readonly config: ResolvedConfig;

  constructor(config: ResolvedConfig) {
    this.config = config;
  }

  /**
   * Build, sign, and submit a transaction with one or more operations.
   *
   * @param sourceAccount - The source account public key.
   * @param operations - Array of Stellar operations.
   * @param wallet - Wallet to sign the transaction.
   * @param options - Optional fee and memo.
   * @returns Transaction result from submission.
   */
  async buildSignSubmit(
    sourceAccount: string,
    operations: StellarOperation[],
    wallet: Wallet,
    options?: { fee?: string; memo?: { type: 'text' | 'id' | 'hash' | 'return'; value: string } },
  ): Promise<TransactionResult> {
    const server = new Horizon.Server(this.config.horizonUrl);

    try {
      const account = await server.loadAccount(sourceAccount);
      const fee = options?.fee ?? String(await server.fetchBaseFee());

      const builder = new TransactionBuilder(account, {
        fee,
        networkPassphrase: this.config.networkPassphrase,
      });

      for (const op of operations) {
        builder.addOperation(op);
      }

      if (options?.memo) {
        builder.addMemo(this.resolveMemo(options.memo));
      }

      builder.setTimeout(180);
      const tx = builder.build();

      const signedXdr = await wallet.sign(tx.toXDR(), this.config.networkPassphrase);

      const submitter = new TransactionSubmitter(this.config);
      return await submitter.submit(signedXdr);
    } catch (error) {
      if (error instanceof StellarError) throw error;
      throw new StellarError(
        `Transaction failed: ${(error as Error).message}`,
        StellarOperationErrorCode.BUILD_FAILED,
        { sourceAccount },
      );
    }
  }

  private resolveMemo(memo: { type: 'text' | 'id' | 'hash' | 'return'; value: string }): Memo {
    switch (memo.type) {
      case 'text':
        return Memo.text(memo.value);
      case 'id':
        return Memo.id(memo.value);
      case 'hash':
        return Memo.hash(memo.value);
      case 'return':
        return Memo.return(memo.value);
    }
  }
}
