import {
  TransactionBuilder as StellarTransactionBuilder,
  Networks,
  Operation,
  Asset,
  Memo,
  Horizon,
  Account,
} from '@stellar/stellar-sdk';

import { StellarError } from '../errors/StellarError';
import { ResolvedConfig } from '../types/config.types';
import {
  AssetSpec,
  ChangeTrustParams,
  CreateAccountParams,
  FeeEstimate,
  ManageDataParams,
  MemoSpec,
  PathPaymentStrictSendParams,
  PaymentParams,
  TransactionBuilderOptions,
  TransactionResult,
} from '../types/transaction.types';
import { Wallet } from '../types/wallet.types';

import { TransactionSubmitter } from './TransactionSubmitter';

/**
 * Fluent API for building, signing, and submitting Stellar transactions.
 *
 * @example
 * ```typescript
 * const result = await sdk.transaction({ sourceAccount: publicKey })
 *   .addPayment({ destination, asset: { code: 'XLM' }, amount: '10' })
 *   .addMemo({ type: 'text', value: 'Hello' })
 *   .sign(wallet)
 *   .submit();
 * ```
 */
export class WirexTransactionBuilder {
  private readonly config: ResolvedConfig;
  private readonly options: TransactionBuilderOptions;
  private operations: (() => void)[] = [];
  private memo?: MemoSpec;
  private timeoutSeconds = 180;
  private timeBounds: { minTime: string; maxTime: string } | null = null;
  private builtXdr: string | null = null;
  private signedXdr: string | null = null;

  constructor(config: ResolvedConfig, options: TransactionBuilderOptions) {
    this.config = config;
    this.options = options;

    if (options.memo) {
      this.memo = options.memo;
    }
    if (options.timeoutSeconds) {
      this.timeoutSeconds = options.timeoutSeconds;
    }
  }

  /** Add a payment operation. */
  addPayment(params: PaymentParams): this {
    this.operations.push(() => {
      this.builder!.addOperation(
        Operation.payment({
          destination: params.destination,
          asset: this.resolveAsset(params.asset),
          amount: params.amount,
        }),
      );
    });
    return this;
  }

  /** Add a create account operation. */
  addCreateAccount(params: CreateAccountParams): this {
    this.operations.push(() => {
      this.builder!.addOperation(
        Operation.createAccount({
          destination: params.destination,
          startingBalance: params.startingBalance,
        }),
      );
    });
    return this;
  }

  /** Add a change trust operation. */
  changeTrust(params: ChangeTrustParams): this {
    this.operations.push(() => {
      this.builder!.addOperation(
        Operation.changeTrust({
          asset: this.resolveAsset(params.asset) as Asset,
          limit: params.limit,
        }),
      );
    });
    return this;
  }

  /** Add a manage data operation. */
  addManageData(params: ManageDataParams): this {
    this.operations.push(() => {
      this.builder!.addOperation(
        Operation.manageData({
          name: params.name,
          value: params.value ?? null,
        }),
      );
    });
    return this;
  }

  /** Add a path payment strict send operation. */
  addPathPayment(params: PathPaymentStrictSendParams): this {
    this.operations.push(() => {
      this.builder!.addOperation(
        Operation.pathPaymentStrictSend({
          sendAsset: this.resolveAsset(params.sendAsset),
          sendAmount: params.sendAmount,
          destination: params.destination,
          destAsset: this.resolveAsset(params.destAsset),
          destMin: params.destMin,
          path: params.path?.map((a) => this.resolveAsset(a)) ?? [],
        }),
      );
    });
    return this;
  }

  /** Set the transaction memo. */
  addMemo(memo: MemoSpec): this {
    this.memo = memo;
    return this;
  }

  /** Set the transaction timeout in seconds. */
  setTimeout(seconds: number): this {
    this.timeoutSeconds = seconds;
    return this;
  }

  /** Set explicit time bounds (min and max UNIX timestamps). Overrides setTimeout. */
  setTimeBounds(minTime: number | string, maxTime: number | string): this {
    this.timeBounds = { minTime: String(minTime), maxTime: String(maxTime) };
    return this;
  }

  /** Estimate fees for the current operations. */
  async estimateFees(): Promise<FeeEstimate> {
    const server = new Horizon.Server(this.config.horizonUrl);
    const baseFee = await server.fetchBaseFee();
    const opCount = Math.max(this.operations.length, 1);
    return {
      baseFee: String(baseFee),
      estimatedFee: String(baseFee * opCount),
      operationCount: opCount,
    };
  }

  /** Build the transaction XDR. Must be called before sign(). */
  async build(): Promise<this> {
    const server = new Horizon.Server(this.config.horizonUrl);
    const account = await server.loadAccount(this.options.sourceAccount);
    const fee = this.options.fee ?? String(await server.fetchBaseFee());

    const builderOpts: Record<string, unknown> = {
      fee,
      networkPassphrase: this.config.networkPassphrase,
    };

    if (this.timeBounds) {
      builderOpts.timebounds = {
        minTime: this.timeBounds.minTime,
        maxTime: this.timeBounds.maxTime,
      };
    }

    this.builder = new StellarTransactionBuilder(account, builderOpts as unknown as ConstructorParameters<typeof StellarTransactionBuilder>[1]);

    for (const addOp of this.operations) {
      addOp();
    }

    if (this.memo) {
      this.builder.addMemo(this.resolveMemo(this.memo));
    }

    if (!this.timeBounds) {
      this.builder.setTimeout(this.timeoutSeconds);
    }
    const tx = this.builder.build();
    this.builtXdr = tx.toXDR();
    return this;
  }

  /** Sign the built transaction with a wallet. */
  async sign(wallet: Wallet): Promise<this> {
    if (!this.builtXdr) {
      await this.build();
    }
    this.signedXdr = await wallet.sign(this.builtXdr!, this.config.networkPassphrase);
    return this;
  }

  /** Submit the signed transaction to the network. */
  async submit(): Promise<TransactionResult> {
    if (!this.signedXdr) {
      throw new StellarError(
        'Transaction must be signed before submission',
        'TX_NOT_SIGNED',
      );
    }

    const submitter = new TransactionSubmitter(this.config);
    return submitter.submit(this.signedXdr);
  }

  /** Get the built transaction XDR (before signing). */
  getXDR(): string {
    if (!this.builtXdr) {
      throw new StellarError('Transaction not built yet. Call build() first.', 'TX_NOT_BUILT');
    }
    return this.builtXdr;
  }

  /** Get the signed transaction XDR. */
  getSignedXDR(): string {
    if (!this.signedXdr) {
      throw new StellarError('Transaction not signed yet. Call sign() first.', 'TX_NOT_SIGNED');
    }
    return this.signedXdr;
  }

  // --- internal builder reference ---
  private builder: StellarTransactionBuilder | null = null;

  private resolveAsset(spec: AssetSpec): Asset {
    if (spec.code === 'XLM' && !spec.issuer) {
      return Asset.native();
    }
    if (!spec.issuer) {
      throw new StellarError(
        `Asset ${spec.code} requires an issuer`,
        'INVALID_ASSET',
        { code: spec.code },
      );
    }
    return new Asset(spec.code, spec.issuer);
  }

  private resolveMemo(memo: MemoSpec): Memo {
    switch (memo.type) {
      case 'text':
        return Memo.text(memo.value ?? '');
      case 'id':
        return Memo.id(memo.value ?? '0');
      case 'hash':
        return Memo.hash(memo.value ?? '');
      case 'return':
        return Memo.return(memo.value ?? '');
      case 'none':
      default:
        return Memo.none();
    }
  }
}
