@echo off
REM Production Build and Validation Script for Windows
REM Run this before deploying to production

echo Starting production build validation...
echo.

REM Check if .env exists
if not exist .env (
    echo [ERROR] .env file not found
    echo Please create .env file from .env.example
    exit /b 1
)

echo [OK] Environment file found

REM Install dependencies
echo.
echo Installing dependencies...
call npm ci --production=false
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)

REM Generate Prisma Client
echo.
echo Generating Prisma Client...
call npx prisma generate
if errorlevel 1 (
    echo [ERROR] Failed to generate Prisma Client
    exit /b 1
)

REM Run database migrations
echo.
echo Running database migrations...
call npx prisma migrate deploy
if errorlevel 1 (
    echo [ERROR] Failed to run migrations
    exit /b 1
)

REM Type checking
echo.
echo Running TypeScript type checking...
call npx tsc --noEmit
if errorlevel 1 (
    echo [ERROR] TypeScript type checking failed
    exit /b 1
)

REM Linting
echo.
echo Running ESLint...
call npm run lint
if errorlevel 1 (
    echo [ERROR] Linting failed
    exit /b 1
)

REM Build
echo.
echo Building application...
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed
    exit /b 1
)

REM Check build output
if not exist .next (
    echo [ERROR] Build failed - .next directory not found
    exit /b 1
)

echo.
echo [SUCCESS] Build validation complete!
echo.
echo Next steps:
echo 1. Test the build locally: npm start
echo 2. Review the deployment guide: DEPLOYMENT.md
echo 3. Deploy to your platform of choice
echo.

pause
