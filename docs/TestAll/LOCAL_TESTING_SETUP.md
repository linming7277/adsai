# Local Development Environment Configuration
# Copy this file to .env.local and update values as needed

# Environment
NODE_ENV=development

# Preview Environment (for local testing)
PREVIEW_BASE=http://www.urlchecker.dev:3000
API_BASE_URL=http://api.urlchecker.dev:8080

# Service Ports
FRONTEND_PORT=3000
BACKEND_PORT=8080

# Testing Configuration
HEADLESS=false
TEST_TIMEOUT=30000
TEST_RETRIES=2

# Browser Testing
BROWSER=chromium
BROWSER_HEADLESS=false
BROWSER_SLOWMO=100

# Database (if using local database)
DATABASE_URL=postgresql://postgres:password@localhost:5432/autoads_local
REDIS_URL=redis://localhost:6379

# Authentication
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-key

# Feature Flags
ENABLE_LOCAL_TESTING=true
SKIP_AUTH_FOR_LOCAL=true
ENABLE_DEBUG_MODE=true

# Logging
LOG_LEVEL=debug
LOG_TO_CONSOLE=true

# Testing Accounts
TEST_USER_EMAIL=test@local.dev
TEST_USER_PASSWORD=TestPassword123!
TEST_ADMIN_EMAIL=admin@local.dev
TEST_ADMIN_PASSWORD=AdminPassword123!

# Local SSL (optional for HTTPS testing)
SSL_ENABLED=false
SSL_CERT_PATH=./certs/local.crt
SSL_KEY_PATH=./certs/local.key