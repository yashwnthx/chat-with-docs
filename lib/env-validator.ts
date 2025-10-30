/**
 * Environment variable validation
 * Run this at application startup to ensure all required env vars are present
 */

interface EnvConfig {
  // Required
  OPENAI_API_KEY?: string;
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  DATABASE_URL: string;
  NEXT_PUBLIC_APP_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';

  // Optional
  RATE_LIMIT_ENABLED?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  RATE_LIMIT_WINDOW_MS?: string;
  MAX_FILE_SIZE_MB?: string;
  ALLOWED_FILE_TYPES?: string;
}

class EnvironmentValidator {
  private errors: string[] = [];
  private warnings: string[] = [];

  validate(): { isValid: boolean; errors: string[]; warnings: string[] } {
    this.errors = [];
    this.warnings = [];

    // Check NODE_ENV
    this.checkNodeEnv();

    // Check API keys - at least one should be present
    this.checkApiKeys();

    // Check required vars
    this.checkRequired('DATABASE_URL', process.env.DATABASE_URL);
    this.checkRequired('NEXT_PUBLIC_APP_URL', process.env.NEXT_PUBLIC_APP_URL);

    // Validate URLs
    this.validateUrl('NEXT_PUBLIC_APP_URL', process.env.NEXT_PUBLIC_APP_URL);

    // Check optional but recommended vars
    this.checkRecommended();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  private checkNodeEnv() {
    const nodeEnv = process.env.NODE_ENV;
    if (!nodeEnv || !['development', 'production', 'test'].includes(nodeEnv)) {
      this.warnings.push(
        'NODE_ENV should be set to "development", "production", or "test"'
      );
    }
  }

  private checkApiKeys() {
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGemini = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!hasOpenAI && !hasGemini) {
      this.errors.push(
        'At least one AI API key must be configured (OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY)'
      );
    }

    if (!hasOpenAI) {
      this.warnings.push('OPENAI_API_KEY is not set - OpenAI features will be disabled');
    }

    if (!hasGemini) {
      this.warnings.push(
        'GOOGLE_GENERATIVE_AI_API_KEY is not set - Google Gemini features will be disabled'
      );
    }
  }

  private checkRequired(name: string, value: string | undefined) {
    if (!value || value.trim() === '') {
      this.errors.push(`${name} is required but not set`);
    }
  }

  private validateUrl(name: string, value: string | undefined) {
    if (!value) return;

    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) {
        this.errors.push(`${name} must be a valid HTTP or HTTPS URL`);
      }
    } catch {
      this.errors.push(`${name} is not a valid URL: ${value}`);
    }
  }

  private checkRecommended() {
    if (process.env.NODE_ENV === 'production') {
      // Production-specific checks
      if (!process.env.RATE_LIMIT_ENABLED) {
        this.warnings.push(
          'RATE_LIMIT_ENABLED is not set - consider enabling rate limiting for production'
        );
      }

      if (process.env.DATABASE_URL?.includes('file:')) {
        this.warnings.push(
          'Using SQLite in production - consider using PostgreSQL for better performance and reliability'
        );
      }
    }
  }

  printResults(results: ReturnType<typeof this.validate>) {
    if (results.errors.length > 0) {
      console.error('\n❌ Environment Validation Failed:\n');
      results.errors.forEach((error) => console.error(`  • ${error}`));
    }

    if (results.warnings.length > 0) {
      console.warn('\n⚠️  Environment Warnings:\n');
      results.warnings.forEach((warning) => console.warn(`  • ${warning}`));
    }

    if (results.isValid && results.warnings.length === 0) {
      console.log('\n✅ Environment validation passed!\n');
    }
  }
}

// Export validator instance
export const envValidator = new EnvironmentValidator();

// Export for direct use
export function validateEnvironment() {
  const results = envValidator.validate();
  envValidator.printResults(results);

  if (!results.isValid) {
    throw new Error(
      'Environment validation failed. Please check your .env file and ensure all required variables are set.'
    );
  }

  return results;
}

// Auto-validate in production
if (process.env.NODE_ENV === 'production') {
  validateEnvironment();
}
