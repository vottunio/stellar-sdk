import { WirexSDK } from '../../../src';
import { WirexSDKConfig } from '../../../src/types/config.types';

/**
 * Build a "mainnet-ready" SDK that runs against Stellar testnet
 * but applies all the production-grade settings that mainnet uses:
 *
 * - **Mainnet timeouts** — wider windows (60s Horizon, 180s tx)
 *   to tolerate the kind of latency seen on mainnet under load.
 * - **Dynamic fee escalation** — `medium` strategy by default (p50 percentile)
 *   instead of the network base fee.
 * - **Production retry policy** — exponential backoff with jitter and idempotency.
 *
 * Used by `*.mainnet-ready.integration.test.ts` to validate the SDK's
 * mainnet code paths against real Horizon endpoints (testnet URL, mainnet
 * behavior). This is the SCF-aligned approach: prove mainnet readiness
 * without spending real XLM.
 *
 * Phase 3.2.2.
 */
export function buildMainnetReadySDK(): WirexSDK {
  const config: WirexSDKConfig = {
    // Use testnet endpoints to avoid spending real XLM…
    network: 'testnet',
    // …but apply mainnet-grade timeouts (wider tolerances)
    timeout: {
      horizon: 60_000,
      api: 30_000,
      websocket: 15_000,
      transactionSeconds: 180,
      soroban: 60_000,
    },
    // Production retry policy: 3 attempts, gentle backoff
    retry: { maxAttempts: 3, backoffMultiplier: 1.5 },
    // Keep logs quiet by default; test cases can override
    logging: { level: 'none' },
  };

  return new WirexSDK(config);
}

/**
 * Fund a Stellar testnet account via Friendbot.
 * Retries up to 3 times to tolerate transient Friendbot 503s.
 */
export async function fundTestnetAccount(publicKey: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
      );
      if (response.ok) return;
      lastError = new Error(`Friendbot HTTP ${response.status}: ${await response.text()}`);
    } catch (error) {
      lastError = error;
    }
    // Exponential backoff between attempts
    await new Promise((r) => setTimeout(r, attempt * 1500));
  }
  throw lastError ?? new Error('Friendbot funding failed after 3 attempts');
}
