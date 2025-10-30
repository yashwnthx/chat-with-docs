/**
 * Production-ready logging utility
 * Replaces console.log/error with structured logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: Error;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  private formatLog(entry: LogEntry): string {
    const { level, message, timestamp, context, error } = entry;

    if (this.isDevelopment) {
      // Colorful console output for development
      const colors = {
        debug: '\x1b[36m',   // Cyan
        info: '\x1b[32m',    // Green
        warn: '\x1b[33m',    // Yellow
        error: '\x1b[31m',   // Red
      };
      const reset = '\x1b[0m';

      let output = `${colors[level]}[${level.toUpperCase()}]${reset} ${timestamp} - ${message}`;

      if (context) {
        output += `\n  Context: ${JSON.stringify(context, null, 2)}`;
      }

      if (error) {
        output += `\n  Error: ${error.message}\n  Stack: ${error.stack}`;
      }

      return output;
    } else {
      // JSON output for production (easier to parse by log aggregators)
      return JSON.stringify({
        level,
        message,
        timestamp,
        ...(context && { context }),
        ...(error && {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        }),
      });
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
    };

    const formattedLog = this.formatLog(entry);

    // In production, you might want to send logs to a service like:
    // - Sentry
    // - LogRocket
    // - Datadog
    // - CloudWatch
    // For now, we'll use console but in a structured way

    switch (level) {
      case 'debug':
        if (this.isDevelopment) {
          console.debug(formattedLog);
        }
        break;
      case 'info':
        console.info(formattedLog);
        break;
      case 'warn':
        console.warn(formattedLog);
        break;
      case 'error':
        console.error(formattedLog);
        // In production, send to error tracking service
        if (!this.isDevelopment && error) {
          // Example: Sentry.captureException(error);
        }
        break;
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    this.log('error', message, context, error);
  }

  // Helper for API route errors
  apiError(endpoint: string, error: unknown, additionalContext?: Record<string, any>) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.error(
      `API Error in ${endpoint}`,
      errorObj,
      {
        endpoint,
        ...additionalContext,
      }
    );
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for testing/mocking
export { Logger };
