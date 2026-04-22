import { ApiClient } from './api/ApiClient';
import { ExternalClientFactory, ExternalClientOptions } from './api/ExternalClientFactory';
import { HorizonClient } from './api/HorizonClient';
import { SorobanRpcClient } from './api/SorobanRpcClient';
import { ConfigManager } from './config/ConfigManager';
import { StellarClient } from './stellar/StellarClient';
import { SorobanService } from './stellar/SorobanService';
import { WirexTransactionBuilder } from './transaction/TransactionBuilder';
import { TransactionTracker } from './transaction/TransactionTracker';
import { FeeEstimator } from './transaction/FeeEstimator';
import { WirexSDKConfig, ResolvedConfig, NetworkType } from './types/config.types';
import { TransactionBuilderOptions } from './types/transaction.types';
import { WalletManager } from './wallet/WalletManager';
import { WebSocketClient } from './websocket/WebSocketClient';

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

// Re-export stellar
export { StellarClient, AccountService, AssetService, PaymentService, SorobanService, StreamingService, TransactionHelper } from './stellar';

// Re-export api
export { ApiClient, HorizonClient, SorobanRpcClient, ExternalClientFactory, ResponseMapper, ErrorMapper } from './api';

// Re-export websocket
export { WebSocketClient, EventRouter, ReconnectionManager } from './websocket';

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
  private sorobanService: SorobanService | null = null;
  private stellarClient: StellarClient | null = null;
  private horizonClient: HorizonClient | null = null;
  private sorobanRpcClient: SorobanRpcClient | null = null;
  private webSocketClient: WebSocketClient | null = null;

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
    // Reset all service instances so they pick up the new config on next access
    this.walletManager = null;
    this.stellarClient = null;
    this.horizonClient = null;
    this.sorobanRpcClient = null;
    if (this.webSocketClient) {
      this.webSocketClient.disconnect();
      this.webSocketClient = null;
    }
    if (this.sorobanService) {
      this.sorobanService.reconnect(this.configManager.getConfig());
    }
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

  /** Soroban smart contract interaction service. */
  get soroban(): SorobanService {
    if (!this.sorobanService) {
      this.sorobanService = new SorobanService(this.configManager.getConfig());
    }
    return this.sorobanService;
  }

  /** Stellar blockchain interaction — accounts, payments, assets, Soroban. */
  get stellar(): StellarClient {
    if (!this.stellarClient) {
      this.stellarClient = new StellarClient(this.configManager.getConfig());
    }
    return this.stellarClient;
  }

  /** API clients for Horizon REST, Soroban RPC, and external partner APIs. */
  get api(): {
    horizon: HorizonClient;
    soroban: SorobanRpcClient;
    external: (baseUrl: string, options?: ExternalClientOptions) => ApiClient;
  } {
    if (!this.horizonClient) {
      this.horizonClient = new HorizonClient(this.configManager.getConfig());
    }
    if (!this.sorobanRpcClient) {
      this.sorobanRpcClient = new SorobanRpcClient(this.configManager.getConfig());
    }
    const factory = new ExternalClientFactory(this.configManager.getConfig());
    return {
      horizon: this.horizonClient,
      soroban: this.sorobanRpcClient,
      external: (baseUrl: string, options?: ExternalClientOptions) => factory.create(baseUrl, options),
    };
  }

  /** WebSocket client for real-time event streaming. */
  get websocket(): WebSocketClient {
    if (!this.webSocketClient) {
      this.webSocketClient = new WebSocketClient(this.configManager.getConfig());
    }
    return this.webSocketClient;
  }

  // Phase 2.5: Reference Integration
  // get reference(): WirexPaymentFlow { ... }
}
