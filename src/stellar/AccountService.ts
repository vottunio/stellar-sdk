import {
  Horizon,
  Operation,
  StrKey,
} from '@stellar/stellar-sdk';

import { Logger } from '../config/Logger';
import { StellarError } from '../errors/StellarError';
import { getErrorMessage } from '../errors/utils';
import { ResolvedConfig } from '../types/config.types';
import {
  AccountInfo,
  StellarCreateAccountParams,
  ManageDataOperationParams,
  StellarOperationErrorCode,
} from '../types/stellar.types';
import { TransactionResult } from '../types/transaction.types';
import { Balance, Wallet } from '../types/wallet.types';

import { TransactionHelper } from './TransactionHelper';

/**
 * Service for Stellar account operations — existence checks, funding,
 * account creation, balance queries, and manage data.
 *
 * @example
 * ```typescript
 * const accountService = new AccountService(config);
 *
 * // Check if account exists
 * const exists = await accountService.accountExists('G...');
 *
 * // Fund on testnet
 * await accountService.fundTestAccount('G...');
 *
 * // Create new account on-chain
 * await accountService.createAccount(
 *   { sourceAccount: 'G...', destination: 'G...', startingBalance: '10' },
 *   wallet,
 * );
 * ```
 */
export class AccountService {
  private readonly config: ResolvedConfig;
  private readonly logger: Logger;
  private readonly helper: TransactionHelper;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.logger = new Logger(config.logging.level, 'AccountService');
    this.helper = new TransactionHelper(config);
  }

  /**
   * Check whether a Stellar account exists on-chain.
   * @param address - The Stellar public key (G...).
   * @returns True if the account exists, false otherwise.
   */
  async accountExists(address: string): Promise<boolean> {
    this.validateAddress(address);
    try {
      const server = new Horizon.Server(this.config.horizonUrl);
      await server.loadAccount(address);
      return true;
    } catch (error: unknown) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw new StellarError(
        `Failed to check account existence: ${address}`,
        StellarOperationErrorCode.ACCOUNT_NOT_FOUND,
        { address, error: String(error) },
      );
    }
  }

  /**
   * Fund a Stellar account on testnet via Friendbot.
   * Only works on the Stellar testnet.
   * @param address - The Stellar public key to fund.
   */
  async fundTestAccount(address: string): Promise<void> {
    this.validateAddress(address);

    if (this.config.network !== 'testnet') {
      throw new StellarError(
        'Friendbot funding is only available on testnet',
        StellarOperationErrorCode.FUND_FAILED,
        { network: this.config.network },
      );
    }

    try {
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`,
      );
      if (!response.ok) {
        throw new Error(`Friendbot returned HTTP ${response.status}`);
      }
      this.logger.info(`Funded test account: ${address}`);
    } catch (error) {
      if (error instanceof StellarError) throw error;
      throw new StellarError(
        `Failed to fund test account: ${getErrorMessage(error)}`,
        StellarOperationErrorCode.FUND_FAILED,
        { address },
      );
    }
  }

  /**
   * Create a new Stellar account on-chain.
   * @param params - Account creation parameters.
   * @param wallet - Wallet to sign the transaction (must be the source account).
   * @returns Transaction result.
   */
  async createAccount(
    params: StellarCreateAccountParams,
    wallet: Wallet,
  ): Promise<TransactionResult> {
    this.validateAddress(params.sourceAccount);
    this.validateAddress(params.destination);
    this.logger.info(`Creating account ${params.destination}`);

    try {
      return await this.helper.buildSignSubmit(
        params.sourceAccount,
        [
          Operation.createAccount({
            destination: params.destination,
            startingBalance: params.startingBalance,
          }),
        ],
        wallet,
      );
    } catch (error) {
      if (error instanceof StellarError) throw error;
      throw new StellarError(
        `Failed to create account: ${getErrorMessage(error)}`,
        StellarOperationErrorCode.BUILD_FAILED,
        { destination: params.destination },
      );
    }
  }

  /**
   * Get the balances for a Stellar account.
   * @param address - The Stellar public key.
   * @returns Array of asset balances.
   */
  async getBalances(address: string): Promise<Balance[]> {
    this.validateAddress(address);
    try {
      const server = new Horizon.Server(this.config.horizonUrl);
      const account = await server.loadAccount(address);
      return account.balances.map((b) => {
        const bal = b as { asset_type: string; asset_code?: string; asset_issuer?: string; balance: string };
        return {
          asset: bal.asset_type === 'native' ? 'native' : `${bal.asset_code}:${bal.asset_issuer}`,
          code: bal.asset_type === 'native' ? 'XLM' : bal.asset_code!,
          issuer: bal.asset_type === 'native' ? undefined : bal.asset_issuer,
          balance: bal.balance,
        };
      });
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new StellarError(
          `Account not found: ${address}`,
          StellarOperationErrorCode.ACCOUNT_NOT_FOUND,
          { address },
        );
      }
      throw new StellarError(
        `Failed to get balances: ${getErrorMessage(error)}`,
        StellarOperationErrorCode.ACCOUNT_NOT_FOUND,
        { address },
      );
    }
  }

  /**
   * Get full account info from Horizon.
   * @param address - The Stellar public key.
   * @returns Account information.
   */
  async getAccountInfo(address: string): Promise<AccountInfo> {
    this.validateAddress(address);
    try {
      const server = new Horizon.Server(this.config.horizonUrl);
      const account = await server.loadAccount(address);
      return {
        id: account.id,
        accountId: account.accountId(),
        sequence: account.sequenceNumber(),
        balances: account.balances.map((b) => {
          const bal = b as { asset_type: string; asset_code?: string; asset_issuer?: string; balance: string };
          return {
            asset: bal.asset_type === 'native' ? 'native' : `${bal.asset_code}:${bal.asset_issuer}`,
            code: bal.asset_type === 'native' ? 'XLM' : bal.asset_code!,
            issuer: bal.asset_type === 'native' ? undefined : bal.asset_issuer,
            balance: bal.balance,
          };
        }),
        signers: account.signers.map((s) => ({
          key: s.key,
          weight: s.weight,
          type: s.type,
        })),
        thresholds: {
          lowThreshold: account.thresholds.low_threshold,
          medThreshold: account.thresholds.med_threshold,
          highThreshold: account.thresholds.high_threshold,
        },
        flags: {
          authRequired: account.flags.auth_required,
          authRevocable: account.flags.auth_revocable,
          authImmutable: account.flags.auth_immutable,
          authClawbackEnabled: account.flags.auth_clawback_enabled,
        },
        data: account.data_attr as Record<string, string>,
      };
    } catch (error) {
      if (error instanceof StellarError) throw error;
      if (this.isNotFoundError(error)) {
        throw new StellarError(
          `Account not found: ${address}`,
          StellarOperationErrorCode.ACCOUNT_NOT_FOUND,
          { address },
        );
      }
      throw new StellarError(
        `Failed to get account info: ${getErrorMessage(error)}`,
        StellarOperationErrorCode.ACCOUNT_NOT_FOUND,
        { address },
      );
    }
  }

  /**
   * Set or delete a data entry on a Stellar account.
   * @param params - Manage data parameters.
   * @param wallet - Wallet to sign the transaction.
   * @returns Transaction result.
   */
  async manageData(
    params: ManageDataOperationParams,
    wallet: Wallet,
  ): Promise<TransactionResult> {
    this.validateAddress(params.sourceAccount);
    this.logger.info(`Managing data "${params.name}" on ${params.sourceAccount}`);

    try {
      return await this.helper.buildSignSubmit(
        params.sourceAccount,
        [
          Operation.manageData({
            name: params.name,
            value: params.value ?? null,
          }),
        ],
        wallet,
      );
    } catch (error) {
      if (error instanceof StellarError) throw error;
      throw new StellarError(
        `Failed to manage data: ${getErrorMessage(error)}`,
        StellarOperationErrorCode.MANAGE_DATA_FAILED,
        { name: params.name },
      );
    }
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

  private isNotFoundError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'response' in error) {
      const resp = error as { response?: { status?: number } };
      return resp.response?.status === 404;
    }
    return false;
  }
}
