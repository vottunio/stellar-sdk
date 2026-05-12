import nacl from 'tweetnacl';

/**
 * Runtime polyfill validation for React Native compatibility (3.1.11).
 *
 * Several crypto primitives in this SDK depend on a CSPRNG:
 * - `tweetnacl.randomBytes()` (wallet encryption nonce + salt)
 * - `Keypair.random()` (Stellar SDK random keypair generation)
 *
 * **Node.js** and **modern browsers** provide this natively (Node ≥ 14 via
 * `crypto.randomBytes`; browsers via `crypto.getRandomValues`).
 *
 * **React Native** does NOT — it must be polyfilled via
 *   `import 'react-native-get-random-values'`
 * BEFORE any wallet operations.
 *
 * `tweetnacl.randomBytes()` auto-detects either source. We use it as the probe,
 * then surface a descriptive error if it fails — typical RN-without-polyfill
 * symptom is tweetnacl throwing "no PRNG".
 */

export class CryptoPolyfillError extends Error {
  constructor(originalMessage?: string) {
    super(
      'Cryptographically secure random number generator unavailable.\n\n' +
      'On React Native, you must install and import a polyfill BEFORE using ' +
      'any wallet methods:\n\n' +
      '  npm install react-native-get-random-values\n' +
      "  import 'react-native-get-random-values'; // at the top of your entry file\n\n" +
      'On Node.js (≥14) and modern browsers, this should work out of the box. ' +
      'If you see this error in those environments, please file a bug report.' +
      (originalMessage ? `\n\nUnderlying error: ${originalMessage}` : ''),
    );
    this.name = 'CryptoPolyfillError';
  }
}

let probed = false;

/**
 * Verify that a CSPRNG is available. Throws `CryptoPolyfillError` with
 * installation instructions if not. Caches the success path so subsequent
 * calls are essentially free.
 */
export function ensureSecureRandom(): void {
  if (probed) return;
  try {
    nacl.randomBytes(1);
    probed = true;
  } catch (error) {
    throw new CryptoPolyfillError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** Reset the probe cache. For tests only. */
export function _resetCryptoPolyfillProbe(): void {
  probed = false;
}
