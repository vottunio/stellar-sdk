import { ConfigManager } from './config/ConfigManager';
import { WirexSDKConfig, ResolvedConfig, NetworkType } from './types/config.types';

// Re-export all types
export * from './types';

// Re-export all errors
export * from './errors';

// Re-export config
export { ConfigManager, NETWORK_PRESETS, DEFAULT_LOGGING, DEFAULT_TIMEOUT, DEFAULT_RETRY } from './config';

/**
 * Main SDK class — entry point for all Wirex Stellar SDK functionality.
 *
 * @example
 * ```typescript
 * import { WirexSDK } from '@wirex/stellar-sdk';
 *
 * const sdk = new WirexSDK({ network: 'testnet' });
 * ```
 */
export class WirexSDK {
  private readonly configManager: ConfigManager;

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
  }

  // --- Module accessors (scaffolded, implemented in later phases) ---

  // Phase 1.2: Wallet Management
  // get wallet(): WalletManager { ... }

  // Phase 1.3: Transaction Lifecycle
  // transaction(): TransactionBuilder { ... }

  // Phase 2.1-2.2: Stellar Blockchain Interaction
  // get stellar(): StellarClient { ... }

  // Phase 2.3: API Client
  // get api(): ApiClient { ... }

  // Phase 2.4: WebSocket & Streaming
  // get websocket(): WebSocketClient { ... }

  // Phase 2.5: Reference Integration
  // get reference(): WirexPaymentFlow { ... }
}
