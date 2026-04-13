import { Asset } from '@stellar/stellar-sdk';

import { ResolvedConfig } from '../types/config.types';
import {
  StellarChangeTrustParams,
  ClaimClaimableBalanceParams,
  StellarCreateAccountParams,
  CreateClaimableBalanceParams,
  ManageDataOperationParams,
  StellarPathPaymentStrictReceiveParams,
  StellarPathPaymentStrictSendParams,
  StellarSendPaymentParams,
  SponsoredOperationParams,
  AccountInfo,
} from '../types/stellar.types';
import { TransactionResult } from '../types/transaction.types';
import { Balance, Wallet } from '../types/wallet.types';

import { AccountService } from './AccountService';
import { AssetService } from './AssetService';
import { PaymentService } from './PaymentService';
import { SorobanService } from './SorobanService';

/**
 * Unified Stellar client — facade providing access to all Stellar
 * blockchain interaction services (accounts, assets, payments, Soroban).
 *
 * Accessed via `sdk.stellar`.
 *
 * @example
 * ```typescript
 * const sdk = new WirexSDK({ network: 'testnet' });
 *
 * // Account operations
 * const exists = await sdk.stellar.accountExists('G...');
 * await sdk.stellar.fundTestAccount('G...');
 *
 * // Payments
 * await sdk.stellar.sendPayment(
 *   { sourceAccount: 'G...', destination: 'G...', asset: { code: 'XLM' }, amount: '10' },
 *   wallet,
 * );
 *
 * // Trustlines
 * await sdk.stellar.changeTrust(
 *   { sourceAccount: 'G...', asset: { code: 'USDC', issuer: 'G...' } },
 *   wallet,
 * );
 *
 * // Asset helpers
 * const xlm = sdk.stellar.Asset.native();
 * ```
 */
export class StellarClient {
  private readonly accountService: AccountService;
  private readonly assetService: AssetService;
  private readonly paymentService: PaymentService;
  private readonly sorobanService: SorobanService;

  constructor(config: ResolvedConfig) {
    this.accountService = new AccountService(config);
    this.assetService = new AssetService(config);
    this.paymentService = new PaymentService(config);
    this.sorobanService = new SorobanService(config);
  }

  // ─── Asset Wrapper (2.2.12) ────────────────────────────────────────────────

  /**
   * Asset factory — create native or custom Stellar assets.
   */
  Asset = {
    /** Create a native XLM asset. */
    native: (): Asset => AssetService.nativeAsset(),
    /** Create a custom asset with code and issuer. */
    custom: (code: string, issuer: string): Asset => AssetService.customAsset(code, issuer),
  };

  // ─── Account Operations ────────────────────────────────────────────────────

  /** Check if an account exists on-chain. */
  async accountExists(address: string): Promise<boolean> {
    return this.accountService.accountExists(address);
  }

  /** Fund an account on testnet via Friendbot. */
  async fundTestAccount(address: string): Promise<void> {
    return this.accountService.fundTestAccount(address);
  }

  /** Create a new account on-chain. */
  async createAccount(params: StellarCreateAccountParams, wallet: Wallet): Promise<TransactionResult> {
    return this.accountService.createAccount(params, wallet);
  }

  /** Get balances for an account. */
  async getBalances(address: string): Promise<Balance[]> {
    return this.accountService.getBalances(address);
  }

  /** Get full account info from Horizon. */
  async getAccountInfo(address: string): Promise<AccountInfo> {
    return this.accountService.getAccountInfo(address);
  }

  /** Set or delete a data entry on an account. */
  async manageData(params: ManageDataOperationParams, wallet: Wallet): Promise<TransactionResult> {
    return this.accountService.manageData(params, wallet);
  }

  // ─── Payment Operations ────────────────────────────────────────────────────

  /** Send a payment (XLM or any asset). */
  async sendPayment(params: StellarSendPaymentParams, wallet: Wallet): Promise<TransactionResult> {
    return this.paymentService.sendPayment(params, wallet);
  }

  /** Path payment strict send. */
  async pathPaymentStrictSend(params: StellarPathPaymentStrictSendParams, wallet: Wallet): Promise<TransactionResult> {
    return this.paymentService.pathPaymentStrictSend(params, wallet);
  }

  /** Path payment strict receive. */
  async pathPaymentStrictReceive(params: StellarPathPaymentStrictReceiveParams, wallet: Wallet): Promise<TransactionResult> {
    return this.paymentService.pathPaymentStrictReceive(params, wallet);
  }

  // ─── Asset / Trust Operations ──────────────────────────────────────────────

  /** Add, modify, or remove a trustline. */
  async changeTrust(params: StellarChangeTrustParams, wallet: Wallet): Promise<TransactionResult> {
    return this.assetService.changeTrust(params, wallet);
  }

  /** Create a claimable balance. */
  async createClaimableBalance(params: CreateClaimableBalanceParams, wallet: Wallet): Promise<TransactionResult> {
    return this.assetService.createClaimableBalance(params, wallet);
  }

  /** Claim a claimable balance. */
  async claimClaimableBalance(params: ClaimClaimableBalanceParams, wallet: Wallet): Promise<TransactionResult> {
    return this.assetService.claimClaimableBalance(params, wallet);
  }

  /** Execute operations under sponsorship (begin + ops + end). */
  async sponsoredOperation(
    params: SponsoredOperationParams,
    operations: ReturnType<typeof import('@stellar/stellar-sdk').Operation.payment>[],
    wallet: Wallet,
  ): Promise<TransactionResult> {
    return this.assetService.sponsoredOperation(params, operations, wallet);
  }

  // ─── Soroban Access ────────────────────────────────────────────────────────

  /** Access the Soroban smart contract service. */
  get soroban(): SorobanService {
    return this.sorobanService;
  }
}
