import { ConfigManager } from '../../../src/config/ConfigManager';
import { TransactionTracker } from '../../../src/transaction/TransactionTracker';

describe('TransactionTracker', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();

  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be instantiable with config', () => {
    const tracker = new TransactionTracker(config);
    expect(tracker).toBeDefined();
  });
});
