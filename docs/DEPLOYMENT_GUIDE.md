# Subscription System Deployment Guide

## Overview
This guide covers the deployment of the subscription system enhancements including trial subscriptions, permission checking, token cost calculation, and event-driven architecture.

## Prerequisites

1. **GCP Access**
   - Service account key: `secrets/gcp_codex_dev.json`
   - Project ID: `service-account-440106`
   - Required permissions: Pub/Sub Admin, Cloud Scheduler Admin

2. **Supabase Access**
   - Credentials: `secrets/supabase-credentials.json`
   - Database access for migrations

3. **Tools Required**
   - `gcloud` CLI
   - `psql` (PostgreSQL client)
   - `jq` (JSON processor)
   - Go 1.21+

## Deployment Steps

### Step 1: Run Database Migrations

```bash
# Set database URL or use secrets file
export DATABASE_URL="your-database-url"

# Run migrations
./scripts/run-migrations.sh
```

**Migrations Applied:**
- `000011_add_trial_fields_to_subscription.up.sql` - Adds trial subscription fields
- `000012_create_processed_events_table.up.sql` - Creates event idempotency table

### Step 2: Configure GCP Pub/Sub and Cloud Scheduler

```bash
# Set GCP project
export GCP_PROJECT_ID="service-account-440106"
export GCP_REGION="asia-northeast1"

# Run deployment script
./scripts/deploy-subscription-system.sh
```

**Resources Created:**
- Pub/Sub Topics:
  - `user.checkin.completed`
  - `subscription.trial.created`
  - `subscription.trial.expired`
  - `config.updated`
- Pub/Sub Subscriptions:
  - `billing-checkin-handler` (subscribes to user.checkin.completed)
- Cloud Scheduler Jobs:
  - `expire-trial-subscriptions` (runs hourly)

### Step 3: Deploy Services

#### Deploy Billing Service

```bash
# Build and deploy
cd services/billing
gcloud run deploy billing \
  --source . \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="PUBSUB_ENABLED=true,REDIS_URL=your-redis-url"
```

#### Deploy UserActivity Service

```bash
# Build and deploy
cd services/useractivity
gcloud run deploy useractivity \
  --source . \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="PUBSUB_ENABLED=true,CHECKIN_TOKEN_MODE=async,BILLING_SERVICE_URL=https://billing-xxx.run.app"
```

### Step 4: Verify Deployment

#### Test Trial Subscription Creation

```bash
curl -X POST https://billing-xxx.run.app/api/v1/billing/subscriptions/trial \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userId": "test-user-123",
    "days": 7,
    "source": "self_register"
  }'
```

#### Test Permission Check

```bash
curl -X POST https://billing-xxx.run.app/api/v1/billing/permissions/check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userId": "test-user-123",
    "feature": "offer.evaluation.ai"
  }'
```

#### Test Check-in (Event-Driven)

```bash
curl -X POST https://useractivity-xxx.run.app/api/v1/check-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "source": "web"
  }'
```

## Environment Variables

### Billing Service

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379

# Optional
PUBSUB_ENABLED=true
BILLING_MINIMAL=0
BILLING_SKIP_MIGRATIONS=0
```

### UserActivity Service

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/db

# Optional
PUBSUB_ENABLED=true
CHECKIN_TOKEN_MODE=async  # or "sync" or "hybrid"
BILLING_SERVICE_URL=https://billing-xxx.run.app
```

## API Endpoints

### Billing Service

**Trial Subscriptions:**
- `POST /api/v1/billing/subscriptions/trial` - Create trial
- `GET /api/v1/billing/subscriptions/trial/{userId}` - Get trial history
- `POST /internal/v1/trials/expire` - Expire trials (internal)

**Permissions:**
- `POST /api/v1/billing/permissions/check` - Check permission
- `GET /api/v1/billing/config/permissions` - Get permissions config
- `PUT /api/v1/billing/config/permissions/{feature}` - Update permission

**Token Costs:**
- `POST /api/v1/billing/tokens/cost` - Get token cost
- `GET /api/v1/billing/config/token-costs` - Get token costs config
- `PUT /api/v1/billing/config/token-costs/{action}` - Update token cost

**Configuration:**
- `GET /api/v1/billing/config/all` - Get all config
- `GET /api/v1/billing/config/pricing` - Get pricing
- `PUT /api/v1/billing/config/pricing/{plan}` - Update pricing
- `GET /api/v1/billing/config/history` - Get config history

## Monitoring

### Check Pub/Sub Messages

```bash
# View messages in subscription
gcloud pubsub subscriptions pull billing-checkin-handler \
  --limit=10 \
  --project=service-account-440106
```

### Check Cloud Scheduler

```bash
# List jobs
gcloud scheduler jobs list --location=asia-northeast1

# View job details
gcloud scheduler jobs describe expire-trial-subscriptions \
  --location=asia-northeast1
```

### Check Logs

```bash
# Billing service logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=billing" \
  --limit=50 \
  --format=json

# UserActivity service logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=useractivity" \
  --limit=50 \
  --format=json
```

## Troubleshooting

### Issue: Migrations Fail

**Solution:**
```bash
# Check database connectivity
psql "$DATABASE_URL" -c "SELECT version();"

# Run migrations manually
cd services/billing/internal/migrations
psql "$DATABASE_URL" -f 000011_add_trial_fields_to_subscription.up.sql
psql "$DATABASE_URL" -f 000012_create_processed_events_table.up.sql
```

### Issue: Pub/Sub Events Not Received

**Solution:**
1. Check if PUBSUB_ENABLED=true
2. Verify subscription exists and is active
3. Check service account permissions
4. View Pub/Sub metrics in GCP Console

### Issue: Trial Creation Returns SUB_001

**Explanation:** User already has a trial subscription (this is expected behavior)

**Solution:** Check trial history:
```bash
curl https://billing-xxx.run.app/api/v1/billing/subscriptions/trial/{userId}
```

## Rollback Procedure

### Rollback Migrations

```bash
cd services/billing/internal/migrations
psql "$DATABASE_URL" -f 000012_create_processed_events_table.down.sql
psql "$DATABASE_URL" -f 000011_add_trial_fields_to_subscription.down.sql
```

### Rollback Services

```bash
# Revert to previous revision
gcloud run services update-traffic billing \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=asia-northeast1
```

## Performance Metrics

### Expected Performance

- Trial creation: < 500ms (P95)
- Permission check: < 10ms (P95) with cache
- Token cost calculation: < 10ms (P95) with cache
- Check-in response: < 100ms (P95)
- Event publishing: < 50ms (P95)

### Cache Hit Rates

- Permission cache: > 85%
- Token cost cache: > 85%
- Subscription cache: > 80%

## Security Considerations

1. **API Authentication:** All endpoints require JWT authentication
2. **Internal Endpoints:** `/internal/*` should be protected by service token
3. **Database:** Use SSL/TLS connections
4. **Secrets:** Store in GCP Secret Manager, not in code
5. **Rate Limiting:** Implement at gateway level

## Support

For issues or questions:
1. Check logs in GCP Console
2. Review error codes in response
3. Consult API documentation
4. Contact development team

## Appendix

### Error Codes

- `SUB_001`: User already has trial subscription
- `SUB_002`: Invalid referral code
- `SUB_003`: Referral code already used
- `SUB_004`: Insufficient tokens
- `SUB_005`: Permission denied
- `SUB_006`: Subscription not found
- `SUB_007`: Config update failed
- `SUB_008`: Cache operation failed
