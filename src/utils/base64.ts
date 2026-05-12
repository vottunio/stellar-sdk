/**
 * Isomorphic base64 encoding/decoding (3.1.10, 3.1.11).
 *
 * Works in:
 * - Node.js (via Buffer)
 * - Browsers (via atob/btoa)
 * - React Native (via global.btoa/atob when polyfilled, otherwise inline fallback)
 *
 * Use these helpers instead of `Buffer.from(...)` directly to keep wallet
 * encryption and other XDR-handling code cross-platform.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const hasBuffer = typeof (globalThis as any).Buffer !== 'undefined';
const hasBtoa = typeof (globalThis as any).btoa === 'function';
const hasAtob = typeof (globalThis as any).atob === 'function';
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Encode a Uint8Array (or array-like byte buffer) to a base64 string. */
export function bytesToBase64(bytes: Uint8Array): string {
  if (hasBuffer) {
    return (globalThis as { Buffer: { from(b: Uint8Array): { toString(enc: string): string } } })
      .Buffer.from(bytes)
      .toString('base64');
  }
  if (hasBtoa) {
    // Chunked conversion to avoid stack overflow on large inputs
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const slice = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...slice);
    }
    return (globalThis as { btoa(s: string): string }).btoa(binary);
  }
  // Last-resort fallback: manual implementation (RN without polyfill)
  return manualEncode(bytes);
}

/** Decode a base64 string to a Uint8Array. */
export function base64ToBytes(b64: string): Uint8Array {
  if (hasBuffer) {
    const buf = (globalThis as { Buffer: { from(s: string, enc: string): Uint8Array } })
      .Buffer.from(b64, 'base64');
    // Buffer extends Uint8Array; convert to a plain one for consumers
    return new Uint8Array(buf);
  }
  if (hasAtob) {
    const binary = (globalThis as { atob(s: string): string }).atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  return manualDecode(b64);
}

// ─── Manual fallback (small + correct, used only when neither Buffer nor btoa exists) ─────

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function manualEncode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 3 <= bytes.length; i += 3) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += ALPHABET[(v >> 18) & 0x3f];
    out += ALPHABET[(v >> 12) & 0x3f];
    out += ALPHABET[(v >> 6) & 0x3f];
    out += ALPHABET[v & 0x3f];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const v = bytes[i] << 16;
    out += ALPHABET[(v >> 18) & 0x3f] + ALPHABET[(v >> 12) & 0x3f] + '==';
  } else if (rem === 2) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      ALPHABET[(v >> 18) & 0x3f] +
      ALPHABET[(v >> 12) & 0x3f] +
      ALPHABET[(v >> 6) & 0x3f] +
      '=';
  }
  return out;
}

function manualDecode(b64: string): Uint8Array {
  const lookup = new Int8Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) lookup[ALPHABET.charCodeAt(i)] = i;

  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const len = (clean.length * 3) / 4 - padding;
  const out = new Uint8Array(len);

  let outIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = lookup[clean.charCodeAt(i)];
    const c1 = lookup[clean.charCodeAt(i + 1)];
    const c2 = clean.charCodeAt(i + 2) === 61 ? 0 : lookup[clean.charCodeAt(i + 2)];
    const c3 = clean.charCodeAt(i + 3) === 61 ? 0 : lookup[clean.charCodeAt(i + 3)];

    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (outIndex < len) out[outIndex++] = (triple >> 16) & 0xff;
    if (outIndex < len) out[outIndex++] = (triple >> 8) & 0xff;
    if (outIndex < len) out[outIndex++] = triple & 0xff;
  }
  return out;
}
