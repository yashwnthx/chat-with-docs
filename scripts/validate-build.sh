#!/bin/bash

# Production Build and Validation Script
# Run this before deploying to production

set -e  # Exit on error

echo "🚀 Starting production build validation..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Please create .env file from .env.example"
    exit 1
fi

echo "✅ Environment file found"

# Validate environment variables
echo ""
echo "🔍 Validating environment variables..."
node -e "
const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const required = ['OPENAI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'DATABASE_URL', 'NEXT_PUBLIC_APP_URL'];
const missing = required.filter(key => !envFile.includes(key + '='));
if (missing.length > 0 && !(envFile.includes('OPENAI_API_KEY=') || envFile.includes('GOOGLE_GENERATIVE_AI_API_KEY='))) {
  console.error('❌ At least one AI API key required');
  process.exit(1);
}
if (!envFile.includes('DATABASE_URL=')) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}
if (!envFile.includes('NEXT_PUBLIC_APP_URL=')) {
  console.error('❌ NEXT_PUBLIC_APP_URL is required');
  process.exit(1);
}
console.log('✅ Required environment variables present');
"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm ci --production=false

# Generate Prisma Client
echo ""
echo "🗄️  Generating Prisma Client..."
npx prisma generate

# Run database migrations
echo ""
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Type checking
echo ""
echo "🔍 Running TypeScript type checking..."
npx tsc --noEmit

# Linting
echo ""
echo "🧹 Running ESLint..."
npm run lint

# Build
echo ""
echo "🏗️  Building application..."
npm run build

# Check build output
if [ ! -d ".next" ]; then
    echo -e "${RED}❌ Build failed - .next directory not found${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Build validation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Test the build locally: npm start"
echo "2. Review the deployment guide: DEPLOYMENT.md"
echo "3. Deploy to your platform of choice"
echo ""
