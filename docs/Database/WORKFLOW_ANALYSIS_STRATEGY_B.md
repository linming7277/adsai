# Workflow Analysis: Strategy B Support

**Analysis Date**: 2025-10-21
**Target Workflow**: `.github/workflows/database-migration-cloudrun.yml`

## 🔍 Current Workflow Capabilities

### ✅ What It Does Well
1. **Incremental Migrations**: Executes `migrate up` for each service
2. **Service Isolation**: Separate jobs for each service (billing, adscenter, offer, console)
3. **Cloud SQL Integration**: Uses Unix Socket via Cloud SQL Proxy
4. **Image Management**: Builds and pushes Docker images to Artifact Registry
5. **Environment Support**: Supports preview and production environments

### ❌ What It Cannot Do (Strategy B Requirements)
1. **Database Reset**: No capability to drop schemas or reset database
2. **Backup Creation**: No backup step before destructive operations
3. **Rollback Support**: No rollback mechanism
4. **Full Rebuild Mode**: Only supports incremental `up` migrations
5. **Pre-flight Checks**: No validation of current database state
6. **Migration Order Control**: Parallel execution doesn't guarantee order
7. **Destructive Operations**: No support for `DROP SCHEMA CASCADE`

## 📊 Gap Analysis

### Required for Strategy B

| Capability | Current Status | Required Enhancement |
|------------|----------------|---------------------|
| Backup creation | ❌ Missing | Create backup job before reset |
| Database reset | ❌ Missing | Execute DROP SCHEMA CASCADE |
| Migration order | ⚠️ Parallel | Sequential execution with dependencies |
| Rollback support | ❌ Missing | Restore from backup capability |
| Safety checks | ⚠️ Minimal | Pre-flight validation |
| Dry-run mode | ❌ Missing | Test without execution |
| Manual approval | ❌ Missing | Require confirmation for production |

## 🎯 Recommended Enhancements

### Option 1: Add Strategy B Mode to Existing Workflow (Recommended)

**Pros**:
- Single workflow to maintain
- Reuses existing infrastructure
- Clear mode selection via input

**Cons**:
- More complex workflow logic
- Higher risk if mode selection is wrong

**Implementation**:
```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - preview
          - production
      migration_mode:
        description: 'Migration mode'
        required: true
        type: choice
        options:
          - incremental  # Default: migrate up
          - full_rebuild # Strategy B: reset + migrate
        default: 'incremental'
      require_backup:
        description: 'Create backup before migration'
        required: true
        type: boolean
        default: true
```

### Option 2: Create Separate Strategy B Workflow

**Pros**:
- Clear separation of concerns
- Lower risk of accidental execution
- Easier to add safety checks

**Cons**:
- Duplicate code
- Two workflows to maintain

**Implementation**:
- New file: `.github/workflows/database-rebuild-strategy-b.yml`
- Explicit naming prevents accidents
- Requires manual trigger only (no auto-trigger)

## 🚀 Recommended Implementation: Option 2

Create a separate, highly controlled workflow for Strategy B.

### Key Features:

1. **Manual Trigger Only**: No automatic execution
2. **Multiple Confirmations**: Require explicit confirmation inputs
3. **Mandatory Backup**: Always create backup before reset
4. **Sequential Execution**: Strict order control
5. **Rollback Capability**: Built-in restore mechanism
6. **Detailed Logging**: Comprehensive audit trail

### Workflow Structure:

```yaml
name: Database Full Rebuild (Strategy B - HIGH RISK)

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - preview
          # production requires separate approval
      confirmation_text:
        description: 'Type "REBUILD DATABASE" to confirm'
        required: true
      backup_name:
        description: 'Backup name (auto-generated if empty)'
        required: false

jobs:
  # Job 1: Pre-flight checks
  preflight-checks:
    - Verify environment
    - Check current database state
    - Validate migration files
    - Confirm no active connections
  
  # Job 2: Create backup
  create-backup:
    - Execute pg_dump via Cloud Run Job
    - Verify backup integrity
    - Store backup location
  
  # Job 3: Database reset
  reset-database:
    - Drop all custom schemas
    - Reset public schema
    - Clear schema_migrations
    - Verify clean state
  
  # Job 4: Execute migrations (sequential)
  run-migrations:
    strategy:
      matrix:
        service: [billing, adscenter, offer, console]
      max-parallel: 1  # Sequential execution
    - Execute migrations in order
    - Verify each step
    - Stop on first failure
  
  # Job 5: Validation
  validate-rebuild:
    - Check all schemas exist
    - Verify table counts
    - Test basic queries
    - Generate report
  
  # Job 6: Rollback (on failure)
  rollback-on-failure:
    if: failure()
    - Restore from backup
    - Verify restoration
    - Notify team
```

## 📝 Required New Scripts

### 1. Backup Script
**Path**: `deployments/db-migrator/backup.sh`
**Purpose**: Create full database backup

```bash
#!/bin/bash
# Create backup of autoads_db
pg_dump -h /cloudsql/... -U postgres -d autoads_db \
  -F c -f /backup/autoads_db_$(date +%Y%m%d_%H%M%S).dump
```

### 2. Reset Script
**Path**: `deployments/db-migrator/reset.sh`
**Purpose**: Drop all schemas and reset database

```bash
#!/bin/bash
# Execute reset SQL
psql "$DATABASE_URL" -f /scripts/reset-database.sql
```

### 3. Reset SQL
**Path**: `deployments/db-migrator/reset-database.sql`
**Purpose**: SQL commands to reset database

```sql
-- Drop all custom schemas
DROP SCHEMA IF EXISTS billing CASCADE;
DROP SCHEMA IF EXISTS offers CASCADE;
-- ... etc
```

### 4. Restore Script
**Path**: `deployments/db-migrator/restore.sh`
**Purpose**: Restore from backup

```bash
#!/bin/bash
# Restore from backup
pg_restore -h /cloudsql/... -U postgres -d autoads_db \
  --clean --if-exists /backup/$BACKUP_FILE
```

### 5. Validation Script
**Path**: `deployments/db-migrator/validate.sh`
**Purpose**: Verify database state after rebuild

```bash
#!/bin/bash
# Run validation queries
psql "$DATABASE_URL" -f /scripts/validate-database.sql
```

## 🔒 Safety Mechanisms

### 1. Confirmation Requirements
- Explicit text confirmation: "REBUILD DATABASE"
- Environment selection (preview only by default)
- Backup name specification

### 2. Pre-flight Checks
- Verify no active service connections
- Check current database size
- Validate migration file integrity
- Confirm backup storage availability

### 3. Execution Controls
- Sequential migration execution (no parallel)
- Stop on first error
- Detailed logging at each step
- Timeout controls

### 4. Rollback Triggers
- Automatic rollback on migration failure
- Manual rollback option
- Backup verification before proceeding

## 📋 Implementation Checklist

### Phase 1: Create Scripts (1-2 hours)
- [ ] Create `backup.sh`
- [ ] Create `reset.sh`
- [ ] Create `reset-database.sql`
- [ ] Create `restore.sh`
- [ ] Create `validate.sh`
- [ ] Create `validate-database.sql`

### Phase 2: Update Dockerfile (30 minutes)
- [ ] Add backup/restore scripts to image
- [ ] Add SQL scripts to image
- [ ] Test image build locally

### Phase 3: Create Workflow (1-2 hours)
- [ ] Create `database-rebuild-strategy-b.yml`
- [ ] Add all safety checks
- [ ] Add confirmation requirements
- [ ] Test in preview environment

### Phase 4: Documentation (30 minutes)
- [ ] Update Strategy B execution plan
- [ ] Create runbook for operators
- [ ] Document rollback procedures

### Phase 5: Testing (2-4 hours)
- [ ] Test backup creation
- [ ] Test database reset
- [ ] Test migration execution
- [ ] Test validation
- [ ] Test rollback
- [ ] Full end-to-end test

## ⚠️ Critical Warnings

1. **Data Loss Risk**: Strategy B will DELETE ALL DATA
2. **Production Use**: Requires additional approval workflow
3. **Testing Required**: Must test in preview first
4. **Backup Mandatory**: Never skip backup step
5. **Rollback Ready**: Always have rollback plan

## 🎯 Next Steps

1. **Immediate**: Create required scripts
2. **Short-term**: Build and test new workflow
3. **Medium-term**: Test in preview environment
4. **Long-term**: Document and train team

---

**Recommendation**: Proceed with Option 2 (separate workflow) for maximum safety and control.
