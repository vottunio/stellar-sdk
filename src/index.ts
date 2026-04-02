import { ConfigManager } from './config/ConfigManager';
import { WirexTransactionBuilder } from './transaction/TransactionBuilder';
import { TransactionTracker } from './transaction/TransactionTracker';
import { FeeEstimator } from './transaction/FeeEstimator';
import { WirexSDKConfig, ResolvedConfig, NetworkType } from './types/config.types';
import { TransactionBuilderOptions } from './types/transaction.types';
import { WalletManager } from './wallet/WalletManager';

// Re-export all types
export * from './types';

// Re-export all errors
export * from './errors';

// Re-export config
export { ConfigManager, Logger, NETWORK_PRESETS, DEFAULT_LOGGING, DEFAULT_TIMEOUT, DEFAULT_RETRY } from './config';

// Re-export wallet
export { WalletManager, KeypairWallet, HDWallet, ExternalWallet } from './wallet';

// Re-export transaction
export { WirexTransactionBuilder, TransactionSubmitter, FeeEstimator, TransactionTracker } from './transaction';

/**
 * Main SDK class — entry point for all Wirex Stellar SDK functionality.
 *
 * @example
 * ```typescript
 * import { WirexSDK } from '@wirex/stellar-sdk';
 *
 * const sdk = new WirexSDK({ network: 'testnet' });
 * const wallet = sdk.wallet.create();
 * const result = await sdk.transaction({ sourceAccount: wallet.publicKey })
 *   .addPayment({ destination: 'G...', asset: { code: 'XLM' }, amount: '10' })
 *   .sign(wallet)
 *   .submit();
 * ```
 */
export class WirexSDK {
  private readonly configManager: ConfigManager;
  private walletManager: WalletManager | null = null;

  constructor(config: WirexSDKConfig) {
    this.configManager = new ConfigManager(config);
  }

  /** Get the current resolved configuration. */
  get config(): Readonly<ResolvedConfig> {
    return this.configManager.getConfig();
  }

  /** Hot-switch the active Stellar network. */
  setNetwork(network: NetworkType): void {
    this.configManager.setNetwork(network);
    this.walletManager = null; // reset so it picks up new config
  }

  /** Wallet management — create, import, connect wallets. */
  get wallet(): WalletManager {
    if (!this.walletManager) {
      this.walletManager = new WalletManager(this.configManager.getConfig());
    }
    return this.walletManager;
  }

  /** Create a new transaction builder with fluent API. */
  transaction(options: TransactionBuilderOptions): WirexTransactionBuilder {
    return new WirexTransactionBuilder(this.configManager.getConfig(), options);
  }

  /** Estimate fees for a transaction with a given number of operations. */
  async estimateFees(operationCount = 1) {
    const estimator = new FeeEstimator(this.configManager.getConfig());
    return estimator.estimate(operationCount);
  }

  /** Track a submitted transaction by hash. */
  trackTransaction(hash: string) {
    const tracker = new TransactionTracker(this.configManager.getConfig());
    return tracker.waitForConfirmation(hash);
  }

  // --- Module accessors (scaffolded, implemented in later tranches) ---

  // Phase 2.1-2.2: Stellar Blockchain Interaction
  // get stellar(): StellarClient { ... }

  // Phase 2.3: API Client
  // get api(): ApiClient { ... }

  // Phase 2.4: WebSocket & Streaming
  // get websocket(): WebSocketClient { ... }

  // Phase 2.5: Reference Integration
  // get reference(): WirexPaymentFlow { ... }
}
