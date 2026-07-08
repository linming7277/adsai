# Token Priority and Pending Subscription Implementation Progress

## Summary
Implementing subscription tier priority management and token expiry system.

## ✅ Completed Tasks

### 1. Design Phase (100%)
- [x] Complete technical specification document
- [x] Database schema design
- [x] Business logic algorithms
- [x] API endpoint specifications
- [x] Testing strategy

### 2. Database Migrations (100%)
- [x] Migration 000015: Enhanced TokenTransaction table
  - Added `source` column (subscription, checkin, referral, manual, admin)
  - Added `expires_at` column (NULL = permanent)
  - Added `subscription_id` foreign key
  - Created consumption priority indexes
- [x] Migration 000016: Created PendingSubscription table
  - Complete lifecycle tracking (pending → activated/expired/canceled)
  - 180-day pending expiry
  - Blocking subscription reference
- [x] Migration 000017: Added tier to Subscription table
  - Tier field for subscription level comparison
  - Index for tier-based queries

### 3. Domain Models (100%)
- [x] Subscription tier constants and comparison functions
  - TierStarter = 1, TierProfessional = 2, TierElite = 3
  - PlanTiers mapping
  - GetTierForPlan(), IsHigherTier(), IsLowerTier(), IsSameTier()
- [x] Subscription tier methods
  - GetTier(), IsHigherTierThan(), IsLowerTierThan(), IsSameTierAs()
  - IsActive() method
- [x] PendingSubscription domain model
  - Complete lifecycle management
  - Status transitions
  - CanBeActivated() validation

## 🚧 In Progress

### 4. Token Service Refactoring (30%)
Current status: Analyzed existing implementation, identified refactoring needs

**Remaining work:**
- [ ] Add GrantTokensWithSource() method
  ```go
  func (s *Service) GrantTokensWithSource(ctx context.Context, userID string, amount int, source string, expiresAt *time.Time, subscriptionID *string, reason string) error
  ```
- [ ] Add DeductTokensWithPriority() method (replaces CheckAndReserveTokens logic)
  ```go
  func (s *Service) DeductTokensWithPriority(ctx context.Context, userID string, amount int, description string) ([]DeductionDetail, error)
  ```
- [ ] Modify existing grant/deduct operations to use new columns

## ⏳ Pending Tasks

### 5. Trial Subscription Handler Enhancement (0%)
**File**: `services/billing/internal/handlers/trial_subscription.go`

**Required changes:**
- [ ] Add tier comparison logic in extendOrCreateTrial()
- [ ] Route low-tier subscriptions to pending queue when high-tier active
- [ ] Set token expiry dates when granting subscription tokens
- [ ] Update GrantTrialTokens() to use new token source system

### 6. Pending Subscription Handler (0%)
**New file**: `services/billing/internal/handlers/pending_subscription.go`

**Required methods:**
- [ ] CreatePendingSubscription() - Add to queue
- [ ] ListPendingSubscriptions() - User's pending subs
- [ ] CancelPendingSubscription() - Manual cancellation
- [ ] Internal: ActivatePendingSubscription() - Convert to active

### 7. Scheduler Tasks (0%)
**New file**: `services/billing/internal/schedulers/subscription_scheduler.go`

**Required schedulers:**
- [ ] Pending Activation Scheduler (hourly)
  - Query pending subscriptions where blocking has expired
  - Activate and grant tokens with expiry
  - Send in-app notification
- [ ] Token Expiry Cleanup (daily 2am)
  - Find expired tokens
  - Zero out amounts
  - Log cleanup transactions
- [ ] Token Expiry Notification (daily 9am)
  - Find tokens expiring in 3 days
  - Send in-app notifications

### 8. Notification Integration (0%)
**Files**: Console service notification handlers

**Required notifications:**
- [ ] Pending subscription activated
- [ ] Tokens expiring soon (3 days)
- [ ] Tokens expired

### 9. API Endpoints (0%)
**New endpoints needed:**
- [ ] GET `/api/v1/subscriptions/pending` - List pending subscriptions
- [ ] DELETE `/api/v1/subscriptions/pending/:id` - Cancel pending subscription
- [ ] GET `/api/v1/tokens/balance-details` - Token breakdown by source

### 10. Testing (0%)
- [ ] Unit tests for tier comparison
- [ ] Unit tests for token priority consumption
- [ ] Integration tests for pending queue
- [ ] Integration tests for schedulers
- [ ] End-to-end tests

### 11. Deployment (0%)
- [ ] Compile all services
- [ ] Run migrations
- [ ] Deploy to preview environment
- [ ] Monitor metrics

## Current Blockers
None - ready to continue implementation

## Next Steps (Priority Order)

1. **Complete Token Service Refactoring** (2-3 hours)
   - Implement GrantTokensWithSource()
   - Implement priority-based deduction
   - Update existing methods

2. **Modify Trial Subscription Handler** (1-2 hours)
   - Add tier comparison
   - Route to pending queue
   - Set token expiry

3. **Create Pending Subscription Handler** (2 hours)
   - Implement CRUD operations
   - Add activation logic

4. **Implement Schedulers** (2-3 hours)
   - Pending activation scheduler
   - Token expiry cleanup
   - Expiry notifications

5. **Testing & Deployment** (2 hours)
   - Compile and test
   - Run migrations
   - Deploy and monitor

## Estimated Time Remaining
8-12 hours of development work

## Technical Debt & Future Improvements
- [ ] Consider adding token balance breakdown API (by source)
- [ ] Add metrics for pending subscription conversion rate
- [ ] Add admin dashboard for pending subscription management
- [ ] Consider adding manual override for pending activations
