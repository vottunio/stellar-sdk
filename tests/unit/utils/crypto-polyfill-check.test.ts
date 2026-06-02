import nacl from 'tweetnacl';

import {
  CryptoPolyfillError,
  ensureSecureRandom,
  _resetCryptoPolyfillProbe,
} from '../../../src/utils/crypto-polyfill-check';

describe('Crypto Polyfill Check (3.1.11)', () => {
  afterEach(() => {
    _resetCryptoPolyfillProbe();
    jest.restoreAllMocks();
  });

  it('should not throw when a CSPRNG is available (Node 14+ / browsers)', () => {
    expect(() => ensureSecureRandom()).not.toThrow();
  });

  it('should throw CryptoPolyfillError if tweetnacl.randomBytes fails', () => {
    jest.spyOn(nacl, 'randomBytes').mockImplementation(() => {
      throw new Error('no PRNG');
    });
    expect(() => ensureSecureRandom()).toThrow(CryptoPolyfillError);
    expect(() => ensureSecureRandom()).toThrow(/no PRNG/);
  });

  it('error message includes React Native install instructions', () => {
    jest.spyOn(nacl, 'randomBytes').mockImplementation(() => {
      throw new Error('boom');
    });

    try {
      ensureSecureRandom();
      fail('expected throw');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('react-native-get-random-values');
      expect(msg).toContain('npm install');
      expect(msg).toContain('import');
    }
  });

  it('caches success so subsequent calls are no-ops', () => {
    const spy = jest.spyOn(nacl, 'randomBytes');
    ensureSecureRandom();
    ensureSecureRandom();
    ensureSecureRandom();
    // Only the first call should probe; subsequent calls are cached
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
