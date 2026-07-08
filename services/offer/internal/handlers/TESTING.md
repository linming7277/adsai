# Offer Service Testing Guide

## Overview

This document describes how to run tests for the Offer service, including unit tests and integration tests.

## Test Files

- `http_test.go` - Unit tests for HTTP handlers and routing
- `offers_evaluation_integration_test.go` - Integration tests for offer evaluation flow

## Running Tests

### Unit Tests Only (Fast)

Run unit tests without integration tests:

```bash
cd services/offer
go test -short ./...
```

### Integration Tests

Integration tests require a PostgreSQL database. Set the `TEST_DATABASE_URL` environment variable:

```bash
export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/autoads_test"
cd services/offer
go test ./internal/handlers -v
```

### All Tests

Run all tests including integration tests:

```bash
cd services/offer
go test ./... -v
```

## Test Database Setup

### Local PostgreSQL

1. Create test database:

```sql
CREATE DATABASE autoads_test;
```

2. Run migrations (ensure Offer table exists):

```sql
CREATE TABLE IF NOT EXISTS "Offer" (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    name TEXT NOT NULL,
    "targetDomain" TEXT NOT NULL,
    status TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offer_evaluations (
    id TEXT PRIMARY KEY,
    offer_id TEXT NOT NULL REFERENCES "Offer"(id),
    status TEXT NOT NULL,
    evaluation_type TEXT NOT NULL,
    tokens_consumed INTEGER NOT NULL DEFAULT 0,
    similarweb_score DOUBLE PRECISION,
    ai_recommendation_score DOUBLE PRECISION,
    ai_recommendation TEXT,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);
```

### Using Supabase

If using Supabase for testing:

```bash
export TEST_DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```

## Integration Test Coverage

The `offers_evaluation_integration_test.go` includes the following test scenarios:

### 1. Successful Basic Evaluation
- **Test**: `TestOfferEvaluationIntegration_SuccessfulBasicEvaluation`
- **Coverage**: Full evaluation flow with token reservation, database insertion, and Pub/Sub publishing
- **Assertions**:
  - HTTP 202 Accepted response
  - Evaluation record created in database
  - Token reservation successful
  - Pub/Sub event published

### 2. AI Evaluation with Professional Plan
- **Test**: `TestOfferEvaluationIntegration_AIEvaluationWithProPlan`
- **Coverage**: AI-enhanced evaluation with higher token cost (3 tokens)
- **Assertions**:
  - Evaluation type is "ai_enhanced"
  - 3 tokens reserved
  - IncludeAI and ForceRefresh flags set correctly

### 3. Insufficient Tokens
- **Test**: `TestOfferEvaluationIntegration_InsufficientTokens`
- **Coverage**: Error handling when user has insufficient token balance
- **Assertions**:
  - HTTP 402 Payment Required
  - Error code "INSUFFICIENT_TOKENS"
  - No evaluation record created

### 4. Starter Plan AI Restriction
- **Test**: `TestOfferEvaluationIntegration_StarterPlanAIRestriction`
- **Coverage**: Plan restriction enforcement for AI features
- **Assertions**:
  - HTTP 403 Forbidden
  - Error code "PLAN_RESTRICTION"
  - Current plan included in error details

### 5. Idempotency Key Handling
- **Test**: `TestOfferEvaluationIntegration_IdempotencyKey`
- **Coverage**: Cache-based idempotency for duplicate requests
- **Assertions**:
  - HTTP 202 Accepted with cached response
  - Same evaluationId returned
  - No duplicate database records

### 6. Offer Not Found
- **Test**: `TestOfferEvaluationIntegration_OfferNotFound`
- **Coverage**: Error handling for non-existent offers
- **Assertions**:
  - HTTP 404 Not Found
  - Error code "NOT_FOUND"

## Test Infrastructure

### Mock Billing Service

Integration tests use `httptest.Server` to mock the Billing service endpoints:

- `GET /api/v1/users/me/subscription` - Returns subscription details
- `GET /api/v1/users/me/tokens/balance` - Returns token balance
- `POST /api/v1/users/{userId}/tokens/reserve` - Reserves tokens

### Mock Publisher

Tests use `MockPublisher` to capture Pub/Sub events without actually publishing to Google Cloud Pub/Sub.

### Mock Cache

Tests use `MockCache` to simulate Redis cache behavior for idempotency keys.

## Continuous Integration

For CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Unit Tests
  run: |
    cd services/offer
    go test -short ./... -v

- name: Run Integration Tests
  env:
    TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  run: |
    cd services/offer
    go test ./internal/handlers -v
```

## Code Coverage

Generate coverage report:

```bash
cd services/offer
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out -o coverage.html
```

## Troubleshooting

### Database Connection Errors

If tests fail with database connection errors:

1. Verify `TEST_DATABASE_URL` is set correctly
2. Ensure the database is accessible from your machine
3. Check that required tables exist

### Mock Service Errors

If billing client tests fail:

1. Check that mock server is properly configured
2. Verify response formats match expected JSON structure
3. Ensure auth headers are passed correctly

## Best Practices

1. **Always run unit tests** (`-short` flag) before committing code
2. **Run integration tests** before creating pull requests
3. **Clean up test data** after each test (use `defer` cleanup)
4. **Use unique IDs** in tests to avoid conflicts (timestamps, UUIDs)
5. **Mock external dependencies** (Billing service, Pub/Sub) in integration tests

## Future Improvements

- [ ] Add performance benchmarks
- [ ] Add load testing scenarios
- [ ] Increase code coverage to >80%
- [ ] Add E2E tests with real Siterank service
- [ ] Add contract tests for service-to-service communication
