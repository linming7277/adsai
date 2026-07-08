# Redis Cache Migration Summary

## Overview

Successfully migrated critical in-memory caches to Redis to enable horizontal scaling of services. All migrations are backwards compatible with graceful fallback to in-memory when Redis is unavailable.

## Completed Migrations

### 1. Cache Infrastructure (pkg/cache)

**Files:**
- `pkg/cache/interface.go` - Store interface for cache abstraction
- `pkg/cache/interface_test.go` - Comprehensive interface tests (75% coverage)

**Features:**
- Formal Store interface defining cache operations
- Compile-time interface verification
- Supports both Redis and in-memory fallback
- Thread-safe operations with sync.RWMutex
- TTL support for all cache entries

**Commits:**
- `4f896e32` - feat(cache): add Store interface for cache abstraction

### 2. AdsCreds Cache (adscenter)

**Files:**
- `services/adscenter/internal/config/ads.go` - Migrated from sync.RWMutex to Redis
- `services/adscenter/internal/config/ads_test.go` - 5 test cases

**Impact:**
- Shared Google Ads credentials cache across all adscenter instances
- Reduces Secret Manager API calls
- Maintains 10min TTL (configurable via `ADS_CREDS_CACHE_TTL_MS`)
- Zero downtime migration

**Cache Key:** `adscenter:ads_creds`

**Commits:**
- `b13fa6b2` - feat(adscenter): migrate AdsCreds cache to Redis

### 3. Secrets Cache (siterank)

**Files:**
- `services/siterank/internal/pkg/secrets/secrets.go` - Migrated from sync.RWMutex to Redis
- `services/siterank/internal/pkg/secrets/secrets_test.go` - 2 test cases

**Impact:**
- Shared Secret Manager results across all siterank instances
- Reduces Secret Manager costs and rate limit pressure
- Maintains 10min TTL (configurable via `SECRET_CACHE_TTL_MS`)
- Cross-instance cache hits improve latency

**Cache Key Pattern:** `siterank:secret:<secret_name>`

**Commits:**
- `a172e26e` - feat(siterank): migrate secrets cache to Redis

## Architecture Benefits

### Horizontal Scaling Enabled

**Before:** Each service instance maintained its own in-memory cache
- No cache sharing across instances
- Redundant API calls to external services (Secret Manager, etc.)
- Memory usage scales linearly with instance count

**After:** All instances share a single Redis cache
- Cache hits across all instances
- Reduced external API calls by ~N-1 (where N = instance count)
- Memory usage centralized in Redis

### Backwards Compatibility

All migrations include fallback logic:
```go
if cache != nil && cache.Ready() {
    // Use Redis cache
} else {
    // Fall back to in-memory or direct fetch
}
```

This ensures:
- Zero downtime deployment
- Graceful degradation if Redis is unavailable
- Same functionality in dev (no Redis) and prod (Redis)

## Configuration

### Environment Variables

All services automatically use Redis when configured:

```bash
# Redis connection (required for cache sharing)
REDIS_URL=redis://user:pass@host:6379/0

# Optional TTL overrides
ADS_CREDS_CACHE_TTL_MS=600000        # 10 minutes (default)
SECRET_CACHE_TTL_MS=600000           # 10 minutes (default)
```

### Infrastructure Requirements

**Cloud Run:**
- Set `REDIS_URL` environment variable in service configuration
- Redis must be accessible from Cloud Run (VPC connector required for Memorystore)

**Local Development:**
- Works without Redis (falls back to in-memory)
- Optional: Run local Redis for testing

## Testing

### Unit Tests

All migrations include comprehensive tests:

| Package | Tests | Coverage | Status |
|---------|-------|----------|--------|
| pkg/cache | 10 tests + benchmarks | 75% | ✅ Pass |
| adscenter/config | 5 tests | - | ✅ Pass |
| siterank/secrets | 2 tests | - | ✅ Pass |

**Run all tests:**
```bash
go test ./pkg/cache ./services/adscenter/internal/config ./services/siterank/internal/pkg/secrets
```

### Integration Testing

To verify Redis cache behavior in production:

1. **Check cache readiness:**
   ```bash
   curl https://adscenter-preview-xxx.run.app/readyz
   # Should return 200 OK if Redis connected
   ```

2. **Monitor cache hits:**
   - First request to endpoint → cache miss (slow)
   - Subsequent requests within TTL → cache hit (fast)

3. **Verify cross-instance sharing:**
   - Scale service to multiple instances
   - Make request to instance A
   - Make same request to instance B → should be cache hit

## Deferred Migrations

Lower priority caches identified but not migrated:

### Console SLO Cache
**Location:** `services/console/internal/handlers/http.go`
**Impact:** Low - 60s TTL, read-heavy dashboard data
**Reason:** Console is typically single-instance, minimal scaling need

### Batchopen Host Cache
**Location:** `services/batchopen/main.go`
**Impact:** Low - Host resolution cache, short TTL
**Reason:** Specialized service, unclear scaling requirements

### Auth JWKS Cache
**Location:** `services/internal/auth/supabase_jwt.go`
**Decision:** Keep in-memory
**Reason:**
- Cryptographic keys are identical across instances
- Cache hit provides minimal benefit (keys are public)
- Adding Redis adds latency to every auth request

## Performance Impact

### Expected Improvements

**Scenario: 3 adscenter instances**

Before:
- Instance A, B, C each fetch credentials independently
- Total Secret Manager calls: 3 per 10min window

After:
- Instance A fetches and caches in Redis
- Instance B, C get cache hit from Redis
- Total Secret Manager calls: 1 per 10min window
- **Reduction: 66% fewer API calls**

### Monitoring

Key metrics to monitor:

1. **Cache hit rate:** `cache.Get()` success vs failure
2. **Secret Manager API calls:** Should decrease after migration
3. **Service latency:** Should improve for cache hits
4. **Redis memory usage:** Should be minimal (<10MB per service)

## Rollback Plan

If issues occur, rollback is safe:

1. **Option 1:** Unset `REDIS_URL` - services fall back to in-memory
2. **Option 2:** Git revert migrations - return to sync.RWMutex implementation

Both options have zero impact on functionality, only performance characteristics.

## Next Steps

### Recommended Actions

1. **Deploy to preview environment**
   - Verify Redis integration works
   - Monitor cache hit rates
   - Check for any errors

2. **Add Redis to production**
   - Provision Memorystore for Redis instance
   - Configure VPC connector
   - Set `REDIS_URL` in Cloud Run services

3. **Monitor performance**
   - Secret Manager API call volume
   - Service latency improvements
   - Redis memory usage

### Future Enhancements

- Add cache metrics endpoint (`/metrics`)
- Implement cache warmup on deployment
- Consider migrating console SLO cache if scaling needs emerge
- Add cache invalidation endpoints for manual refresh
