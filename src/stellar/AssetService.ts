import {
  Asset,
  Claimant,
  Operation,
  StrKey,
} from '@stellar/stellar-sdk';

import { Logger } from '../config/Logger';
import { StellarError } from '../errors/StellarError';
import { getErrorMessage } from '../errors/utils';
import { ResolvedConfig } from '../types/config.types';
import {
  StellarChangeTrustParams,
  ClaimClaimableBalanceParams,
  ClaimantSpec,
  CreateClaimableBalanceParams,
  SponsoredOperationParams,
  StellarOperationErrorCode,
} from '../types/stellar.types';
import { TransactionResult } from '../types/transaction.types';
import { Wallet } from '../types/wallet.types';

import { TransactionHelper } from './TransactionHelper';

/**
 * Service for Stellar asset operations — trustlines, claimable balances,
 * sponsored reserves, and the Asset wrapper.
 *
 * @example
 * ```typescript
 * const assetService = new AssetService(config);
 *
 * // Add USDC trustline
 * await assetService.changeTrust(
 *   { sourceAccount: 'G...', asset: { code: 'USDC', issuer: 'G...' } },
 *   wallet,
 * );
 *
 * // Create claimable balance
 * await assetService.createClaimableBalance(
 *   { sourceAccount: 'G...', asset: { code: 'XLM' }, amount: '100',
 *     claimants: [{ destination: 'G...', predicate: 'unconditional' }] },
 *   wallet,
 * );
 * ```
 */
export class AssetService {
  private readonly config: ResolvedConfig;
  private readonly logger: Logger;
  private readonly helper: TransactionHelper;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.logger = new Logger(config.logging.level, 'AssetService');
    this.helper = new TransactionHelper(config);
  }

  // ─── Asset Wrapper (2.2.12) ────────────────────────────────────────────────

  /** Create a native XLM asset. */
  static nativeAsset(): Asset {
    return Asset.native();
  }

  /** Create a custom asset with code and issuer. */
  static customAsset(code: string, issuer: string): Asset {
    return new Asset(code, issuer);
  }

  /** Resolve an asset spec to a Stellar Asset instance. */
  resolveAsset(spec: { code: string; issuer?: string }): Asset {
    if (spec.code === 'XLM' && !spec.issuer) {
      return Asset.native();
    }
    if (!spec.issuer) {
      throw new StellarError(
        `Asset ${spec.code} requires an issuer`,
        StellarOperationErrorCode.TRUSTLINE_FAILED,
        { code: spec.code },
      );
    }
    return new Asset(spec.code, spec.issuer);
  }

  // ─── Change Trust (2.2.5) ──────────────────────────────────────────────────

  /**
   * Add or modify a trustline for an asset.
   * Set limit to '0' to remove the trustline.
   *
   * @param params - Change trust parameters.
   * @param wallet - Wallet to sign the transaction.
   * @returns Transaction result.
   */
  async changeTrust(
    params: StellarChangeTrustParams,
    wallet: Wallet,
  ): Promise<TransactionResult> {
    this.validateAddress(params.sourceAccount);
    this.logger.info(
      `${params.limit === '0' ? 'Removing' : 'Adding'} trustline for ${params.asset.code}:${params.asset.issuer}`,
    );

    try {
      return await this.helper.buildSignSubmit(
        params.sourceAccount,
        [
          Operation.changeTrust({
            asset: new Asset(params.asset.code, params.asset.issuer),
            limit: params.limit,
          }),
        ],
        wallet,
      );
    } catch (error) {
      if (error instanceof StellarError) throw error;
      throw new StellarError(
        `Change trust failed: ${getErrorMessage(error)}`,
        StellarOperationErrorCode.TRUSTLINE_FAILED,
        { asset: `${params.asset.code}:${params.asset.issuer}` },
      );
    }
  }

  // ─── Claimable Balances (2.2.8, 2.2.9) ────────────────────────────────────

  /**
   * Create a claimable balance.
   * @param params - Claimable balance parameters.
   * @param wallet - Wallet to sign the transaction.
   * @returns Transaction result.
   */
  async createClaimableBalance(
    params: CreateClaimableBalanceParams,
    wallet: Wallet,
  ): Promise<TransactionResult> {
    this.validateAddress(params.sourceAccount);
    for (const c of params.claimants) {
      this.validateAddress(c.destination);
    }
    this.logger.info(
      `Creating claimable balance: ${params.amount} ${params.asset.code}`,
    );

    try {
      const claimants = params.claimants.map((c) => this.buildClaimant(c));

      return await this.helper.buildSignSubmit(
        params.sourceAccount,
        [
          Operation.createClaimableBalance({
            asset: this.resolveAsset(params.asset),
            amount: params.amount,
            claimants,
          }),
        ],
        wallet,
      );
    } catch (error) {
      if (error instanceof StellarError) throw error;
      throw new StellarError(
        `Create claimable balance failed: ${getErrorMessage(error)}`,
        StellarOperationErrorCode.CLAIMABLE_BALANCE_FAILED,
        { amount: params.amount },
      );
    }
  }

  /**
   * Claim a claimable balance by its ID.
   * @param params - Claim parameters.
   * @param wallet - Wallet to sign the transaction.
   * @returns Transaction result.
   */
  async claimClaimableBalance(
    params: ClaimClaimableBalanceParams,
    wallet: Wallet,
  ): Promise<TransactionResult> {
    this.validateAddress(params.sourceAccount);
    this.logger.info(`Claiming claimable balance: ${params.balanceId}`);

    try {
      return await this.helper.buildSignSubmit(
        params.sourceAccount,
        [
          Operation.claimClaimableBalance({
            balanceId: params.balanceId,
          }),
        ],
        wallet,
      );
    } catch (error) {
      if (error instanceof StellarError) throw error;
      throw new StellarError(
        `Claim claimable balance failed: ${getErrorMessage(error)}`,
        StellarOperationErrorCode.CLAIMABLE_BALANCE_FAILED,
        { balanceId: params.balanceId },
      );
    }
  }

  // ─── Sponsored Reserves (2.2.10) ──────────────────────────────────────────

  /**
   * Build a transaction that begins sponsoring future reserves for another account.
   * The operations between beginSponsoring and endSponsoring are sponsored.
   *
   * @param params - Sponsoring parameters.
   * @param sponsoredOperations - Operations to execute under sponsorship.
   * @param wallet - Sponsor's wallet (signs the outer transaction).
   * @returns Transaction result.
   */
  async sponsoredOperation(
    params: SponsoredOperationParams,
    sponsoredOperations: ReturnType<typeof Operation.payment>[],
    wallet: Wallet,
  ): Promise<TransactionResult> {
    this.validateAddress(params.sourceAccount);
    this.validateAddress(params.sponsoredAccount);
    this.logger.info(
      `Sponsoring operations for ${params.sponsoredAccount}`,
    );

    try {
      const ops = [
        Operation.beginSponsoringFutureReserves({
          sponsoredId: params.sponsoredAccount,
        }),
        ...sponsoredOperations,
        Operation.endSponsoringFutureReserves({
          source: params.sponsoredAccount,
        }),
      ];

      return await this.helper.buildSignSubmit(
        params.sourceAccount,
        ops,
        wallet,
      );
    } catch (error) {
      if (error instanceof StellarError) throw error;
      throw new StellarError(
        `Sponsored operation failed: ${getErrorMessage(error)}`,
        StellarOperationErrorCode.SPONSORSHIP_FAILED,
        { sponsoredAccount: params.sponsoredAccount },
      );
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private buildClaimant(spec: ClaimantSpec): Claimant {
    if (!spec.predicate || spec.predicate === 'unconditional') {
      return new Claimant(spec.destination, Claimant.predicateUnconditional());
    }
    if ('before' in spec.predicate) {
      return new Claimant(
        spec.destination,
        Claimant.predicateBeforeAbsoluteTime(String(spec.predicate.before)),
      );
    }
    if ('after' in spec.predicate) {
      return new Claimant(
        spec.destination,
        Claimant.predicateNot(
          Claimant.predicateBeforeAbsoluteTime(String(spec.predicate.after)),
        ),
      );
    }
    return new Claimant(spec.destination, Claimant.predicateUnconditional());
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
