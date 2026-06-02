import { base64ToBytes, bytesToBase64 } from '../../../src/utils/base64';

/**
 * Isomorphic base64 tests (3.1.10 / 3.1.11).
 *
 * In the Jest/Node environment, the helper uses Buffer. The manual fallback
 * path is tested by temporarily hiding Buffer.
 */
describe('base64 helpers (browser/RN compatibility)', () => {
  describe('round-trip encoding', () => {
    it('should round-trip an empty buffer', () => {
      const bytes = new Uint8Array(0);
      const b64 = bytesToBase64(bytes);
      expect(b64).toBe('');
      const back = base64ToBytes(b64);
      expect(back.length).toBe(0);
    });

    it('should round-trip a single byte', () => {
      const bytes = new Uint8Array([0xab]);
      const b64 = bytesToBase64(bytes);
      const back = base64ToBytes(b64);
      expect(Array.from(back)).toEqual([0xab]);
    });

    it('should round-trip arbitrary bytes', () => {
      const bytes = new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]);
      const b64 = bytesToBase64(bytes);
      const back = base64ToBytes(b64);
      expect(Array.from(back)).toEqual(Array.from(bytes));
    });

    it('should produce canonical base64 with padding', () => {
      // "Man" -> "TWFu"
      const bytes = new TextEncoder().encode('Man');
      expect(bytesToBase64(bytes)).toBe('TWFu');

      // "Ma" -> "TWE="
      const bytes2 = new TextEncoder().encode('Ma');
      expect(bytesToBase64(bytes2)).toBe('TWE=');

      // "M" -> "TQ=="
      const bytes3 = new TextEncoder().encode('M');
      expect(bytesToBase64(bytes3)).toBe('TQ==');
    });

    it('should round-trip 1KB of random data', () => {
      const bytes = new Uint8Array(1024);
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
      const back = base64ToBytes(bytesToBase64(bytes));
      expect(Array.from(back)).toEqual(Array.from(bytes));
    });
  });

  describe('decode standard test vectors', () => {
    it('should decode "TWFu" to "Man"', () => {
      const bytes = base64ToBytes('TWFu');
      expect(new TextDecoder().decode(bytes)).toBe('Man');
    });

    it('should decode "SGVsbG8sIFdvcmxkIQ==" to "Hello, World!"', () => {
      const bytes = base64ToBytes('SGVsbG8sIFdvcmxkIQ==');
      expect(new TextDecoder().decode(bytes)).toBe('Hello, World!');
    });
  });

  describe('browser path (btoa/atob, no Buffer)', () => {
    let savedBuffer: unknown;

    beforeEach(() => {
      const g = globalThis as Record<string, unknown>;
      savedBuffer = g.Buffer;
      // Hide Buffer to force the browser/atob path
      delete g.Buffer;
      // Provide btoa/atob if missing (Node 16 doesn't have them globally)
      if (typeof g.btoa !== 'function') {
        g.btoa = (s: string) => Buffer.from(s, 'binary').toString('base64');
      }
      if (typeof g.atob !== 'function') {
        g.atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary');
      }
    });

    afterEach(() => {
      const g = globalThis as Record<string, unknown>;
      g.Buffer = savedBuffer;
    });

    it('should round-trip via btoa/atob when Buffer is missing', () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252, 253, 254, 255]);
      const b64 = bytesToBase64(bytes);
      expect(b64).toBe('AQIDBAX6+/z9/v8=');
      const back = base64ToBytes(b64);
      expect(Array.from(back)).toEqual(Array.from(bytes));
    });

    it('should handle large buffers via chunked btoa', () => {
      // 64KB — exceeds the 0x8000 chunk size, exercising the chunking loop
      const bytes = new Uint8Array(64 * 1024);
      for (let i = 0; i < bytes.length; i++) bytes[i] = i & 0xff;
      const b64 = bytesToBase64(bytes);
      const back = base64ToBytes(b64);
      expect(back.length).toBe(bytes.length);
      expect(back[0]).toBe(0);
      expect(back[255]).toBe(255);
      expect(back[bytes.length - 1]).toBe(bytes[bytes.length - 1]);
    });
  });

  describe('manual fallback path (no Buffer, no btoa/atob)', () => {
    let savedBuffer: unknown;
    let savedBtoa: unknown;
    let savedAtob: unknown;

    beforeEach(() => {
      const g = globalThis as Record<string, unknown>;
      savedBuffer = g.Buffer;
      savedBtoa = g.btoa;
      savedAtob = g.atob;
      delete g.Buffer;
      delete g.btoa;
      delete g.atob;
    });

    afterEach(() => {
      const g = globalThis as Record<string, unknown>;
      g.Buffer = savedBuffer;
      g.btoa = savedBtoa;
      g.atob = savedAtob;
    });

    it('should round-trip arbitrary bytes', () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252, 253, 254, 255]);
      const b64 = bytesToBase64(bytes);
      expect(b64).toBe('AQIDBAX6+/z9/v8=');
      const back = base64ToBytes(b64);
      expect(Array.from(back)).toEqual(Array.from(bytes));
    });

    it('should handle remainder of 1 byte (single == padding)', () => {
      const bytes = new TextEncoder().encode('M');
      expect(bytesToBase64(bytes)).toBe('TQ==');
    });

    it('should handle remainder of 2 bytes (single = padding)', () => {
      const bytes = new TextEncoder().encode('Ma');
      expect(bytesToBase64(bytes)).toBe('TWE=');
    });

    it('should decode strings with whitespace gracefully', () => {
      // Manual decoder strips non-base64 chars first
      const bytes = base64ToBytes('TWFu\n');
      expect(new TextDecoder().decode(bytes)).toBe('Man');
    });

    it('should round-trip 256 bytes (every byte value 0-255)', () => {
      const bytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) bytes[i] = i;
      const back = base64ToBytes(bytesToBase64(bytes));
      expect(Array.from(back)).toEqual(Array.from(bytes));
    });
  });
});
