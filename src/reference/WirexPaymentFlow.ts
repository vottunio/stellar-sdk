import { Logger } from '../config/Logger';
import { StellarError } from '../errors/StellarError';
import { getErrorMessage } from '../errors/utils';
import { StellarClient } from '../stellar/StellarClient';
import { ResolvedConfig } from '../types/config.types';
import {
  ASSET_ISSUERS,
  SettlementParams,
  SettlementResult,
  SettlementStep,
} from '../types/reference.types';
import { TransactionResult } from '../types/transaction.types';
import { Wallet } from '../types/wallet.types';
import { WalletManager } from '../wallet/WalletManager';

/**
 * Wirex reference settlement flow — orchestrates the full lifecycle of
 * an on-chain Stellar settlement:
 *
 * 1. **Load wallet** — Verify the source account exists on-chain
 * 2. **Check trustline** — For non-native assets (USDC, EURC), ensure the
 *    destination has a trustline; if the source is also the trustline creator,
 *    add it automatically
 * 3. **Build & sign transaction** — Construct the payment transaction
 * 4. **Submit** — Submit to the Stellar network
 * 5. **Track confirmation** — Wait for ledger inclusion
 *
 * This is a **non-custodial** flow: the caller provides a `Wallet` that
 * signs client-side. No private keys are transmitted or stored.
 *
 * Accessed via `sdk.reference`.
 *
 * @example
 * ```typescript
 * const sdk = new WirexSDK({ network: 'testnet' });
 *
 * // XLM settlement
 * const result = await sdk.reference.createSettlement(
 *   { asset: 'XLM', amount: '100', destination: 'GDEST...' },
 *   sourceWallet,
 * );
 *
 * // USDC settlement (trustline handled automatically)
 * const usdcResult = await sdk.reference.createSettlement(
 *   { asset: 'USDC', amount: '25.50', destination: 'GDEST...' },
 *   sourceWallet,
 * );
 * ```
 */
export class WirexPaymentFlow {
  private readonly config: ResolvedConfig;
  private readonly logger: Logger;
  private readonly stellar: StellarClient;
  private readonly walletManager: WalletManager;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.logger = new Logger(config.logging.level, 'WirexPaymentFlow');
    this.stellar = new StellarClient(config);
    this.walletManager = new WalletManager(config);
  }

  /**
   * Execute a full settlement flow: validate → trustline → pay → confirm.
   *
   * @param params - Settlement parameters (asset, amount, destination).
   * @param wallet - The source wallet that will sign the transaction.
   *                 Must have sufficient balance for the payment + fees.
   * @returns Settlement result with step-by-step details.
   */
  async createSettlement(
    params: SettlementParams,
    wallet: Wallet,
  ): Promise<SettlementResult> {
    const startTime = Date.now();
    const steps: SettlementStep[] = [];

    this.logger.info(
      `Starting ${params.asset} settlement: ${params.amount} → ${params.destination}`,
    );

    try {
      // Step 1: Validate source account
      await this.executeStep(steps, 'validate_source', async () => {
        await this.validateAccount(wallet.publicKey, 'Source');
      });

      // Step 2: Validate destination account
      await this.executeStep(steps, 'validate_destination', async () => {
        await this.validateAccount(params.destination, 'Destination');
      });

      // Step 3: Check/establish trustline (non-native assets only)
      if (params.asset !== 'XLM') {
        await this.executeStep(steps, 'check_trustline', async () => {
          return this.ensureTrustline(params, wallet);
        });
      } else {
        steps.push({ name: 'check_trustline', status: 'skipped' });
      }

      // Step 4: Send payment
      let txResult: TransactionResult | undefined;
      await this.executeStep(steps, 'send_payment', async () => {
        txResult = await this.sendSettlementPayment(params, wallet);
        return txResult.hash;
      });

      // Step 5: Confirm on-chain
      await this.executeStep(steps, 'confirm', async () => {
        if (!txResult) throw new Error('No transaction to confirm');
        // Transaction is already confirmed by the time sendPayment returns
        // (Horizon waits for ledger inclusion). We verify the result.
        if (!txResult.successful) {
          // Do NOT include resultXdr in the error message — it can contain
          // signed transaction envelope data. Keep only the public hash for debugging.
          throw new StellarError(
            `Settlement transaction failed (hash: ${txResult.hash})`,
            'SETTLEMENT_TX_FAILED',
            { hash: txResult.hash, ledger: txResult.ledger },
          );
        }
        return txResult.hash;
      });

      this.logger.info(
        `Settlement complete: ${txResult!.hash} in ledger ${txResult!.ledger}`,
      );

      return {
        successful: true,
        transaction: txResult,
        steps,
        totalDurationMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Settlement failed: ${getErrorMessage(error)}`);
      return {
        successful: false,
        steps,
        totalDurationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Resolve the issuer for a non-native asset.
   * Uses the well-known issuer table unless overridden in params.
   */
  resolveIssuer(params: SettlementParams): string {
    if (params.issuer) return params.issuer;
    const networkIssuers = ASSET_ISSUERS[this.config.network];
    const issuer = networkIssuers[params.asset];
    if (!issuer) {
      throw new StellarError(
        `No known issuer for ${params.asset} on ${this.config.network}`,
        'SETTLEMENT_UNKNOWN_ISSUER',
        { asset: params.asset, network: this.config.network },
      );
    }
    return issuer;
  }

  // ─── Internal Helpers ─────────────────────────────────────────────────────

  private async executeStep(
    steps: SettlementStep[],
    name: string,
    fn: () => Promise<string | void>,
  ): Promise<void> {
    const step: SettlementStep = { name, status: 'pending' };
    steps.push(step);
    const stepStart = Date.now();

    try {
      const hash = await fn();
      step.status = 'success';
      if (hash) step.hash = hash;
    } catch (error) {
      step.status = 'failed';
      step.error = getErrorMessage(error);
      throw error;
    } finally {
      step.durationMs = Date.now() - stepStart;
    }
  }

  private async validateAccount(address: string, label: string): Promise<void> {
    const exists = await this.stellar.accountExists(address);
    if (!exists) {
      throw new StellarError(
        `${label} account does not exist: ${address}`,
        'SETTLEMENT_ACCOUNT_NOT_FOUND',
        { address },
      );
    }
  }

  private async ensureTrustline(
    params: SettlementParams,
    wallet: Wallet,
  ): Promise<string | void> {
    const issuer = this.resolveIssuer(params);
    const destBalances = await this.stellar.getBalances(params.destination);

    const hasTrustline = destBalances.some(
      (b) => b.code === params.asset && b.issuer === issuer,
    );

    if (hasTrustline) {
      this.logger.debug(
        `Destination already has ${params.asset} trustline`,
      );
      return;
    }

    // If the source wallet IS the destination, we can add the trustline automatically
    if (wallet.publicKey === params.destination) {
      this.logger.info(
        `Adding ${params.asset} trustline for ${params.destination}`,
      );
      const result = await this.stellar.changeTrust(
        {
          sourceAccount: params.destination,
          asset: { code: params.asset, issuer },
        },
        wallet,
      );
      return result.hash;
    }

    // Otherwise, the destination must have the trustline already
    throw new StellarError(
      `Destination ${params.destination} lacks a ${params.asset} trustline. ` +
        `The destination account must add a trustline for ${params.asset}:${issuer} before receiving payments.`,
      'SETTLEMENT_MISSING_TRUSTLINE',
      { asset: params.asset, issuer, destination: params.destination },
    );
  }

  private async sendSettlementPayment(
    params: SettlementParams,
    wallet: Wallet,
  ): Promise<TransactionResult> {
    const asset: { code: string; issuer?: string } =
      params.asset === 'XLM'
        ? { code: 'XLM' }
        : { code: params.asset, issuer: this.resolveIssuer(params) };

    return this.stellar.sendPayment(
      {
        sourceAccount: wallet.publicKey,
        destination: params.destination,
        asset,
        amount: params.amount,
        memo: params.memo,
      },
      wallet,
    );
  }
}
