import { ConfigManager } from '../../../src/config/ConfigManager';
import { FeeEstimator } from '../../../src/transaction/FeeEstimator';

describe('FeeEstimator', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();

  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be instantiable with config', () => {
    const estimator = new FeeEstimator(config);
    expect(estimator).toBeDefined();
  });
});
