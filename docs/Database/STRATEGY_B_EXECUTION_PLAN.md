# Strategy B: Full Database Rebuild - Execution Plan

**Status**: 🚨 HIGH RISK OPERATION
**Created**: 2025-10-21
**Strategy**: Complete database rebuild from scratch

## ⚠️ Critical Warnings

1. **Data Loss Risk**: This operation will DELETE ALL DATA in autoads_db
2. **Downtime Required**: All services must be stopped during execution
3. **Backup Required**: MUST create backup before proceeding
4. **Rollback Plan**: Must be prepared before execution
5. **Testing Required**: Must test in non-production environment first

## 🎯 Execution Overview

### Phase 1: Pre-Execution Safety Checks
- [ ] Create complete database backup
- [ ] Verify backup integrity
- [ ] Stop all services accessing autoads_db
- [ ] Document current schema state
- [ ] Prepare rollback scripts

### Phase 2: Database Reset
- [ ] Drop all schemas (except postgres system schemas)
- [ ] Drop all tables in public schema
- [ ] Reset schema_migrations table
- [ ] Verify clean state

### Phase 3: Migration Execution
- [ ] Execute migrations in correct order
- [ ] Verify each migration success
- [ ] Check for errors and warnings
- [ ] Validate schema structure

### Phase 4: Post-Migration Validation
- [ ] Verify all schemas created
- [ ] Verify all tables created
- [ ] Verify all indexes created
- [ ] Verify all constraints
- [ ] Test basic CRUD operations

### Phase 5: Service Restoration
- [ ] Update service configurations
- [ ] Deploy services
- [ ] Run health checks
- [ ] Verify connectivity
- [ ] Monitor for errors

## 📋 Detailed Execution Steps

### Step 1: Create Backup (MANDATORY)

```bash
# Execute via Cloud Run Job
gcloud run jobs execute db-backup-job \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873 \
  --wait
```

**Backup Script** (to be created):
```sql
-- Export all schemas and data
pg_dump -h /cloudsql/gen-lang-client-0944935873:asia-northeast1:autoads \
  -U postgres \
  -d autoads_db \
  -F c \
  -f /backup/autoads_db_$(date +%Y%m%d_%H%M%S).dump
```

### Step 2: Stop All Services

```bash
# List all services using autoads_db
gcloud run services list \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873 \
  --filter="metadata.annotations.database=autoads_db"

# Scale down to zero (or delete if needed)
for service in billing-service offer-service adscenter-service; do
  gcloud run services update $service \
    --region=asia-northeast1 \
    --min-instances=0 \
    --max-instances=0
done
```

### Step 3: Execute Database Reset

Create and execute reset script via Cloud Run Job:

```sql
-- reset-database.sql
-- WARNING: This will delete ALL data

-- Drop all custom schemas
DROP SCHEMA IF EXISTS billing CASCADE;
DROP SCHEMA IF EXISTS offers CASCADE;
DROP SCHEMA IF EXISTS adscenter CASCADE;
DROP SCHEMA IF EXISTS siterank CASCADE;
DROP SCHEMA IF EXISTS useractivity CASCADE;
DROP SCHEMA IF EXISTS system CASCADE;
DROP SCHEMA IF EXISTS console CASCADE;

-- Clean public schema
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Reset migrations tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version bigint NOT NULL PRIMARY KEY,
    dirty boolean NOT NULL
);

-- Verify clean state
SELECT schemaname FROM pg_catalog.pg_tables 
WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
```

### Step 4: Execute Migrations in Order

**Migration Order** (based on dependencies):
1. `billing` - Base user and subscription data
2. `adscenter` - Ad accounts (depends on billing users)
3. `offer` - Offer management (depends on billing users)
4. `siterank` - Site ranking (depends on billing users)
5. `useractivity` - Activity tracking (depends on billing users)
6. `console` - Read-only views (depends on all above)

**Execution Command**:
```bash
# Trigger Cloud Run Job with full migration
gcloud run jobs execute db-migrate \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873 \
  --set-env-vars="MIGRATION_MODE=full,MIGRATION_DIRECTION=up" \
  --wait
```

### Step 5: Validation Queries

```sql
-- Verify all schemas exist
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name IN ('billing', 'offers', 'adscenter', 'siterank', 'useractivity', 'console');

-- Count tables per schema
SELECT schemaname, COUNT(*) as table_count
FROM pg_catalog.pg_tables 
WHERE schemaname IN ('billing', 'offers', 'adscenter', 'siterank', 'useractivity', 'console')
GROUP BY schemaname;

-- Verify indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname IN ('billing', 'offers', 'adscenter', 'siterank', 'useractivity', 'console')
ORDER BY schemaname, tablename;

-- Check foreign keys
SELECT
    tc.table_schema, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema IN ('billing', 'offers', 'adscenter', 'siterank', 'useractivity', 'console');

-- Check migration versions
SELECT version, dirty FROM schema_migrations ORDER BY version;
```

## 🔄 Rollback Plan

### If Migration Fails:

1. **Stop migration job immediately**
```bash
gcloud run jobs executions cancel <execution-name> \
  --region=asia-northeast1
```

2. **Restore from backup**
```bash
# Restore backup via Cloud Run Job
gcloud run jobs execute db-restore-job \
  --region=asia-northeast1 \
  --set-env-vars="BACKUP_FILE=/backup/autoads_db_YYYYMMDD_HHMMSS.dump" \
  --wait
```

3. **Verify restoration**
```sql
-- Check data integrity
SELECT COUNT(*) FROM billing.users;
SELECT COUNT(*) FROM offers.offers;
-- etc.
```

4. **Restart services**
```bash
for service in billing-service offer-service adscenter-service; do
  gcloud run services update $service \
    --region=asia-northeast1 \
    --min-instances=1 \
    --max-instances=10
done
```

## 📊 Success Criteria

### Must Pass All:
- [ ] All schemas created successfully
- [ ] All tables created successfully
- [ ] All indexes created successfully
- [ ] All foreign keys created successfully
- [ ] No dirty migrations in schema_migrations
- [ ] All services can connect to database
- [ ] Basic CRUD operations work
- [ ] No errors in service logs

### Performance Benchmarks:
- [ ] Query response time < 100ms for simple queries
- [ ] Connection pool healthy
- [ ] No connection leaks
- [ ] CPU usage < 50% under normal load

## 🚀 Execution Timeline

### Estimated Duration: 2-4 hours

1. **Backup Creation**: 15-30 minutes
2. **Service Shutdown**: 5 minutes
3. **Database Reset**: 5 minutes
4. **Migration Execution**: 30-60 minutes
5. **Validation**: 30 minutes
6. **Service Restoration**: 30 minutes
7. **Testing**: 30-60 minutes

## 📝 Execution Checklist

### Pre-Execution (Day Before)
- [ ] Review this plan with team
- [ ] Schedule maintenance window
- [ ] Notify stakeholders
- [ ] Prepare monitoring dashboards
- [ ] Test backup/restore in dev environment
- [ ] Prepare rollback scripts

### Execution Day
- [ ] Confirm maintenance window
- [ ] Create backup
- [ ] Verify backup
- [ ] Stop services
- [ ] Execute reset
- [ ] Execute migrations
- [ ] Validate results
- [ ] Restore services
- [ ] Monitor for 2 hours

### Post-Execution
- [ ] Document any issues encountered
- [ ] Update migration documentation
- [ ] Clean up old databases (billing_db, offer_db, etc.)
- [ ] Archive backup
- [ ] Send completion notification

## 🔗 Related Scripts

- `scripts/db/strategy-b-backup.sh` - Backup creation
- `scripts/db/strategy-b-reset.sql` - Database reset
- `scripts/db/strategy-b-validate.sql` - Validation queries
- `scripts/db/strategy-b-rollback.sh` - Rollback procedure

## ⚠️ Final Warning

**This is a destructive operation. Do not proceed unless:**
1. You have a verified backup
2. You have tested in a non-production environment
3. You have approval from stakeholders
4. You have a maintenance window scheduled
5. You are prepared to rollback if needed

---

**Next Steps**: Create execution scripts and test in development environment first.
