import { Horizon } from '@stellar/stellar-sdk';

import { ConfigManager } from '../../../src/config/ConfigManager';
import { FeeEstimator } from '../../../src/transaction/FeeEstimator';

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: jest.fn(),
    },
  };
});

describe('FeeEstimator', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();

  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});

    (Horizon.Server as unknown as jest.Mock).mockImplementation(() => ({
      fetchBaseFee: jest.fn().mockResolvedValue(100),
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be instantiable with config', () => {
    const estimator = new FeeEstimator(config);
    expect(estimator).toBeDefined();
  });

  it('should estimate fee for a single operation', async () => {
    const estimator = new FeeEstimator(config);
    const result = await estimator.estimate(1);

    expect(result).toEqual({
      baseFee: '100',
      estimatedFee: '100',
      operationCount: 1,
    });
  });

  it('should estimate fee for multiple operations', async () => {
    const estimator = new FeeEstimator(config);
    const result = await estimator.estimate(5);

    expect(result).toEqual({
      baseFee: '100',
      estimatedFee: '500',
      operationCount: 5,
    });
  });

  it('should default to 1 operation when called with no arguments', async () => {
    const estimator = new FeeEstimator(config);
    const result = await estimator.estimate();

    expect(result.operationCount).toBe(1);
    expect(result.estimatedFee).toBe('100');
  });

  it('should clamp to minimum 1 operation for zero count', async () => {
    const estimator = new FeeEstimator(config);
    const result = await estimator.estimate(0);

    expect(result.operationCount).toBe(1);
  });

  it('should handle higher base fees', async () => {
    (Horizon.Server as unknown as jest.Mock).mockImplementation(() => ({
      fetchBaseFee: jest.fn().mockResolvedValue(500),
    }));

    const estimator = new FeeEstimator(config);
    const result = await estimator.estimate(3);

    expect(result).toEqual({
      baseFee: '500',
      estimatedFee: '1500',
      operationCount: 3,
    });
  });
});
