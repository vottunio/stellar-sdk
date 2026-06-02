import {
  TransactionBuilder as StellarTransactionBuilder,
  Operation,
  Asset,
  Memo,
  Horizon,
  StrKey,
} from '@stellar/stellar-sdk';

import { StellarError } from '../errors/StellarError';
import { getErrorMessage } from '../errors/utils';
import { ResolvedConfig } from '../types/config.types';
import {
  AssetSpec,
  ChangeTrustParams,
  CreateAccountParams,
  FeeEstimate,
  FeeStrategy,
  ManageDataParams,
  MemoSpec,
  PathPaymentStrictSendParams,
  PaymentParams,
  TransactionBuilderOptions,
  TransactionResult,
} from '../types/transaction.types';
import { Wallet } from '../types/wallet.types';

import { FeeEstimator } from './FeeEstimator';
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
  private timeoutSeconds: number;
  private timeBounds: { minTime: string; maxTime: string } | null = null;
  private feeStrategy: FeeStrategy | null = null;
  private builtXdr: string | null = null;
  private signedXdr: string | null = null;

  constructor(config: ResolvedConfig, options: TransactionBuilderOptions) {
    this.config = config;
    this.options = options;

    // Network-aware default: 30s testnet, 180s mainnet (from config.timeout.transactionSeconds)
    this.timeoutSeconds = options.timeoutSeconds ?? config.timeout.transactionSeconds;

    if (options.memo) {
      this.memo = options.memo;
    }
  }

  /** Add a payment operation. */
  addPayment(params: PaymentParams): this {
    this.validateAddress(params.destination, 'destination');
    this.validateAmount(params.amount, 'amount');
    this.validateAsset(params.asset);
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
    this.validateAddress(params.destination, 'destination');
    this.validateAmount(params.startingBalance, 'startingBalance');
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
    this.validateAsset(params.asset);
    if (params.limit !== undefined) this.validateAmount(params.limit, 'limit', { allowZero: true });
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
    this.validateDataName(params.name);
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
    this.validateAddress(params.destination, 'destination');
    this.validateAmount(params.sendAmount, 'sendAmount');
    this.validateAmount(params.destMin, 'destMin');
    this.validateAsset(params.sendAsset);
    this.validateAsset(params.destAsset);
    params.path?.forEach((a) => this.validateAsset(a));
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

  /**
   * Set a dynamic fee strategy for this transaction.
   * When set, `build()` uses congestion-aware fee estimation via `/fee_stats`.
   * If a fixed `fee` was passed in options, it takes precedence over the strategy.
   */
  setFeeStrategy(strategy: FeeStrategy): this {
    this.feeStrategy = strategy;
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

  /**
   * Build the transaction XDR. Must be called before sign().
   *
   * Note: Builder instances are not safe for concurrent reuse. After `build()`
   * loads an account, the sequence number is fixed; submitting twice with the
   * same builder will produce a `tx_bad_seq` error on the second submission.
   * Construct a new builder per transaction.
   */
  async build(): Promise<this> {
    this.validateAddress(this.options.sourceAccount, 'sourceAccount');
    const server = new Horizon.Server(this.config.horizonUrl);
    const account = await server.loadAccount(this.options.sourceAccount);

    let fee: string;
    if (this.options.fee) {
      // Explicit fee takes precedence
      fee = this.options.fee;
    } else if (this.feeStrategy || this.config.network === 'mainnet') {
      // Use dynamic fee on mainnet (defaults to 'medium') or when strategy is explicitly set
      const estimator = new FeeEstimator(this.config);
      const strategy = this.feeStrategy ?? 'medium';
      const estimate = await estimator.estimateDynamic(
        Math.max(this.operations.length, 1),
        strategy,
      );
      fee = String(Math.ceil(parseInt(estimate.estimatedFee, 10) / Math.max(this.operations.length, 1)));
    } else {
      fee = String(await server.fetchBaseFee());
    }

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

    try {
      const tx = this.builder.build();
      this.builtXdr = tx.toXDR();
    } catch (error) {
      throw new StellarError(
        `Failed to build transaction: ${getErrorMessage(error)}`,
        'TX_BUILD_FAILED',
      );
    }
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

  // ─── Input Validation (3.1.5) ────────────────────────────────────────────

  private validateAddress(address: string, field: string): void {
    if (!address || typeof address !== 'string') {
      throw new StellarError(
        `Invalid ${field}: must be a non-empty string`,
        'TX_INVALID_INPUT',
        { field },
      );
    }
    if (!StrKey.isValidEd25519PublicKey(address)) {
      throw new StellarError(
        `Invalid ${field}: not a valid Stellar account address`,
        'TX_INVALID_INPUT',
        { field },
      );
    }
  }

  private validateAmount(
    amount: string,
    field: string,
    options: { allowZero?: boolean } = {},
  ): void {
    if (typeof amount !== 'string' || amount.trim() === '') {
      throw new StellarError(
        `Invalid ${field}: must be a non-empty string`,
        'TX_INVALID_INPUT',
        { field },
      );
    }
    // Stellar amounts: optional sign rejected, decimal up to 7 fractional digits
    if (!/^\d+(\.\d{1,7})?$/.test(amount)) {
      throw new StellarError(
        `Invalid ${field}: must be a positive decimal with at most 7 fractional digits`,
        'TX_INVALID_INPUT',
        { field },
      );
    }
    const numeric = parseFloat(amount);
    if (!options.allowZero && numeric <= 0) {
      throw new StellarError(
        `Invalid ${field}: must be greater than 0`,
        'TX_INVALID_INPUT',
        { field },
      );
    }
  }

  private validateAsset(spec: AssetSpec): void {
    if (!spec || typeof spec.code !== 'string' || spec.code.length === 0) {
      throw new StellarError(
        'Invalid asset: code is required',
        'TX_INVALID_INPUT',
      );
    }
    // Native XLM
    if (spec.code === 'XLM' && !spec.issuer) return;

    // Custom asset codes: 1–12 alphanumeric chars per Stellar spec
    if (spec.code.length > 12) {
      throw new StellarError(
        `Invalid asset code "${spec.code}": exceeds 12 character limit`,
        'TX_INVALID_INPUT',
        { code: spec.code },
      );
    }
    if (!/^[a-zA-Z0-9]+$/.test(spec.code)) {
      throw new StellarError(
        `Invalid asset code "${spec.code}": must be alphanumeric`,
        'TX_INVALID_INPUT',
        { code: spec.code },
      );
    }
    if (!spec.issuer) {
      throw new StellarError(
        `Asset ${spec.code} requires an issuer`,
        'TX_INVALID_INPUT',
        { code: spec.code },
      );
    }
    if (!StrKey.isValidEd25519PublicKey(spec.issuer)) {
      throw new StellarError(
        `Invalid issuer for asset ${spec.code}`,
        'TX_INVALID_INPUT',
        { code: spec.code },
      );
    }
  }

  private validateDataName(name: string): void {
    if (typeof name !== 'string' || name.length === 0 || name.length > 64) {
      throw new StellarError(
        'Invalid data name: must be 1–64 chars',
        'TX_INVALID_INPUT',
      );
    }
  }
}
