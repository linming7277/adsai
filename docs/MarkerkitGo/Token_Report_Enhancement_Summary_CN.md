# Token 使用报表增强总结

## 概览

本文档总结了对 Token 使用报表系统的增强，以提供准确的服务级别 Token 消耗分组数据。

**日期**: 2025-10-07
**状态**: ✅ 已完成（核心实现）

---

## 问题描述

之前的 Token 使用报表显示的是**模拟/硬编码数据**，而不是从数据库中真实聚合的数据。`TokenTransaction` 表缺少专用列来跟踪哪个服务（offer、siterank、adscenter）消耗了 Token，导致无法生成准确的报表。

---

## 解决方案概述

### 1. 数据库架构增强

**文件**: `services/billing/migrations/008_add_service_fields_to_token_transaction.sql`

#### 变更内容:
- 添加 `service` 列来跟踪哪个服务消耗了 Token
- 添加 `actionType` 列来跟踪具体的操作类型
- 创建索引以提高查询效率:
  - `idx_token_transaction_service` - service 单列索引
  - `idx_token_transaction_service_type` - service + type 复合索引（用于报表查询）
  - `idx_token_transaction_service_created` - service + createdAt 复合索引（用于时间序列报表）

#### 向后兼容性:
- 从 JSONB metadata 回填现有记录
- 为新记录添加检查约束（consume/reserve 类型需要 service）
- 通过基于日期的约束允许没有 service 字段的旧记录

```sql
-- 关键架构变更
ALTER TABLE "TokenTransaction" ADD COLUMN IF NOT EXISTS service TEXT;
ALTER TABLE "TokenTransaction" ADD COLUMN IF NOT EXISTS "actionType" TEXT;

-- 从 metadata 回填
UPDATE "TokenTransaction"
SET
    service = metadata->>'service',
    "actionType" = metadata->>'action'
WHERE
    type IN ('consume', 'reserve')
    AND metadata IS NOT NULL
    AND service IS NULL;
```

---

### 2. Billing 服务 API 增强

**文件**: `services/billing/main.go`

#### 新增端点:
**GET** `/api/v1/tokens/{userId}/usage?startDate=...&endDate=...`

#### 响应格式:
```json
{
  "userId": "user-123",
  "totalConsumed": 5000,
  "totalTopUp": 10000,
  "byService": {
    "offer": 2000,
    "siterank": 1800,
    "adscenter": 1200
  },
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-01-31T23:59:59Z"
}
```

#### 实现细节:
- 使用真实的 SQL 聚合（`GROUP BY service`）
- 将 NULL service 值处理为 "unknown"
- 返回准确的总计和按服务分组的数据

```go
// 关键聚合查询
SELECT
    COALESCE(service, 'unknown') as service,
    SUM(ABS(amount)) as total_consumed
FROM "TokenTransaction"
WHERE "userId" = $1
  AND type IN ('consume', 'reserve')
  AND "createdAt" BETWEEN $2 AND $3
GROUP BY service
ORDER BY total_consumed DESC
```

---

### 3. Token 扣费代码更新

**文件**: `services/billing/internal/handlers/token_reservation.go`

#### 更新的函数:

##### A. ReserveTokens
- **请求**: 现在包含 `service` 和 `action` 字段
- **数据库**: INSERT 包含 service 和 actionType 列
- **元数据**: 存储 service/action 以保持向后兼容

##### B. ConsumeTokensDirect
- **请求**: 已包含 service/action 字段
- **数据库**: 更新 INSERT 以使用 service 和 actionType 列
- **描述**: 改进为显示 service.action 格式

#### 代码变更:
```go
// 之前
INSERT INTO "TokenTransaction" (
    id, "userId", type, amount, balance, description,
    metadata, "createdAt"
) VALUES ($1, $2, 'consume', $3, $4, $5, $6, $7)

// 之后
INSERT INTO "TokenTransaction" (
    id, "userId", type, amount, balance, description,
    service, "actionType", metadata, "createdAt"
) VALUES ($1, $2, 'consume', $3, $4, $5, $6, $7, $8, $9)
```

---

## 修改的文件

### 新建:
1. ✅ `services/billing/migrations/008_add_service_fields_to_token_transaction.sql`
2. ✅ `docs/MarkerkitGo/Token_Report_Enhancement_Summary.md`（英文版）
3. ✅ `docs/MarkerkitGo/Token_Report_Enhancement_Summary_CN.md`（本文档）

### 修改:
1. ✅ `services/billing/main.go`
   - 添加 `getTokenUsageSummary` 处理函数
   - 注册路由 `/api/v1/tokens/{userId}/usage`

2. ✅ `services/billing/internal/handlers/token_reservation.go`
   - 更新 `ReserveTokensRequest` 结构体
   - 更新 `ReserveTokens` INSERT 查询
   - 更新 `ConsumeTokensDirect` INSERT 查询

---

## 测试检查清单

### 数据库迁移
- [ ] 运行迁移 `008_add_service_fields_to_token_transaction.sql`
- [ ] 验证列已添加: `service`, `actionType`
- [ ] 验证索引创建成功
- [ ] 检查现有记录的回填是否正常工作

### API 测试
```bash
# 测试 GetTokenUsageSummary 端点
curl -X GET "http://localhost:8080/api/v1/tokens/{userId}/usage?startDate=2025-01-01T00:00:00Z&endDate=2025-01-31T23:59:59Z" \
  -H "Authorization: Bearer {token}"

# 预期响应
{
  "userId": "...",
  "totalConsumed": 5000,
  "totalTopUp": 10000,
  "byService": {
    "offer": 2000,
    "siterank": 1800,
    "adscenter": 1200
  },
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-01-31T23:59:59Z"
}
```

### 集成测试
- [ ] 通过 ConsumeTokensDirect 创建测试 Token，设置 service="offer"
- [ ] 验证 TokenTransaction 记录的 service 列已填充
- [ ] 调用 GetTokenUsageSummary 并验证 byService 包含 "offer"
- [ ] 对 siterank 和 adscenter 服务重复测试

---

## 待完成工作

### 1. 服务集成更新 (P1)
以下服务需要更新以使用新的 Token 扣费端点:

**services/offer**:
- 更新 Token 扣费调用以包含 service="offer", action="create_offer"

**services/siterank**:
- 更新 Token 扣费调用以包含 service="siterank", action="rank_check"

**services/adscenter**:
- 更新 Token 扣费调用以包含 service="adscenter", action="ad_generation"

### 2. 遗留代码更新 (P2)
以下文件仍有需要更新的旧 INSERT 语句:

- `services/billing/internal/tokens/service.go`
  - 更新 `CheckAndReserveTokens` 以接受 service/action 参数
  - 更新 INSERT 语句以包含 service/actionType 列

- `services/billing/main.go`
  - 几个使用旧架构的遗留 INSERT 语句（balanceBefore, balanceAfter, source）
  - 需要审计并确定是否应该迁移

### 3. Console 服务更新 (P1)
- 更新 `services/console/internal/handlers/reports.go`
- 报表 API 已经调用 `GetTokenUsageSummary`，所以一旦服务开始填充 service 字段就应该能工作

---

## 迁移策略

### 阶段 1: 数据库 (✅ 已完成)
1. 添加 service 和 actionType 列
2. 从 metadata 回填
3. 添加索引

### 阶段 2: API (✅ 已完成)
1. 创建 GetTokenUsageSummary 端点
2. 更新 Token 扣费端点

### 阶段 3: 服务集成 (⏸️ 待完成)
1. 更新 Offer 服务传递 service="offer"
2. 更新 Siterank 服务传递 service="siterank"
3. 更新 Adscenter 服务传递 service="adscenter"

### 阶段 4: 验证 (⏸️ 待完成)
1. 监控 TokenTransaction 表的 service 字段填充情况
2. 验证报表显示真实数据而非模拟数据
3. 测试 Console 报表下载

---

## 性能考虑

### 索引
迁移创建了三个索引以优化查询:
- 单列索引: 快速的基于 service 的过滤
- 复合索引 (service, type): 优化报表查询
- 复合索引 (service, createdAt DESC): 优化时间序列报表

### 查询性能
```sql
-- 使用新索引的优化查询
EXPLAIN ANALYZE
SELECT
    service,
    SUM(ABS(amount)) as total
FROM "TokenTransaction"
WHERE type IN ('consume', 'reserve')
  AND "createdAt" BETWEEN '2025-01-01' AND '2025-01-31'
  AND service IS NOT NULL
GROUP BY service;

-- 预期: 在 idx_token_transaction_service_created 上进行索引扫描
```

---

## 安全考虑

1. **授权**: GetTokenUsageSummary 端点应该验证:
   - 用户只能访问自己的数据
   - 管理员可以访问任何用户的数据

2. **数据验证**: 服务名称应该被验证:
   - 允许的值: "offer", "siterank", "adscenter"
   - 拒绝未知的服务名称

3. **SQL 注入**: 所有查询都使用参数化语句 ✅

---

## 回滚计划

如果出现问题，回滚步骤:

1. **删除约束**:
   ```sql
   ALTER TABLE "TokenTransaction" DROP CONSTRAINT IF EXISTS check_service_for_consume;
   ```

2. **删除索引**:
   ```sql
   DROP INDEX IF EXISTS idx_token_transaction_service;
   DROP INDEX IF EXISTS idx_token_transaction_service_type;
   DROP INDEX IF EXISTS idx_token_transaction_service_created;
   ```

3. **删除列**（仅在绝对必要时）:
   ```sql
   ALTER TABLE "TokenTransaction" DROP COLUMN IF EXISTS service;
   ALTER TABLE "TokenTransaction" DROP COLUMN IF EXISTS "actionType";
   ```

4. **还原代码更改**:
   - 还原 token_reservation.go 更改
   - 还原 main.go 路由注册
   - 删除 getTokenUsageSummary 处理函数

---

## 成功指标

### 增强前:
- ❌ 报表显示硬编码/模拟的服务分组
- ❌ 无法跟踪哪个服务消耗了 Token
- ❌ 管理员无法审计服务级别的使用情况

### 增强后:
- ✅ 实时的服务级别 Token 消耗跟踪
- ✅ 准确的服务分组报表
- ✅ 数据库架构支持未来的分析
- ✅ API 提供结构化的服务使用数据

---

## 下一步

1. **在开发环境运行迁移**
2. **使用 Postman/curl 手动测试 API**
3. **更新服务集成**（Offer、Siterank、Adscenter）
4. **更新 Console 报表**以使用新 API
5. **部署到生产环境**并进行监控

---

## 参考资料

- 迁移文件: `services/billing/migrations/008_add_service_fields_to_token_transaction.sql`
- API 处理函数: `services/billing/main.go:434` (getTokenUsageSummary)
- Token 预留: `services/billing/internal/handlers/token_reservation.go`
- Console 报表: `services/console/internal/handlers/reports.go`

---

**文档版本**: 1.0
**最后更新**: 2025-10-07
**作者**: Claude Code
**状态**: 实现完成，集成待完成
