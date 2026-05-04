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

const mockFeeStats = {
  last_ledger: '12345',
  last_ledger_base_fee: '100',
  ledger_capacity_usage: '0.35',
  fee_charged: {
    max: '10000',
    min: '100',
    mode: '100',
    p10: '100',
    p20: '100',
    p30: '100',
    p40: '100',
    p50: '200',
    p60: '300',
    p70: '500',
    p80: '1000',
    p90: '5000',
    p95: '8000',
    p99: '10000',
  },
  max_fee: {
    max: '100000',
    min: '100',
    mode: '100',
    p10: '100',
    p20: '200',
    p30: '300',
    p40: '400',
    p50: '500',
    p60: '1000',
    p70: '5000',
    p80: '10000',
    p90: '50000',
    p95: '80000',
    p99: '100000',
  },
};

describe('FeeEstimator — Dynamic Fee Escalation (3.1.2)', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();

  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});

    (Horizon.Server as unknown as jest.Mock).mockImplementation(() => ({
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      feeStats: jest.fn().mockResolvedValue(mockFeeStats),
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('estimateDynamic', () => {
    it('should return p50 fee for medium strategy (default)', async () => {
      const estimator = new FeeEstimator(config);
      const result = await estimator.estimateDynamic(1);

      expect(result.strategy).toBe('medium');
      expect(result.baseFee).toBe('100');
      expect(result.estimatedFee).toBe('200'); // p50 = 200
      expect(result.operationCount).toBe(1);
      expect(result.capacityUsage).toBe(0.35);
    });

    it('should return p10 fee for low strategy', async () => {
      const estimator = new FeeEstimator(config);
      const result = await estimator.estimateDynamic(1, 'low');

      expect(result.strategy).toBe('low');
      expect(result.estimatedFee).toBe('100'); // p10 = 100
    });

    it('should return p90 fee for high strategy', async () => {
      const estimator = new FeeEstimator(config);
      const result = await estimator.estimateDynamic(1, 'high');

      expect(result.strategy).toBe('high');
      expect(result.estimatedFee).toBe('5000'); // p90 = 5000
    });

    it('should return p99 fee for aggressive strategy', async () => {
      const estimator = new FeeEstimator(config);
      const result = await estimator.estimateDynamic(1, 'aggressive');

      expect(result.strategy).toBe('aggressive');
      expect(result.estimatedFee).toBe('10000'); // p99 = 10000
    });

    it('should multiply fee by operation count', async () => {
      const estimator = new FeeEstimator(config);
      const result = await estimator.estimateDynamic(3, 'medium');

      expect(result.estimatedFee).toBe('600'); // 200 * 3
      expect(result.operationCount).toBe(3);
    });

    it('should clamp to minimum 1 operation', async () => {
      const estimator = new FeeEstimator(config);
      const result = await estimator.estimateDynamic(0, 'medium');

      expect(result.operationCount).toBe(1);
      expect(result.estimatedFee).toBe('200');
    });

    it('should ensure fee is at least the base fee', async () => {
      // Simulate a scenario where the percentile fee is less than base fee
      const lowFeeStats = {
        ...mockFeeStats,
        last_ledger_base_fee: '500',
        fee_charged: { ...mockFeeStats.fee_charged, p10: '50' },
      };

      (Horizon.Server as unknown as jest.Mock).mockImplementation(() => ({
        feeStats: jest.fn().mockResolvedValue(lowFeeStats),
      }));

      const estimator = new FeeEstimator(config);
      const result = await estimator.estimateDynamic(1, 'low');

      // Should use base fee (500) since p10 (50) < base fee (500)
      expect(result.estimatedFee).toBe('500');
    });

    it('should include capacity usage in result', async () => {
      const estimator = new FeeEstimator(config);
      const result = await estimator.estimateDynamic(1);

      expect(result.capacityUsage).toBe(0.35);
    });
  });

  describe('suggestStrategy', () => {
    it('should suggest "low" for low capacity (<25%)', async () => {
      const lowCapacityStats = { ...mockFeeStats, ledger_capacity_usage: '0.10' };
      (Horizon.Server as unknown as jest.Mock).mockImplementation(() => ({
        feeStats: jest.fn().mockResolvedValue(lowCapacityStats),
      }));

      const estimator = new FeeEstimator(config);
      const { strategy, capacityUsage } = await estimator.suggestStrategy();

      expect(strategy).toBe('low');
      expect(capacityUsage).toBe(0.10);
    });

    it('should suggest "medium" for normal capacity (25-50%)', async () => {
      const normalStats = { ...mockFeeStats, ledger_capacity_usage: '0.35' };
      (Horizon.Server as unknown as jest.Mock).mockImplementation(() => ({
        feeStats: jest.fn().mockResolvedValue(normalStats),
      }));

      const estimator = new FeeEstimator(config);
      const { strategy } = await estimator.suggestStrategy();
      expect(strategy).toBe('medium');
    });

    it('should suggest "high" for congested capacity (50-90%)', async () => {
      const congestedStats = { ...mockFeeStats, ledger_capacity_usage: '0.75' };
      (Horizon.Server as unknown as jest.Mock).mockImplementation(() => ({
        feeStats: jest.fn().mockResolvedValue(congestedStats),
      }));

      const estimator = new FeeEstimator(config);
      const { strategy } = await estimator.suggestStrategy();
      expect(strategy).toBe('high');
    });

    it('should suggest "aggressive" for near-full capacity (>90%)', async () => {
      const fullStats = { ...mockFeeStats, ledger_capacity_usage: '0.95' };
      (Horizon.Server as unknown as jest.Mock).mockImplementation(() => ({
        feeStats: jest.fn().mockResolvedValue(fullStats),
      }));

      const estimator = new FeeEstimator(config);
      const { strategy } = await estimator.suggestStrategy();
      expect(strategy).toBe('aggressive');
    });
  });

  describe('backward compatibility', () => {
    it('basic estimate() should still work unchanged', async () => {
      const estimator = new FeeEstimator(config);
      const result = await estimator.estimate(2);

      expect(result).toEqual({
        baseFee: '100',
        estimatedFee: '200',
        operationCount: 2,
      });
    });
  });
});
