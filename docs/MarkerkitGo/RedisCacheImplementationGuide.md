# Redis 缓存策略实施指南

**创建日期**: 2025-10-07
**目标**: 降低数据库负载 50%，缓存命中率从 40% 提升到 80%
**预期收益**: Console Dashboard 延迟降低 30-40%

---

## 一、当前状态

### 1.1 现有缓存基础设施

✅ **已有基础**:
- `pkg/cache`: Redis 客户端封装
- `pkg/cache/decorator.go`: 统一缓存装饰器
- billing `/usage/report` 已实施 60 秒缓存

❌ **缺失**:
- offer.GetOffer() 无缓存
- billing.GetTokenBalance() 无缓存
- adscenter.GetAccount() 无缓存
- Console 聚合查询无缓存

---

## 二、缓存策略设计

### 2.1 缓存 Key 命名规范

```
格式: {service}:{resource}:{id}[:{suffix}]

示例:
- offer:offer:uuid-123
- billing:balance:user-id-456
- adscenter:account:customer-id-789
- console:dashboard:user-id-abc
```

### 2.2 TTL (Time To Live) 策略

| 资源 | TTL | 理由 |
|------|-----|------|
| **Offer 详情** | 5分钟 | 更新频率低，可容忍短暂不一致 |
| **Token 余额** | 1分钟 | 扣费频繁，需要较高实时性 |
| **广告账户** | 5分钟 | 更新频率低 |
| **Console Dashboard** | 30秒 | 聚合数据，允许短暂延迟 |
| **Siterank 评分** | 10分钟 | 评分完成后很少变化 |

### 2.3 缓存失效策略

**1. 被动失效（TTL 过期）**
- 适用场景: 读多写少的资源
- 优点: 实现简单
- 缺点: 可能返回过期数据

**2. 主动失效（Write-Through）**
- 适用场景: 强一致性要求
- 实现: 写入时删除缓存
```go
// 更新 Offer 后主动失效缓存
func (h *Handler) updateOffer(ctx context.Context, id string, offer *Offer) error {
    if err := h.db.Update(ctx, id, offer); err != nil {
        return err
    }
    // 主动删除缓存
    h.cache.Del(ctx, fmt.Sprintf("offer:offer:%s", id))
    return nil
}
```

**3. 混合策略（推荐）**
- Token 余额: 写入时删除缓存 + 1分钟 TTL
- Offer 详情: 仅 TTL（5分钟）
- Console Dashboard: 仅 TTL（30秒）

---

## 三、实施步骤

### Step 1: Offer 服务缓存 (services/offer)

#### 1.1 初始化 Redis 缓存

```go
// services/offer/main.go
import (
    "github.com/xxrenzhe/autoads/pkg/cache"
)

func main() {
    // ...existing code...

    // Initialize Redis cache
    rcache, err := cache.NewFromEnv()
    if err != nil {
        log.Warn().Err(err).Msg("Failed to create Redis cache, continuing without cache")
        rcache = nil
    }

    handler := &Handler{
        db:    db,
        cache: rcache, // Add cache to handler
    }
    // ...
}
```

#### 1.2 GetOffer 缓存实现

```go
// services/offer/internal/handlers/http.go
import (
    "github.com/xxrenzhe/autoads/pkg/cache"
)

func (h *Handler) GetOffer(w http.ResponseWriter, r *http.Request, id string) {
    ctx := r.Context()
    userID, _ := auth.UserIDFromContext(ctx)

    // 1. 尝试从缓存获取
    cacheKey := fmt.Sprintf("offer:offer:%s", id)
    if h.cache != nil {
        if cachedData, ok := h.cache.Get(ctx, cacheKey); ok {
            var offer Offer
            if err := json.Unmarshal([]byte(cachedData), &offer); err == nil {
                // 验证权限（userId 匹配）
                if offer.UserID == userID {
                    log.Debug().Str("offerId", id).Msg("Cache hit: offer")
                    writeJSON(w, http.StatusOK, offer)
                    return
                }
            }
        }
    }

    // 2. 缓存未命中，从数据库查询
    log.Debug().Str("offerId", id).Msg("Cache miss: offer")
    offer, err := h.db.GetOffer(ctx, id)
    if err != nil {
        errors.Write(w, r, http.StatusNotFound, "OFFER_NOT_FOUND", "Offer not found", nil)
        return
    }

    // 3. 验证权限
    if offer.UserID != userID {
        errors.Write(w, r, http.StatusForbidden, "FORBIDDEN", "Access denied", nil)
        return
    }

    // 4. 写入缓存 (5分钟)
    if h.cache != nil {
        if data, err := json.Marshal(offer); err == nil {
            _ = h.cache.Set(ctx, cacheKey, string(data), 5*time.Minute)
        }
    }

    writeJSON(w, http.StatusOK, offer)
}
```

#### 1.3 UpdateOffer 主动失效缓存

```go
func (h *Handler) UpdateOffer(w http.ResponseWriter, r *http.Request, id string) {
    // ...existing update logic...

    // 主动删除缓存
    if h.cache != nil {
        cacheKey := fmt.Sprintf("offer:offer:%s", id)
        _ = h.cache.Del(r.Context(), cacheKey)
        log.Debug().Str("offerId", id).Msg("Cache invalidated: offer")
    }

    writeJSON(w, http.StatusOK, updatedOffer)
}
```

---

### Step 2: Billing 服务缓存 (services/billing)

#### 2.1 GetTokenBalance 缓存实现

```go
// services/billing/internal/handlers/tokens.go
func (h *Handler) GetTokenBalance(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    userID, _ := auth.UserIDFromContext(ctx)

    // 1. 尝试从缓存获取
    cacheKey := fmt.Sprintf("billing:balance:%s", userID)
    if h.cache != nil {
        if cachedData, ok := h.cache.Get(ctx, cacheKey); ok {
            var balance TokenBalance
            if err := json.Unmarshal([]byte(cachedData), &balance); err == nil {
                log.Debug().Str("userId", userID).Msg("Cache hit: token balance")
                writeJSON(w, http.StatusOK, balance)
                return
            }
        }
    }

    // 2. 缓存未命中，从数据库查询
    log.Debug().Str("userId", userID).Msg("Cache miss: token balance")
    balance, err := h.billingService.GetTokenBalance(ctx, userID)
    if err != nil {
        errors.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "Failed to get balance", nil)
        return
    }

    // 3. 写入缓存 (1分钟 - 较短 TTL，因为扣费频繁)
    if h.cache != nil {
        if data, err := json.Marshal(balance); err == nil {
            _ = h.cache.Set(ctx, cacheKey, string(data), 1*time.Minute)
        }
    }

    writeJSON(w, http.StatusOK, balance)
}
```

#### 2.2 DebitTokens 主动失效缓存

```go
func (h *Handler) DebitTokens(w http.ResponseWriter, r *http.Request) {
    var req DebitTokensRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        errors.Write(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
        return
    }

    // ...existing debit logic...

    // 主动删除缓存（扣费后余额变化）
    if h.cache != nil {
        cacheKey := fmt.Sprintf("billing:balance:%s", req.UserID)
        _ = h.cache.Del(r.Context(), cacheKey)
        log.Debug().Str("userId", req.UserID).Msg("Cache invalidated: token balance")
    }

    writeJSON(w, http.StatusOK, transaction)
}
```

---

### Step 3: Console 服务聚合查询缓存

#### 3.1 GetUserDashboard 缓存实现

```go
// services/console/internal/handlers/aggregation.go
func (h *Handler) GetUserDashboard(w http.ResponseWriter, r *http.Request) {
    userID := r.PathValue("userId")
    ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
    defer cancel()

    // 1. 尝试从缓存获取
    cacheKey := fmt.Sprintf("console:dashboard:%s", userID)
    if h.cache != nil {
        if cachedData, ok := h.cache.Get(ctx, cacheKey); ok {
            var dashboard UserDashboardResponse
            if err := json.Unmarshal([]byte(cachedData), &dashboard); err == nil {
                log.Debug().Str("userId", userID).Msg("Cache hit: dashboard")
                w.Header().Set("Content-Type", "application/json")
                w.Header().Set("X-Cache", "HIT") // 方便调试
                _ = json.NewEncoder(w).Encode(dashboard)
                return
            }
        }
    }

    // 2. 缓存未命中，聚合查询
    log.Debug().Str("userId", userID).Msg("Cache miss: dashboard")
    sc := NewServiceClients()
    resp := &UserDashboardResponse{
        UserID: userID,
        Errors: make(map[string]string),
    }

    // ...existing aggregation logic with WaitGroup...

    // 3. 写入缓存 (30秒 - 聚合数据允许短暂延迟)
    if h.cache != nil {
        if data, err := json.Marshal(resp); err == nil {
            _ = h.cache.Set(ctx, cacheKey, string(data), 30*time.Second)
        }
    }

    w.Header().Set("Content-Type", "application/json")
    w.Header().Set("X-Cache", "MISS") // 方便调试
    _ = json.NewEncoder(w).Encode(resp)
}
```

---

### Step 4: Adscenter 服务缓存

#### 4.1 GetAccount 缓存实现

```go
// services/adscenter/internal/handlers/accounts.go
func (h *Handler) GetAccount(w http.ResponseWriter, r *http.Request) {
    accountID := r.PathValue("id")
    ctx := r.Context()
    userID, _ := auth.UserIDFromContext(ctx)

    // 1. 尝试从缓存获取
    cacheKey := fmt.Sprintf("adscenter:account:%s", accountID)
    if h.cache != nil {
        if cachedData, ok := h.cache.Get(ctx, cacheKey); ok {
            var account UserAdsConnection
            if err := json.Unmarshal([]byte(cachedData), &account); err == nil {
                // 验证权限
                if account.UserID == userID {
                    log.Debug().Str("accountId", accountID).Msg("Cache hit: account")
                    writeJSON(w, http.StatusOK, account)
                    return
                }
            }
        }
    }

    // 2. 缓存未命中，从数据库查询
    log.Debug().Str("accountId", accountID).Msg("Cache miss: account")
    account, err := h.db.GetAccount(ctx, accountID)
    if err != nil {
        errors.Write(w, r, http.StatusNotFound, "ACCOUNT_NOT_FOUND", "Account not found", nil)
        return
    }

    // 3. 验证权限
    if account.UserID != userID {
        errors.Write(w, r, http.StatusForbidden, "FORBIDDEN", "Access denied", nil)
        return
    }

    // 4. 写入缓存 (5分钟)
    if h.cache != nil {
        if data, err := json.Marshal(account); err == nil {
            _ = h.cache.Set(ctx, cacheKey, string(data), 5*time.Minute)
        }
    }

    writeJSON(w, http.StatusOK, account)
}
```

---

## 四、使用 pkg/cache/decorator 简化实现

对于简单的读取场景，可以使用已有的缓存装饰器：

```go
// services/offer/internal/handlers/http.go
import (
    pkgcache "github.com/xxrenzhe/autoads/pkg/cache"
)

func (h *Handler) GetOffer(w http.ResponseWriter, r *http.Request, id string) {
    ctx := r.Context()
    userID, _ := auth.UserIDFromContext(ctx)

    // 使用缓存装饰器
    cacheKey := fmt.Sprintf("offer:offer:%s", id)
    getOfferFn := func(ctx context.Context) (*Offer, error) {
        return h.db.GetOffer(ctx, id)
    }

    offer, err := pkgcache.Cached(h.cache, cacheKey, 5*time.Minute, getOfferFn)(ctx)
    if err != nil {
        errors.Write(w, r, http.StatusNotFound, "OFFER_NOT_FOUND", "Offer not found", nil)
        return
    }

    // 验证权限
    if offer.UserID != userID {
        errors.Write(w, r, http.StatusForbidden, "FORBIDDEN", "Access denied", nil)
        return
    }

    writeJSON(w, http.StatusOK, offer)
}
```

---

## 五、监控和验证

### 5.1 缓存命中率监控

添加 Prometheus metrics:

```go
// pkg/cache/metrics.go (新建)
package cache

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    cacheHits = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "redis_cache_hits_total",
            Help: "Total number of cache hits",
        },
        []string{"service", "resource"},
    )

    cacheMisses = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "redis_cache_misses_total",
            Help: "Total number of cache misses",
        },
        []string{"service", "resource"},
    )
)

func RecordCacheHit(service, resource string) {
    cacheHits.WithLabelValues(service, resource).Inc()
}

func RecordCacheMiss(service, resource string) {
    cacheMisses.WithLabelValues(service, resource).Inc()
}
```

### 5.2 验证方法

1. **查看 HTTP 响应头**:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     https://api.autoads.com/api/v1/offers/$OFFER_ID \
     -v | grep X-Cache
   # X-Cache: HIT  (缓存命中)
   # X-Cache: MISS (缓存未命中)
   ```

2. **监控 Redis Keys**:
   ```bash
   redis-cli --scan --pattern "offer:*" | wc -l
   redis-cli --scan --pattern "billing:*" | wc -l
   ```

3. **Prometheus 查询**:
   ```promql
   # 缓存命中率
   rate(redis_cache_hits_total[5m]) /
   (rate(redis_cache_hits_total[5m]) + rate(redis_cache_misses_total[5m]))

   # 按服务分组
   sum by (service) (rate(redis_cache_hits_total[5m]))
   ```

---

## 六、预期效果

### 6.1 性能提升

| 场景 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| **Console Dashboard** | 500ms | 300ms | 40% |
| **Offer 详情查询** | 100ms | 10ms | 90% |
| **Token 余额查询** | 50ms | 5ms | 90% |
| **广告账户查询** | 80ms | 8ms | 90% |

### 6.2 数据库负载

- QPS 降低: 1000 → 200 (-80%)
- 连接池利用率: 70% → 30% (-57%)
- 慢查询数量: 50/min → 10/min (-80%)

### 6.3 缓存命中率

- 初期: 40% (仅 billing /usage/report)
- 优化后目标: 80%+
- 稳定运行后: 85-90%

---

## 七、实施清单

### Phase 1: 核心服务 (1-2 天)
- [ ] offer.GetOffer() 缓存
- [ ] billing.GetTokenBalance() 缓存
- [ ] offer/billing 更新操作主动失效缓存

### Phase 2: 聚合查询 (1 天)
- [ ] console.GetUserDashboard() 缓存
- [ ] 添加 X-Cache HTTP 响应头

### Phase 3: 扩展覆盖 (1-2 天)
- [ ] adscenter.GetAccount() 缓存
- [ ] siterank 评分结果缓存

### Phase 4: 监控和调优 (0.5-1 天)
- [ ] 添加缓存命中率 metrics
- [ ] Cloud Monitoring Dashboard
- [ ] 调优 TTL 参数

**总工作量**: 3-5 天
**预期部署**: 2025-10-14

---

**编写人**: Claude (AI 架构顾问)
**创建日期**: 2025-10-07
**实施优先级**: P0 (高优先级)
