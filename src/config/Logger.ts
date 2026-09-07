import { LogLevel } from '../types/config.types';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

/**
 * Internal SDK logger that respects the configured log level.
 * Messages are only emitted when the configured level is >= the message level.
 */
export class Logger {
  private level: LogLevel;
  private readonly prefix: string;

  constructor(level: LogLevel, prefix = '@vottun/stellar-sdk') {
    this.level = level;
    this.prefix = prefix;
  }

  /** Update the log level at runtime. */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /** Get the current log level. */
  getLevel(): LogLevel {
    return this.level;
  }

  /** Log an error message. */
  error(message: string, ...args: unknown[]): void {
    this.log('error', message, args);
  }

  /** Log a warning message. */
  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, args);
  }

  /** Log an informational message. */
  info(message: string, ...args: unknown[]): void {
    this.log('info', message, args);
  }

  /** Log a debug message. */
  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, args);
  }

  /** Check if a given level would produce output. */
  isEnabled(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.level];
  }

  private log(level: 'error' | 'warn' | 'info' | 'debug', message: string, args: unknown[]): void {
    if (!this.isEnabled(level)) {
      return;
    }

    const formatted = `[${this.prefix}] ${message}`;

    switch (level) {
      case 'error':
        console.error(formatted, ...args);
        break;
      case 'warn':
        console.warn(formatted, ...args);
        break;
      case 'info':
        console.info(formatted, ...args);
        break;
      case 'debug':
        console.debug(formatted, ...args);
        break;
    }
  }
}
