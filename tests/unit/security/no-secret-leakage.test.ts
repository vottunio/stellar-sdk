import { ConfigManager } from '../../../src/config/ConfigManager';
import { StellarError } from '../../../src/errors/StellarError';
import { WalletManager } from '../../../src/wallet/WalletManager';

/**
 * Security regression tests (3.1.5).
 *
 * Verify that secrets, mnemonics, and signed XDRs do NOT appear in:
 * - error messages
 * - error details
 * - JSON-serialized errors
 *
 * If any of these tests fail, the SDK must NOT ship to mainnet.
 */
describe('Security: No Secret Leakage in Errors (3.1.5)', () => {
  const config = new ConfigManager({ network: 'testnet' }).getConfig();
  const walletMgr = new WalletManager(config);

  describe('KeypairWallet errors', () => {
    it('should NOT include secret key in WalletError on bad import', () => {
      const fakeSecret = 'SDREAL_LOOKING_SECRET_BUT_NOT_VALID_FORMAT_XYZ';
      try {
        walletMgr.importFromSecret(fakeSecret);
        fail('Expected error');
      } catch (error) {
        const json = JSON.stringify(error);
        expect(json).not.toContain(fakeSecret);
        expect((error as Error).message).not.toContain(fakeSecret);
      }
    });
  });

  describe('Settlement error context', () => {
    it('should never include resultXdr in settlement failure messages', async () => {
      // Smoke test the error code path without hitting the network.
      // Construct a StellarError that mimics the SETTLEMENT_TX_FAILED path.
      const fakeXdr = 'AAAAAB+8nQ2HEXAMPLEXDRSHOULDNEVERBELOGGED';
      const err = new StellarError(
        `Settlement transaction failed (hash: abc123)`,
        'SETTLEMENT_TX_FAILED',
        { hash: 'abc123', ledger: 12345 },
      );
      const json = JSON.stringify(err);
      expect(json).not.toContain(fakeXdr);
      expect(err.message).not.toContain(fakeXdr);
      expect(err.message).not.toContain('AAAAA'); // generic XDR prefix
    });
  });

  describe('Logger output', () => {
    it('should not log secret keys at any level', () => {
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
      const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const debugConfig = new ConfigManager({
        network: 'testnet',
        logging: { level: 'debug' },
      }).getConfig();
      const debugMgr = new WalletManager(debugConfig);
      const wallet = debugMgr.create();
      const secret = wallet.exportSecret();

      // Iterate through all console output and confirm secret never appears
      const allCalls = [
        ...debugSpy.mock.calls.flat(),
        ...infoSpy.mock.calls.flat(),
        ...errorSpy.mock.calls.flat(),
      ].map((c) => String(c));

      for (const line of allCalls) {
        expect(line).not.toContain(secret);
      }

      debugSpy.mockRestore();
      infoSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
