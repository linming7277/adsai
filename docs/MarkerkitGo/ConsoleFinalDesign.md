# Console 服务最终设计方案

**日期**: 2025-10-06
**定位**: Admin UI 的 BFF (Backend for Frontend)

---

## 一、核心定位 ✅

Console 应该是：
- ✅ **薄薄的聚合层** (Thin aggregation layer)
- ✅ **无业务逻辑** (No business logic)
- ✅ **只调用 API，不操作数据库** (API-only)
- ✅ **为管理员 UI 优化** (Admin-UI-specific)

**关键原则**：
- Console 不拥有业务数据
- Console 不实现业务规则
- Console 只做数据聚合、格式转换、批量编排

---

## 二、管理后台功能需求

根据实际需求，后台管理系统包括：

1. **仪表盘** - 全局数据概览
2. **用户管理** - 用户 CRUD、角色管理
3. **套餐管理** - 订阅计划配置
4. **Token 管理** - Token 余额、消耗规则
5. **API 管理** - API Keys 管理
6. **动态配置** - 系统配置热更新

---

## 三、端点设计策略

### 3.1 分类原则

**A 类：直接代理** (Console 直接调用单个服务 API)
- Console 只做认证转发和格式转换
- 不聚合多个服务
- 示例：`GET /api/v1/admin/users` → 直接调用 `billing` 或 `user` 服务

**B 类：聚合编排** (Console 调用多个服务并聚合数据)
- Console 的核心价值
- 并发调用、部分失败容错
- 示例：`GET /api/v1/admin/dashboard` → 聚合 offer + billing + adscenter

**C 类：批量操作编排** (Console 编排批量调用)
- 要求各服务提供批量 API
- Console 只负责编排和结果汇总
- 示例：`POST /api/v1/admin/bulk/offers/status` → 调用 offer 的批量 API

### 3.2 数据访问规则

| 数据类型 | 访问方式 | 示例 |
|---------|---------|------|
| **业务数据** | ❌ 不能直接查询 DB<br>✅ 必须通过服务 API | User、Offer、Token 余额 |
| **聚合数据** | ✅ 可以查询只读副本<br>✅ 必须通过服务 API 为主 | 统计、报表 (优先用 API) |
| **配置数据** | ✅ 可以查询自己的配置表 | `console_config` 表 |

---

## 四、端点完整列表

### 4.1 基础端点 (4个)

```
GET  /healthz             # Kubernetes liveness
GET  /health              # Simple health check
GET  /readyz              # Kubernetes readiness (检查依赖服务)
GET  /api/health          # Detailed health status
```

### 4.2 仪表盘功能 (3个) - **B 类：聚合编排**

```
GET  /api/v1/admin/dashboard                    # 全局仪表板
     → 聚合：用户总数、活跃 Offer 数、Token 消耗、收入统计
     → 调用：billing, offer, adscenter APIs

GET  /api/v1/admin/dashboard/user/{userId}      # 用户详情仪表板
     → 聚合：用户的 offers、tokens、accounts、recent activity
     → 调用：offer, billing, adscenter, siterank APIs

GET  /api/v1/admin/health/services              # 服务健康聚合
     → 聚合：所有微服务的健康状态
     → 调用：各服务的 /health endpoints
```

### 4.3 用户管理 (5个) - **B 类：聚合 Supabase + Billing**

```
GET    /api/v1/admin/users                      # 用户列表（聚合）
       → Supabase Admin API: 获取用户认证信息
       → Billing API: 获取用户业务数据（Token 余额、订阅）
       → Console 聚合两个数据源

GET    /api/v1/admin/users/{userId}             # 用户详情（聚合）
       → Supabase Admin API: 用户认证信息
       → Billing API: 业务数据详情
       → Offer API: 用户的 Offer 数量
       → Adscenter API: 用户的 Account 数量
       → Console 聚合所有数据

POST   /api/v1/admin/users/{userId}/role        # 更新用户角色（直接）
       → Supabase Admin API: updateUserMetadata()
       → 更新 app_metadata.role

GET    /api/v1/admin/users/{userId}/activity    # 用户活动日志（代理）
       → Billing API: getUserActivity(userId)
       → 返回 Token 操作、订阅变更等日志

DELETE /api/v1/admin/users/{userId}             # 删除用户（编排）
       → Supabase Admin API: deleteUser()
       → Billing API: 归档用户数据（软删除）
       → Offer API: 归档用户的 Offers
       → Console 编排删除流程
```

**架构设计**：
- **用户认证数据**：存储在 Supabase Auth
- **用户业务数据**：存储在各服务的 PostgreSQL
- **Console 职责**：
  - 直接调用 Supabase Admin API (认证操作)
  - 直接调用 Billing/Offer API (业务数据)
  - 聚合多个数据源为统一的管理视图

**为什么不让 Billing 封装 Supabase？**
- ✅ 职责清晰：Billing 只管计费，Supabase 只管认证
- ✅ 减少耦合：Console 已经是聚合层，不需要 Billing 做二次代理
- ✅ 简化架构：Console 直接调用第三方 API (类似 Stripe、SendGrid)

### 4.4 套餐管理 (4个) - **A 类：直接代理**

```
GET    /api/v1/admin/plans                      # 套餐列表
       → 调用：billing.GetPlans()

POST   /api/v1/admin/plans                      # 创建套餐
       → 调用：billing.CreatePlan()

PUT    /api/v1/admin/plans/{planId}             # 更新套餐
       → 调用：billing.UpdatePlan(planId)

DELETE /api/v1/admin/plans/{planId}             # 删除套餐
       → 调用：billing.DeletePlan(planId)
```

**前置条件**：`billing` 服务需要提供套餐管理 API。

### 4.5 Token 管理 (6个) - **A 类：直接代理 + B 类：聚合**

```
GET    /api/v1/admin/tokens/stats               # Token 全局统计 (B类)
       → 聚合：总充值、总消耗、活跃用户
       → 调用：billing.GetTokenStats()

GET    /api/v1/admin/tokens/balances            # 所有用户余额列表 (A类)
       → 调用：billing.GetAllUserBalances()

POST   /api/v1/admin/tokens/topup               # 单个用户充值 (A类)
       → 调用：billing.TopUpTokens(userId, amount)

GET    /api/v1/admin/tokens/rules               # Token 消耗规则列表 (A类)
       → 调用：billing.GetTokenRules()

POST   /api/v1/admin/tokens/rules               # 创建消耗规则 (A类)
       → 调用：billing.CreateTokenRule()

PUT    /api/v1/admin/tokens/rules/{ruleId}      # 更新消耗规则 (A类)
       → 调用：billing.UpdateTokenRule(ruleId)
```

**前置条件**：`billing` 服务需要提供这些管理 API。

### 4.6 API Keys 管理 (4个) - **A 类：直接代理**

```
GET    /api/v1/admin/apikeys                    # API Keys 列表
       → 调用：auth.GetAPIKeys() 或查询 console_config 表

POST   /api/v1/admin/apikeys                    # 创建 API Key
       → 调用：auth.CreateAPIKey()

DELETE /api/v1/admin/apikeys/{keyId}            # 删除 API Key
       → 调用：auth.DeleteAPIKey(keyId)

GET    /api/v1/admin/apikeys/validate           # 验证 API Key (内部服务调用)
       → 调用：auth.ValidateAPIKey()
```

**选项**：
- **选项 A**：创建独立的 `auth` 服务管理 API Keys
- **选项 B**：Console 自己管理 API Keys (存储在 `console_config` 表)
  - ⚠️ 如果选择选项 B，这是唯一允许 Console 直接操作数据库的场景

### 4.7 动态配置管理 (4个) - **A 类：直接代理**

```
GET    /api/v1/admin/config                     # 配置列表
       → 调用：各服务的 /config API 或 Secret Manager

GET    /api/v1/admin/config/{key}               # 获取配置项
       → 调用：对应服务的 API

PUT    /api/v1/admin/config/{key}               # 更新配置项
       → 调用：对应服务的 API (热更新)

GET    /api/v1/admin/config/history             # 配置变更历史
       → 调用：各服务的审计日志 API
```

**注意**：
- 配置数据应该在各服务内部管理
- Console 只做代理和聚合展示
- 推荐使用 Secret Manager + 服务本地缓存

### 4.8 批量操作 (3个) - **C 类：批量编排**

```
POST   /api/v1/admin/bulk/offers/status         # 批量更新 Offer 状态
       → 调用：offer.BulkUpdateStatus(offerIds, status)

POST   /api/v1/admin/bulk/tokens/topup          # 批量充值 Token
       → 调用：billing.BulkTopUpTokens(topups[])

POST   /api/v1/admin/bulk/users/notify          # 批量通知用户
       → 调用：notifications.BulkSendNotifications(userIds, message)
```

**前置条件**：各服务必须提供批量 API，Console 不能自己循环调用单个 API。

### 4.9 报表导出 (3个) - **B 类：聚合编排**

```
GET    /api/v1/admin/reports/token-usage        # Token 使用报表 (CSV/Excel)
       → 聚合：用户列表 + 各用户的 Token 使用情况
       → 调用：billing.GetAllUserTokenUsage(startDate, endDate)

GET    /api/v1/admin/reports/revenue            # 收入报表
       → 聚合：订阅收入 + Token 充值
       → 调用：billing.GetRevenueReport(startDate, endDate)

GET    /api/v1/admin/reports/offers             # Offer 报表
       → 聚合：所有 Offer + KPI
       → 调用：offer.GetAllOffersWithKPI()
```

**注意**：
- 优先让各服务提供报表 API
- Console 只负责格式转换 (JSON → CSV/Excel)
- 如果需要跨服务聚合，Console 负责编排

### 4.10 运维端点 (1个)

```
GET    /ops/console/config/v1                   # 配置快照 (供其他服务读取)
       → 查询：console_config 表 (只读)
```

---

## 五、端点总结

| 分类 | 数量 | 说明 |
|------|------|------|
| 基础端点 | 4 | Health checks |
| 仪表盘聚合 | 3 | **B 类：核心 BFF 价值** |
| 用户管理 | 5 | **B 类：聚合 Supabase + Billing** ⭐ |
| 套餐管理 | 4 | **A 类：代理 billing 服务** |
| Token 管理 | 6 | **A+B 类：代理 + 聚合** |
| API Keys | 4 | **自己实现** (Console 管理) |
| 动态配置 | 4 | **A 类：代理各服务** |
| 批量操作 | 3 | **C 类：编排批量 API** |
| 报表导出 | 3 | **B 类：聚合 + 格式转换** |
| 运维端点 | 1 | 配置快照 |
| **总计** | **37** | **合理且必要** |

---

## 六、与之前方案的对比

| 维度 | 之前实现 | 最终方案 | 改进 |
|------|---------|---------|------|
| **端点数量** | 31 | 37 | 增加 6 个必要的管理端点 |
| **数据访问** | ❌ 混乱：有些直接查 DB | ✅ 清晰：优先调用 API | **架构清晰** |
| **批量操作** | ❌ 自己循环调用 API | ✅ 调用服务的批量 API | **性能优化** |
| **用户管理** | ⚠️ 不完整 | ✅ 完整的 CRUD + 角色管理 | **功能完善** |
| **套餐管理** | ❌ 没有 | ✅ 完整的 CRUD | **新增功能** |
| **配置管理** | ⚠️ 自己存储配置 | ✅ 代理各服务的配置 API | **职责清晰** |

---

## 七、前置条件：各服务需要提供的 API

### 7.1 Billing 服务需要新增

```
# 用户业务数据 API (不再管理认证)
GET    /api/v1/users/{userId}/billing-info      # 用户业务信息
       → 返回：Token 余额、订阅状态、套餐信息

GET    /api/v1/users/{userId}/activity          # 用户活动日志
       → 返回：Token 操作、订阅变更等历史记录

POST   /api/v1/users/{userId}/archive           # 归档用户数据
       → 软删除用户的业务数据（配合 Supabase 删除）

# 套餐管理
GET    /api/v1/plans
POST   /api/v1/plans
PUT    /api/v1/plans/{planId}
DELETE /api/v1/plans/{planId}

# Token 管理 API
GET    /api/v1/tokens/stats                     # 全局统计
GET    /api/v1/tokens/balances                  # 所有用户余额
GET    /api/v1/tokens/rules                     # 消耗规则列表
POST   /api/v1/tokens/rules                     # 创建规则
PUT    /api/v1/tokens/rules/{ruleId}            # 更新规则

# 批量操作
POST   /api/v1/tokens/bulk/topup                # 批量充值

# 报表
GET    /api/v1/reports/token-usage              # Token 使用报表
GET    /api/v1/reports/revenue                  # 收入报表
```

### 7.2 Offer 服务需要新增

```
# 批量操作
POST   /api/v1/offers/bulk/status               # 批量更新状态

# 报表
GET    /api/v1/reports/offers                   # Offer 报表 (带 KPI)
```

### 7.3 Auth 服务 (可选，如果独立)

```
GET    /api/v1/apikeys
POST   /api/v1/apikeys
DELETE /api/v1/apikeys/{keyId}
GET    /api/v1/apikeys/validate
```

### 7.4 各服务通用

```
GET    /api/v1/config                           # 获取配置列表
GET    /api/v1/config/{key}                     # 获取配置项
PUT    /api/v1/config/{key}                     # 更新配置项 (热更新)
GET    /api/v1/config/history                   # 配置变更历史
```

---

## 八、实施计划

### Phase 1: 完善现有 BFF 功能 (已完成 ✅)

- ✅ 创建服务客户端层 (offer, billing, adscenter, siterank)
- ✅ 实现仪表板聚合端点
- ✅ 实现服务健康聚合
- ✅ 实现报表导出基础

### Phase 2: 补充管理功能端点 (本周)

1. **Console 集成 Supabase Admin API**
   - Console 创建 `internal/supabase/` 包
   - 实现 Supabase Admin API 客户端
   - 实现用户管理端点 (直接调用 Supabase)

2. **Billing 提供用户业务数据 API**
   - 用户业务信息端点
   - 用户活动日志端点
   - 用户归档端点

3. **套餐管理端点** (代理 billing 服务)
   - 等待 billing 服务提供 API
   - 实现代理层

4. **完善 Token 管理** (代理 billing 服务)
   - 等待 billing 服务提供完整 API
   - 实现统计聚合

5. **API Keys 管理**
   - Console 自己实现 API Keys 管理
   - 创建 api_keys 表
   - 实现管理端点

### Phase 3: 优化批量操作 (下周)

1. **要求各服务提供批量 API**
   - billing: bulk topup
   - offer: bulk status update

2. **Console 改为调用批量 API**
   - 删除自己循环调用的实现
   - 使用服务提供的批量 API

### Phase 4: 配置管理 (2周内)

1. **各服务提供配置 API**
2. **Console 实现配置聚合和代理**
3. **集成 Secret Manager**

---

## 九、架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin UI (Frontend)                     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Console Service (BFF - 37 Endpoints)           │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Aggregation  │  │ Proxy Layer  │  │ Orchestration│    │
│  │  (B类: 9个)  │  │ (A类: 23个)  │  │  (C类: 3个)  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└───┬─────────┬─────────┬─────────┬─────────┬──────────┬────┘
    │         │         │         │         │          │
    ↓         ↓         ↓         ↓         ↓          ↓
┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐
│ Offer  ││Billing ││Adscenter││Siterank││Supabase││Secret  │
│Service ││Service ││ Service ││Service ││  Auth  ││Manager │
└────────┘└────────┘└────────┘└────────┘└────────┘└────────┘
    │         │         │         │
    ↓         ↓         ↓         ↓
┌─────────────────────────────────────┐
│        PostgreSQL (Schema 隔离)      │
│  offer_db | billing_db | ...        │
└─────────────────────────────────────┘
```

**核心原则**：
- Console 不直接访问业务数据库 (除了自己的 console_config 表)
- Console 通过服务 API 获取所有业务数据
- Console 负责聚合、编排、格式转换

---

## 十、总结

### 10.1 端点合理性

**37 个端点是合理的**，因为：
- ✅ 覆盖了完整的管理后台需求
- ✅ 严格遵守 BFF 原则（薄聚合层）
- ✅ 不实现业务逻辑，只做代理和聚合
- ✅ 分类清晰：A类代理 (23个)、B类聚合 (9个)、C类编排 (3个)

### 10.2 与微服务原则的一致性

| 原则 | 符合度 | 说明 |
|------|--------|------|
| Single Responsibility | ✅ | Console 只做管理后台的 BFF |
| Bounded Context | ✅ | 不跨越业务边界，只聚合数据 |
| Loose Coupling | ✅ | 通过 API 调用，不直接操作数据库 |
| Service Autonomy | ✅ | 各服务保持数据自治 |
| API-First | ✅ | 所有数据访问通过 API |

### 10.3 关键成功因素

1. **各服务提供完整的管理 API** - 前置条件
2. **批量 API 优先** - 性能保证
3. **Supabase Admin API** - 用户认证管理（由 billing 服务封装）
4. **断路器和超时** - 可靠性保证
5. **只读查询优化** - 如果必须查询 DB，使用只读副本

---

**结论**：Console 服务的 37 个端点是合理且必要的，符合"薄聚合层"的 BFF 定位。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
