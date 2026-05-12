/**
 * Safely extract a message string from any thrown value.
 *
 * Handles all the cases that `(error as Error).message` doesn't:
 * - Error instances → returns `.message`
 * - Strings → returns as-is
 * - null/undefined → returns 'Unknown error'
 * - Plain objects → JSON-stringified (best-effort)
 * - Anything else → coerced via String()
 *
 * Use this everywhere instead of unsafe `(error as Error).message` casts.
 */
export function getErrorMessage(error: unknown): string {
  if (error === null || error === undefined) {
    return 'Unknown error';
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object') {
    try {
      const obj = error as Record<string, unknown>;
      if (typeof obj.message === 'string') {
        return obj.message;
      }
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

/**
 * Truncate strings to a max length to prevent log/error message blow-up.
 * Used when including potentially-long values (XDRs, asset codes, etc.) in errors.
 */
export function truncate(value: string, maxLength = 100): string {
  if (value.length <= maxLength) return value;
  return `${value.substring(0, maxLength)}…(${value.length - maxLength} more)`;
}
