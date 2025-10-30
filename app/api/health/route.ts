import { NextResponse } from 'next/server';

/**
 * Health check endpoint for monitoring
 * Returns 200 if the application is healthy
 */
export async function GET() {
  try {
    // Basic health checks
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
    };

    // You can add more checks here:
    // - Database connectivity
    // - External API availability
    // - Disk space
    // - Memory usage

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
