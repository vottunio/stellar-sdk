import {
  Asset,
  Operation,
  StrKey,
} from '@stellar/stellar-sdk';

import { Logger } from '../config/Logger';
import { StellarError } from '../errors/StellarError';
import { getErrorMessage } from '../errors/utils';
import { ResolvedConfig } from '../types/config.types';
import {
  StellarPathPaymentStrictReceiveParams,
  StellarPathPaymentStrictSendParams,
  StellarSendPaymentParams,
  StellarOperationErrorCode,
} from '../types/stellar.types';
import { TransactionResult } from '../types/transaction.types';
import { Wallet } from '../types/wallet.types';

import { TransactionHelper } from './TransactionHelper';

/**
 * Service for Stellar payment operations — simple payments and path payments.
 *
 * @example
 * ```typescript
 * const paymentService = new PaymentService(config);
 *
 * // Send XLM payment
 * await paymentService.sendPayment(
 *   { sourceAccount: 'G...', destination: 'G...', asset: { code: 'XLM' }, amount: '10' },
 *   wallet,
 * );
 *
 * // Path payment (cross-currency)
 * await paymentService.pathPaymentStrictSend(
 *   { sourceAccount: 'G...', sendAsset: { code: 'XLM' }, sendAmount: '10',
 *     destination: 'G...', destAsset: { code: 'USDC', issuer: '...' }, destMin: '1' },
 *   wallet,
 * );
 * ```
 */
export class PaymentService {
  private readonly config: ResolvedConfig;
  private readonly logger: Logger;
  private readonly helper: TransactionHelper;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.logger = new Logger(config.logging.level, 'PaymentService');
    this.helper = new TransactionHelper(config);
  }

  /**
   * Send a payment (XLM or any asset).
   * @param params - Payment parameters.
   * @param wallet - Wallet to sign the transaction.
   * @returns Transaction result.
   */
  async sendPayment(
    params: StellarSendPaymentParams,
    wallet: Wallet,
  ): Promise<TransactionResult> {
    this.validateAddress(params.sourceAccount);
    this.validateAddress(params.destination);
    this.logger.info(
      `Sending ${params.amount} ${params.asset.code} to ${params.destination}`,
    );

    try {
      return await this.helper.buildSignSubmit(
        params.sourceAccount,
        [
          Operation.payment({
            destination: params.destination,
            asset: this.resolveAsset(params.asset),
            amount: params.amount,
          }),
        ],
        wallet,
        { fee: params.fee, memo: params.memo },
      );
    } catch (error) {
      if (error instanceof StellarError) throw error;
      throw new StellarError(
        `Payment failed: ${getErrorMessage(error)}`,
        StellarOperationErrorCode.PAYMENT_FAILED,
        { destination: params.destination, amount: params.amount },
      );
    }
  }

  /**
   * Path payment strict send — send exact amount, receive at least destMin.
   * @param params - Path payment parameters.
   * @param wallet - Wallet to sign the transaction.
   * @returns Transaction result.
   */
  async pathPaymentStrictSend(
    params: StellarPathPaymentStrictSendParams,
    wallet: Wallet,
  ): Promise<TransactionResult> {
    this.validateAddress(params.sourceAccount);
    this.validateAddress(params.destination);
    this.logger.info(
      `Path payment strict send: ${params.sendAmount} ${params.sendAsset.code} → ${params.destAsset.code}`,
    );

    try {
      return await this.helper.buildSignSubmit(
        params.sourceAccount,
        [
          Operation.pathPaymentStrictSend({
            sendAsset: this.resolveAsset(params.sendAsset),
            sendAmount: params.sendAmount,
            destination: params.destination,
            destAsset: this.resolveAsset(params.destAsset),
            destMin: params.destMin,
            path: (params.path ?? []).map((a) => this.resolveAsset(a)),
          }),
        ],
        wallet,
      );
    } catch (error) {
      if (error instanceof StellarError) throw error;
      throw new StellarError(
        `Path payment strict send failed: ${getErrorMessage(error)}`,
        StellarOperationErrorCode.PATH_PAYMENT_FAILED,
        { sendAmount: params.sendAmount },
      );
    }
  }

  /**
   * Path payment strict receive — send at most sendMax, receive exact destAmount.
   * @param params - Path payment parameters.
   * @param wallet - Wallet to sign the transaction.
   * @returns Transaction result.
   */
  async pathPaymentStrictReceive(
    params: StellarPathPaymentStrictReceiveParams,
    wallet: Wallet,
  ): Promise<TransactionResult> {
    this.validateAddress(params.sourceAccount);
    this.validateAddress(params.destination);
    this.logger.info(
      `Path payment strict receive: max ${params.sendMax} ${params.sendAsset.code} → ${params.destAmount} ${params.destAsset.code}`,
    );

    try {
      return await this.helper.buildSignSubmit(
        params.sourceAccount,
        [
          Operation.pathPaymentStrictReceive({
            sendAsset: this.resolveAsset(params.sendAsset),
            sendMax: params.sendMax,
            destination: params.destination,
            destAsset: this.resolveAsset(params.destAsset),
            destAmount: params.destAmount,
            path: (params.path ?? []).map((a) => this.resolveAsset(a)),
          }),
        ],
        wallet,
      );
    } catch (error) {
      if (error instanceof StellarError) throw error;
      throw new StellarError(
        `Path payment strict receive failed: ${getErrorMessage(error)}`,
        StellarOperationErrorCode.PATH_PAYMENT_FAILED,
        { destAmount: params.destAmount },
      );
    }
  }

  private resolveAsset(spec: { code: string; issuer?: string }): Asset {
    if (spec.code === 'XLM' && !spec.issuer) {
      return Asset.native();
    }
    if (!spec.issuer) {
      throw new StellarError(
        `Asset ${spec.code} requires an issuer`,
        StellarOperationErrorCode.PAYMENT_FAILED,
        { code: spec.code },
      );
    }
    return new Asset(spec.code, spec.issuer);
  }

  private validateAddress(address: string): void {
    if (!address || !StrKey.isValidEd25519PublicKey(address)) {
      throw new StellarError(
        `Invalid Stellar address: ${address}`,
        StellarOperationErrorCode.INVALID_ADDRESS,
        { address },
      );
    }
  }
}
