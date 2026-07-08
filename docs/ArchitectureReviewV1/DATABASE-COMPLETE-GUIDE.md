# 数据库架构分析与优化完整指南

**项目类型**: 多用户 SaaS 系统（无租户概念，用户级隔离）  
**分析日期**: 2025-10-09  
**状态**: 未上线，预发和生产共用数据库  
**可直接执行**: 是（低风险）

---

## 📊 系统特征

### 多用户 SaaS 架构

- **用户隔离**: 每个用户独立账号，通过 `userId` 字段隔离所有数据
- **无租户概念**: 不存在组织/团队层级，纯用户级别
- **认证方式**: Google OAuth (Supabase Auth)
- **数据访问**: 所有查询都基于 `WHERE "userId" = $1`

### 双数据库架构

**Supabase PostgreSQL** ($25/月)
- 用户认证 (auth.users)
- 前端应用数据 (public.users, organizations)
- 连接: `aws-1-ap-northeast-1.pooler.supabase.com:5432`

**Cloud SQL PostgreSQL** ($100/月)
- 微服务业务数据
- 实例: `autoads` / 数据库: `autoads_db`
- 访问: VPC Connector (内网)

### 核心发现

✅ **优势**:
- 职责分离清晰（认证 vs 业务）
- 用户隔离完善（所有表都有 userId）
- 成本优化（$125/月 vs $200+/月）

⚠️ **问题**:
- 缺少关键索引（影响多用户并发查询）
- User 表重复（Supabase + Cloud SQL）
- 无数据同步机制
- 连接池配置未优化

**总体评分**: 7.5/10 (良好，需要优化)

---

## 🚀 立即优化（1-2 小时，今天就做）

### 步骤 1: 备份数据库（5 分钟）

```bash
# Cloud SQL 备份
gcloud sql backups create \
  --instance=autoads \
  --description="优化前备份-$(date +%Y%m%d)"

# Supabase 备份
# 访问: https://supabase.com/dashboard/project/jzzvizacfyipzdyiqfzb/database/backups
```

### 步骤 2: 添加性能索引（30 分钟）

**问题**: 多用户查询缺少复合索引，导致全表扫描

创建迁移文件：

```bash
cat > database/migrations/000005_add_performance_indexes.up.sql << 'EOF'
-- ============================================
-- 多用户 SaaS 性能优化索引
-- 创建日期: 2025-10-09
-- 用户隔离: 所有查询都基于 userId
-- ============================================

-- Offer 表索引（用户级隔离）
CREATE INDEX IF NOT EXISTS idx_offer_user_status 
  ON "Offer"("userId", "status");

CREATE INDEX IF NOT EXISTS idx_offer_user_created 
  ON "Offer"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_offer_status_created 
  ON "Offer"("status", "createdAt" DESC);

-- TokenTransaction 表索引（用户级隔离）
CREATE INDEX IF NOT EXISTS idx_token_tx_user_type 
  ON "TokenTransaction"("userId", "type");

CREATE INDEX IF NOT EXISTS idx_token_tx_type_created 
  ON "TokenTransaction"("type", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_token_tx_source 
  ON "TokenTransaction"("source");

CREATE INDEX IF NOT EXISTS idx_token_tx_status 
  ON "TokenTransaction"("status") 
  WHERE "status" = 'pending';

-- Subscription 表索引（用户级，一对一关系）
CREATE INDEX IF NOT EXISTS idx_subscription_status 
  ON "Subscription"("status");

CREATE INDEX IF NOT EXISTS idx_subscription_period_end 
  ON "Subscription"("currentPeriodEnd") 
  WHERE "status" = 'active';

-- UserAdsConnection 表索引（用户级隔离）
CREATE INDEX IF NOT EXISTS idx_userads_login_customer 
  ON "UserAdsConnection"("loginCustomerId");

-- BulkAudit 表索引（用户级隔离）
CREATE INDEX IF NOT EXISTS idx_bulk_audit_user_created 
  ON "BulkAudit"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_bulk_audit_status 
  ON "BulkAudit"("status");

-- Event 表索引（事件溯源）
CREATE INDEX IF NOT EXISTS idx_event_created 
  ON "Event"("createdAt" DESC);

-- AuditEvents 索引
CREATE INDEX IF NOT EXISTS idx_audit_events_entity 
  ON "AuditEvents"("entityType", "entityId");

CREATE INDEX IF NOT EXISTS idx_audit_events_created 
  ON "AuditEvents"("createdAt" DESC);

-- 更新统计信息
ANALYZE "Offer";
ANALYZE "TokenTransaction";
ANALYZE "Subscription";
ANALYZE "UserAdsConnection";
ANALYZE "BulkAudit";
ANALYZE "Event";
ANALYZE "AuditEvents";
EOF
```

执行迁移：

```bash
# 获取数据库连接
export DATABASE_URL=$(gcloud secrets versions access latest --secret="DATABASE_URL")

# 执行迁移
psql $DATABASE_URL -f database/migrations/000005_add_performance_indexes.up.sql

# 验证索引
psql $DATABASE_URL -c "
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
"
```

**预期提升**: 用户查询速度提升 5-10 倍

### 步骤 3: 优化连接池配置（15 分钟）

**问题**: 默认配置不适合多用户并发

创建优化的连接池：

```go
// pkg/database/pool.go
package database

import (
    "context"
    "database/sql"
    "fmt"
    "time"
    
    _ "github.com/lib/pq"
)

func NewOptimizedConnection(dsn string) (*sql.DB, error) {
    db, err := sql.Open("postgres", dsn)
    if err != nil {
        return nil, fmt.Errorf("failed to open database: %w", err)
    }
    
    // 多用户 SaaS 优化配置
    db.SetMaxOpenConns(25)                      // 支持 25 个并发用户
    db.SetMaxIdleConns(10)                      // 保持 10 个空闲连接
    db.SetConnMaxLifetime(5 * time.Minute)      // 连接最大生命周期
    db.SetConnMaxIdleTime(2 * time.Minute)      // 空闲连接超时
    
    // 验证连接
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    if err := db.PingContext(ctx); err != nil {
        db.Close()
        return nil, fmt.Errorf("ping failed: %w", err)
    }
    
    return db, nil
}
```

更新各服务：

```bash
# 在 services/billing/internal/pkg/database/database.go
# 在 services/offer/internal/handlers/http.go
# 在 services/adscenter/main.go
# 将 database.NewConnection(dsn) 替换为 database.NewOptimizedConnection(dsn)
```

**预期提升**: 连接复用率提升 40%

### 步骤 4: 添加查询超时（10 分钟）

**问题**: 某个用户的慢查询影响其他用户

```go
// pkg/database/context.go
package database

import (
    "context"
    "time"
)

func WithQueryTimeout(ctx context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
    if timeout == 0 {
        timeout = 10 * time.Second
    }
    return context.WithTimeout(ctx, timeout)
}

// 使用示例
func (r *OfferRepository) ListByUser(ctx context.Context, userID string) ([]*Offer, error) {
    ctx, cancel := WithQueryTimeout(ctx, 5*time.Second)
    defer cancel()
    
    rows, err := r.db.QueryContext(ctx, `
        SELECT id, name, status, "createdAt"
        FROM "Offer"
        WHERE "userId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 100
    `, userID)
    
    // ... 处理结果
}
```

### 步骤 5: 验证性能（10 分钟）

```sql
-- 测试用户查询性能
EXPLAIN ANALYZE
SELECT id, name, status, "createdAt"
FROM "Offer"
WHERE "userId" = 'test-user-id'
  AND "status" = 'active'
ORDER BY "createdAt" DESC
LIMIT 20;

-- 应该看到 "Index Scan using idx_offer_user_status"
-- Execution Time 应该 < 10ms

-- 查看索引使用情况
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 20;
```

---

## 📋 中期优化（1-2 周）

### 优化 6: 实现用户数据同步

**问题**: Supabase 和 Cloud SQL 的 User 表数据可能不一致

**方案**: Supabase 触发器 → Pub/Sub → Cloud SQL

```sql
-- Supabase: 创建同步函数
CREATE OR REPLACE FUNCTION notify_user_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'user_sync',
    json_build_object(
      'action', TG_OP,
      'user_id', NEW.id,
      'email', NEW.email,
      'name', NEW.display_name,
      'timestamp', NOW()
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_sync_trigger
AFTER INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION notify_user_change();
```

**Cloud Function 监听器**:

```go
func SyncUserToCloudSQL(ctx context.Context, m pubsub.Message) error {
    var event UserSyncEvent
    json.Unmarshal(m.Data, &event)
    
    _, err := db.ExecContext(ctx, `
        INSERT INTO "User" (id, email, "createdAt", "updatedAt")
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            "updatedAt" = NOW()
    `, event.UserID, event.Email)
    
    return err
}
```

**工作量**: 3-5 天

### 优化 7: 实现查询缓存

**问题**: 高频用户查询重复访问数据库

```go
// pkg/cache/user_cache.go
type UserCache struct {
    redis *redis.Client
}

func (c *UserCache) GetUserOffers(ctx context.Context, userID string) ([]*Offer, error) {
    key := fmt.Sprintf("user:%s:offers", userID)
    
    // 尝试从缓存获取
    val, err := c.redis.Get(ctx, key).Result()
    if err == nil {
        var offers []*Offer
        json.Unmarshal([]byte(val), &offers)
        return offers, nil
    }
    
    // 缓存未命中，查询数据库
    offers, err := c.fetchFromDB(ctx, userID)
    if err != nil {
        return nil, err
    }
    
    // 写入缓存
    data, _ := json.Marshal(offers)
    c.redis.Set(ctx, key, data, 5*time.Minute)
    
    return offers, nil
}
```

**缓存策略**（用户级）:
- 用户 Offer 列表: 5 分钟
- 用户 Token 余额: 1 分钟
- 用户订阅状态: 10 分钟

**预期提升**: 数据库负载降低 40-60%

**工作量**: 1 周

### 优化 8: 添加数据库监控

```go
// pkg/metrics/db_metrics.go
var (
    activeUsersGauge = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "active_users_total",
            Help: "Number of active users",
        },
    )
    
    userQueryDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "user_query_duration_seconds",
            Help: "User query duration by user",
        },
        []string{"query_type"},
    )
    
    dbConnectionsInUse = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "db_connections_in_use",
            Help: "Database connections in use",
        },
    )
)
```

**告警规则**:
- 单用户查询过慢: P95 > 1s
- 用户数据不一致
- 连接池耗尽

**工作量**: 3 天

---

## 🔒 安全性增强

### 优化 9: 加密敏感字段

**问题**: refreshToken 明文存储

```go
// pkg/crypto/encryption.go
type FieldEncryptor struct {
    key []byte
}

func (e *FieldEncryptor) Encrypt(plaintext string) (string, error) {
    block, _ := aes.NewCipher(e.key)
    gcm, _ := cipher.NewGCM(block)
    nonce := make([]byte, gcm.NonceSize())
    rand.Read(nonce)
    ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
    return base64.StdEncoding.EncodeToString(ciphertext), nil
}
```

**工作量**: 3-5 天

### 优化 10: 实现 Row Level Security

**Supabase RLS**:

```sql
-- 用户只能访问自己的数据
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_select_own ON public.users
  FOR SELECT
  USING (auth.uid() = id);
```

**Cloud SQL RLS**:

```sql
ALTER TABLE "Offer" ENABLE ROW LEVEL SECURITY;

CREATE POLICY offer_user_isolation ON "Offer"
  FOR ALL
  USING ("userId" = current_setting('app.current_user_id'));
```

**工作量**: 1 周

---

## 📊 预期收益总结

| 优化项 | 性能提升 | 工作量 | 优先级 |
|--------|---------|--------|--------|
| 添加索引 | 5-10x | 30分钟 | P0 ⭐ |
| 连接池优化 | 40% | 15分钟 | P0 ⭐ |
| 查询超时 | 防阻塞 | 10分钟 | P0 ⭐ |
| 用户同步 | 一致性 | 3-5天 | P1 |
| 查询缓存 | 40-60% | 1周 | P1 |
| 数据库监控 | 可观测性 | 3天 | P1 |
| 加密字段 | 安全性 | 3-5天 | P2 |
| RLS | 安全性 | 1周 | P2 |

**总计**: 性能提升 50-80%，工作量 2-3 周

---

## ✅ 今天的行动清单

- [ ] 备份数据库（5 分钟）
- [ ] 创建并执行索引迁移（30 分钟）
- [ ] 更新连接池配置（15 分钟）
- [ ] 添加查询超时控制（10 分钟）
- [ ] 验证性能提升（10 分钟）
- [ ] 更新文档（5 分钟）

**总时间**: 约 1-2 小时  
**风险**: 低（可回滚）  
**收益**: 查询性能提升 5-10 倍

---

## 🔄 回滚方案

如果出现问题：

```bash
# 删除索引
psql $DATABASE_URL -c "
DROP INDEX IF EXISTS idx_offer_user_status;
DROP INDEX IF EXISTS idx_offer_user_created;
-- ... 其他索引
"

# 恢复连接池配置
# 将代码改回原配置

# 重启服务
gcloud run services update billing-preview --region=asia-northeast1
```

---

**文档版本**: 1.0  
**最后更新**: 2025-10-09  
**下一步**: 执行立即优化，然后准备上线

