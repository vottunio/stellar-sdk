import { NETWORK_PRESETS } from '../../../src/config/networks';

describe('Network Presets', () => {
  it('should have testnet preset', () => {
    expect(NETWORK_PRESETS.testnet).toBeDefined();
    expect(NETWORK_PRESETS.testnet.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    expect(NETWORK_PRESETS.testnet.sorobanRpcUrl).toBe('https://soroban-testnet.stellar.org');
    expect(NETWORK_PRESETS.testnet.networkPassphrase).toBe('Test SDF Network ; September 2015');
  });

  it('should have mainnet preset', () => {
    expect(NETWORK_PRESETS.mainnet).toBeDefined();
    expect(NETWORK_PRESETS.mainnet.horizonUrl).toBe('https://horizon.stellar.org');
    expect(NETWORK_PRESETS.mainnet.sorobanRpcUrl).toBe('https://soroban.stellar.org');
    expect(NETWORK_PRESETS.mainnet.networkPassphrase).toBe(
      'Public Global Stellar Network ; September 2015',
    );
  });
});
