import { StellarError } from '../../../src/errors/StellarError';

describe('StellarError', () => {
  it('should create an error with message and code', () => {
    const error = new StellarError('Something went wrong', 'TEST_ERROR');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(StellarError);
    expect(error.message).toBe('Something went wrong');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.name).toBe('StellarError');
    expect(error.details).toBeUndefined();
  });

  it('should create an error with details', () => {
    const details = { field: 'test', value: 42 };
    const error = new StellarError('With details', 'DETAIL_ERROR', details);

    expect(error.details).toEqual(details);
  });

  it('should serialize to JSON correctly', () => {
    const error = new StellarError('JSON test', 'JSON_CODE', { key: 'value' });
    const json = error.toJSON();

    expect(json).toEqual({
      name: 'StellarError',
      message: 'JSON test',
      code: 'JSON_CODE',
      details: { key: 'value' },
    });
  });

  it('should maintain proper prototype chain', () => {
    const error = new StellarError('proto test', 'PROTO');
    expect(error instanceof StellarError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});
