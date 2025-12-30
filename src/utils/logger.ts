/**
 * Logger utility for musync
 * Provides consistent logging with verbosity control
 */

// Log levels handled via verbose flag

interface LoggerOptions {
  verbose: boolean;
}

class Logger {
  private verbose: boolean = false;

  /**
   * Configure logger options
   */
  configure(options: Partial<LoggerOptions>): void {
    if (options.verbose !== undefined) {
      this.verbose = options.verbose;
    }
  }

  /**
   * Check if verbose mode is enabled
   */
  isVerbose(): boolean {
    return this.verbose;
  }

  /**
   * Debug log - only shown in verbose mode
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.verbose) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Info log - standard output
   */
  info(message: string, ...args: unknown[]): void {
    console.log(message, ...args);
  }

  /**
   * Warning log
   */
  warn(message: string, ...args: unknown[]): void {
    console.warn(`⚠ ${message}`, ...args);
  }

  /**
   * Error log
   */
  error(message: string, ...args: unknown[]): void {
    console.error(`✗ ${message}`, ...args);
  }

  /**
   * Success log with checkmark
   */
  success(message: string, ...args: unknown[]): void {
    console.log(`✓ ${message}`, ...args);
  }

  /**
   * Progress indicator
   */
  progress(current: number, total: number, message: string): void {
    const percentage = Math.round((current / total) * 100);
    process.stdout.write(`\r[${current}/${total}] ${percentage}% ${message}`);
    if (current === total) {
      console.log(); // New line at completion
    }
  }

  /**
   * Log with prefix for visual grouping
   */
  group(title: string): void {
    console.log(`\n${title}`);
    console.log('─'.repeat(title.length));
  }

  /**
   * Log a table
   */
  table(data: Record<string, unknown>[] | unknown[][]): void {
    console.table(data);
  }

  /**
   * Log a blank line
   */
  newLine(): void {
    console.log();
  }

  /**
   * Log JSON data (for --json output)
   */
  json(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }

  /**
   * Log raw JSON (single line, for piping)
   */
  jsonRaw(data: unknown): void {
    console.log(JSON.stringify(data));
  }
}

// Export singleton instance
export const logger = new Logger();

// Also export type for injection
export type { Logger };
