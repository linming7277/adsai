# Console 服务重新设计方案

**日期**: 2025-10-06
**状态**: 提案中
**问题**: Console 服务端点过多 (31个)，职责不清晰

---

## 一、问题分析

### 1.1 当前状态

**端点数量**:
- 原有端点: 24 个
- 新增 BFF 端点: 7 个
- **总计: 31 个端点**

**职责混乱**:
- ❌ Token 管理 (8个端点) → 应该在 `billing` 服务
- ❌ User 管理 (2个端点) → 应该在独立的 `user/iam` 服务
- ❌ Config 热更新 (4个端点) → 应该在各服务内部
- ❌ API Keys 管理 (4个端点) → 应该在独立的 `auth/iam` 服务
- ✅ Dashboard/Health 聚合 (2个端点) → **正确的 BFF 职责**
- ⚠️ 批量操作 (3个端点) → 应该各服务提供批量 API
- ⚠️ 报表导出 (2个端点) → 部分合理

### 1.2 违反的原则

1. **Single Responsibility Principle (SRP)**
   - Console 不应该是业务逻辑的实现者
   - BFF 只应该做**聚合和编排**，不应该有业务逻辑

2. **Bounded Context**
   - Token 管理属于 `billing` 上下文
   - User 管理属于 `iam` 上下文
   - Console 跨越了太多上下文

3. **Service Autonomy**
   - 各服务应该提供完整的 CRUD API
   - Console 不应该绕过服务直接操作数据库

---

## 二、Console 服务的正确定位

### 2.1 什么是 BFF (Backend for Frontend)?

BFF 模式的核心原则：
- ✅ **聚合多个服务的数据** (Aggregation)
- ✅ **为特定前端优化响应格式** (Frontend-specific)
- ✅ **编排复杂的服务调用流程** (Orchestration)
- ❌ **不实现业务逻辑** (No business logic)
- ❌ **不直接操作数据库** (No direct DB access)

### 2.2 Console 应该做什么？

**核心职责**:
1. **管理员仪表板数据聚合**
   - 用户全景视图：聚合 offer + billing + adscenter + siterank
   - 系统健康状况：聚合各服务的 health endpoint
   - 跨服务统计报表

2. **管理员专用操作编排** (极度克制)
   - 批量操作：调用各服务的批量 API
   - 数据导出：聚合多服务数据并格式化

3. **运维工具**
   - 服务健康检查
   - 配置快照 (只读)

### 2.3 Console 不应该做什么？

❌ **不应该实现业务逻辑**:
- Token 充值/扣费 → `billing` 服务
- User CRUD → `user/iam` 服务
- Offer CRUD → `offer` 服务
- Config 热更新 → 各服务内部

❌ **不应该直接操作业务数据库**:
- 所有业务数据访问都应该通过服务 API
- Console 只能查询自己的配置表 (如 `console_config`)

❌ **不应该有复杂的业务规则**:
- 批量操作的业务验证应该在各服务内部
- Console 只负责调用和结果聚合

---

## 三、精简方案

### 3.1 应该删除的端点 (14个)

**1. Token 管理 (8个) → 移到 `billing` 服务**
- ❌ `GET /api/v1/console/tokens/stats`
- ❌ `GET /api/v1/console/tokens/balances`
- ❌ `POST /api/v1/console/tokens/topup`
- ❌ `GET /api/v1/console/tokens/rules`
- ❌ `POST /api/v1/console/tokens/rules`
- ❌ `GET /api/v1/console/tokens/rules/:id`
- ❌ `PUT /api/v1/console/tokens/rules/:id`
- ❌ `DELETE /api/v1/console/tokens/rules/:id`

**2. User 管理 (2个) → 移到独立的 `user` 服务**
- ❌ `GET /api/v1/console/users`
- ❌ `GET /api/v1/console/users/:id`

**3. Config 热更新 (3个) → 移到各服务或用 Secret Manager**
- ❌ `GET /api/v1/console/config`
- ❌ `GET /api/v1/console/config/history`
- ❌ `PUT /api/v1/console/config/:key`

**4. API Keys 管理 (4个) → 移到独立的 `auth` 服务**
- ❌ `GET /api/v1/console/apikeys`
- ❌ `POST /api/v1/console/apikeys`
- ❌ `GET /api/v1/console/apikeys/:id`
- ❌ `DELETE /api/v1/console/apikeys/:id`

### 3.2 应该保留的端点 (9个)

**1. 健康检查 (4个)**
- ✅ `GET /healthz`
- ✅ `GET /health`
- ✅ `GET /readyz`
- ✅ `GET /api/health`

**2. 配置快照 (只读) (1个)**
- ✅ `GET /ops/console/config/v1` - 供其他服务读取配置

**3. BFF 聚合端点 (2个) - 核心价值**
- ✅ `GET /api/v1/console/dashboard/{userId}` - **跨服务聚合**
- ✅ `GET /api/v1/console/health/services` - **健康状况聚合**

**4. 管理员统计 (1个)**
- ✅ `GET /api/v1/console/stats` - 全局统计（如果是聚合多服务的数据）
  - ⚠️ 需要检查实现：如果只查本地 DB，应该删除

**5. 报表导出 (1个) - 有条件保留**
- ✅ `GET /api/v1/console/reports/token-usage` - 跨服务聚合报表
- ❌ `GET /api/v1/console/reports/offer-metrics` → 应该在 `offer` 服务

### 3.3 需要重新设计的端点 (3个)

**批量操作应该改为"编排"而非"实现"**:

当前实现 (❌ 不合理):
```go
// Console 自己调用 offer service API 逐个更新
for _, offerID := range req.OfferIDs {
    offerClient.UpdateOfferStatus(ctx, offerID, ...)
}
```

正确实现 (✅ 合理):
```go
// Console 调用 offer service 的批量 API
offerClient.BulkUpdateOfferStatus(ctx, BulkUpdateRequest{
    OfferIDs: req.OfferIDs,
    Status: req.Status,
})
```

**结论**：
- ❌ 删除 Console 中的批量操作端点
- ✅ 要求各服务自己提供批量 API
- ✅ Console 只需调用这些批量 API（如果有跨服务编排需求）

---

## 四、重新设计后的 Console 架构

### 4.1 精简端点列表 (6-9个)

**基础端点 (4个)**:
```
GET  /healthz
GET  /health
GET  /readyz
GET  /api/health
```

**运维端点 (1个)**:
```
GET  /ops/console/config/v1  # 配置快照 (只读)
```

**BFF 核心端点 (2-3个)**:
```
GET  /api/v1/admin/dashboard/{userId}     # 用户全景聚合
GET  /api/v1/admin/health/services        # 服务健康聚合
GET  /api/v1/admin/stats                  # 全局统计 (可选)
```

**管理员报表 (1-2个)**:
```
GET  /api/v1/admin/reports/token-usage    # 跨服务 Token 报表
GET  /api/v1/admin/reports/system-overview # 系统全景报表 (可选)
```

**总计: 8-10 个端点** (vs 原来的 31 个)

### 4.2 代码结构简化

**删除的文件**:
- ❌ `internal/handlers/http.go` 中大量的 Token/User/Config/APIKey handlers
- ❌ `internal/handlers/bulk_operations.go` - 批量操作自己实现逻辑

**保留的文件**:
- ✅ `internal/clients/*.go` - 服务客户端 (用于聚合)
- ✅ `internal/handlers/aggregation.go` - 数据聚合端点
- ⚠️ `internal/handlers/reports.go` - 精简为只有跨服务报表

**新增的文件**:
- 无（已经够简单了）

### 4.3 依赖关系

Console 服务应该：
- ✅ **调用** 其他服务的 REST API (只读为主)
- ✅ **聚合** 多个服务的响应数据
- ✅ **编排** 复杂的跨服务操作流程
- ❌ **不直接操作** 业务服务的数据库表
- ❌ **不实现** 业务逻辑

---

## 五、迁移计划

### 5.1 短期 (立即执行)

1. **删除明显不合理的端点**:
   - Token 管理 (8个) - 已经在 billing 服务有了
   - API Keys 管理 (4个) - 应该独立

2. **精简 BFF 端点**:
   - 只保留 dashboard 和 health 聚合
   - 删除批量操作的自己实现

3. **更新文档**:
   - 明确 Console 定位为"Admin UI BFF"
   - 列出明确的职责边界

### 5.2 中期 (2周内)

1. **各服务补充批量 API**:
   - `offer` 服务提供 `POST /api/v1/offers/bulk/status`
   - `billing` 服务提供 `POST /api/v1/tokens/bulk/topup`

2. **创建独立的 User/IAM 服务** (如果需要):
   - User CRUD
   - Role 管理
   - Permission 管理

3. **配置管理方案**:
   - 使用 Secret Manager 存储配置
   - 各服务启动时读取配置
   - 删除 Console 的配置热更新功能

### 5.3 长期 (1个月内)

1. **完善监控和运维工具**:
   - 基于 Prometheus/Grafana 的系统仪表板
   - Cloud Logging 的日志聚合
   - Cloud Trace 的分布式追踪

2. **考虑使用 Admin SDK**:
   - Firebase Admin SDK 直接管理用户
   - 不需要单独的 User 服务

---

## 六、总结

### 6.1 核心原则

Console 服务应该是：
- ✅ **薄薄的一层聚合层** (Thin aggregation layer)
- ✅ **无状态** (Stateless)
- ✅ **只调用 API，不操作数据库** (API-only, no direct DB)
- ✅ **为管理员 UI 优化** (Admin-UI-specific)

### 6.2 端点数量对比

| 阶段 | 端点数量 | 说明 |
|------|---------|------|
| 原有 | 24 | 职责过多 |
| 新增 BFF | 31 (+7) | 更加混乱 |
| **精简后** | **8-10** (-21) | **清晰合理** |

### 6.3 下一步行动

1. ✅ **立即**: 删除不合理的端点
2. ⏳ **本周**: 各服务补充批量 API
3. ⏳ **2周内**: 迁移 Token/User 管理到各自服务
4. ⏳ **1个月**: 完善监控和运维工具

---

**结论**: Console 服务应该从 31 个端点精简到 8-10 个端点，专注于跨服务聚合和管理员仪表板，而不是实现业务逻辑。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
