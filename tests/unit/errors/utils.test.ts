import { getErrorMessage, truncate } from '../../../src/errors/utils';

describe('getErrorMessage (3.1.4)', () => {
  it('should extract message from Error instances', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('should extract message from custom Error subclasses', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    expect(getErrorMessage(new CustomError('custom-fail'))).toBe('custom-fail');
  });

  it('should return string errors as-is', () => {
    expect(getErrorMessage('plain string error')).toBe('plain string error');
  });

  it('should handle null', () => {
    expect(getErrorMessage(null)).toBe('Unknown error');
  });

  it('should handle undefined', () => {
    expect(getErrorMessage(undefined)).toBe('Unknown error');
  });

  it('should handle objects with a message property', () => {
    expect(getErrorMessage({ message: 'object-fail' })).toBe('object-fail');
  });

  it('should JSON-stringify plain objects without message', () => {
    expect(getErrorMessage({ code: 42, info: 'broken' })).toBe(
      '{"code":42,"info":"broken"}',
    );
  });

  it('should coerce numbers and booleans', () => {
    expect(getErrorMessage(42)).toBe('42');
    expect(getErrorMessage(false)).toBe('false');
  });

  it('should handle circular references gracefully', () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    // JSON.stringify throws on circular; helper should fall back to String()
    const result = getErrorMessage(circular);
    expect(typeof result).toBe('string');
  });
});

describe('truncate (3.1.4)', () => {
  it('should leave short strings unchanged', () => {
    expect(truncate('short', 100)).toBe('short');
  });

  it('should truncate strings longer than the limit', () => {
    const long = 'a'.repeat(150);
    const result = truncate(long, 100);
    expect(result.length).toBeLessThan(150);
    expect(result).toContain('…');
    expect(result).toContain('50 more');
  });

  it('should default to 100 chars', () => {
    const long = 'a'.repeat(200);
    const result = truncate(long);
    expect(result.startsWith('a'.repeat(100))).toBe(true);
  });
});
