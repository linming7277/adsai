# 微服务职责边界修正文档

**日期**: 2025-10-17
**状态**: 已识别并规划修正方案

---

## 🎯 问题总结

通过全面review系统架构和服务代码，发现以下微服务职责边界问题：

### 问题1: 数据库表归属错误 ⚠️

**问题描述**:
- `MustKnowV7.md`文档中将以下表错误地归属于siterank服务：
  - `checkins` - 签到记录
  - `user_checkin_stats` - 签到统计
  - `referrals` - 邀请关系
  - `trial_subscriptions` - 试用订阅

**实际情况**:
- 这些表实际属于**useractivity服务**
- siterank服务是网站评分服务，不应包含用户活动相关表
- 代码分析证实：useractivity服务有完整的签到、邀请追踪功能实现

**影响**:
- 文档与代码不一致，误导开发者
- 可能导致数据库迁移和表管理混乱

**修正方案**:
- ✅ 已更新`MustKnowV7.md`文档
- ✅ 已更新`all-services-analysis.md`文档
- ✅ 已在需求文档中明确标注

---

### 问题2: 试用订阅功能职责越界 ⚠️⚠️

**问题描述**:
- useractivity服务实现了试用订阅功能（`/api/v1/trial/*`）
- 创建了独立的`trial_subscriptions`表
- 与billing服务的`subscriptions`表形成数据孤岛

**职责冲突**:
- 试用订阅是**订阅管理**的一部分，应该属于billing服务
- useractivity服务无法直接修改billing服务的订阅数据
- 试用到期后需要降级用户套餐，但代码中只有TODO注释

**代码证据**:
```go
// services/useractivity/internal/handlers/referral_worker.go
// TODO: Call billing service to downgrade users to Starter plan
log.Printf("User %s trial expired, should be downgraded to Starter plan", userID)
// Future: Call billing service API
// billingClient.DowngradeToStarter(ctx, userID)
```

**修正方案**:
- ✅ 需求文档已规划：billing服务新增试用订阅API
- ✅ 需求文档已规划：useractivity服务调用billing服务API
- ✅ 需求文档已规划：数据迁移方案（trial_subscriptions → subscriptions）
- ✅ 需求文档已规划：废弃useractivity服务的试用订阅功能

---

### 问题3: 邀请追踪功能服务间耦合过紧 ⚠️

**问题描述**:
- 邀请追踪功能在useractivity服务实现 ✅
- 但创建试用订阅时直接操作`trial_subscriptions`表 ❌
- 服务间数据耦合，违反微服务边界原则

**代码证据**:
```go
// services/useractivity/internal/handlers/referral.go:trackReferral
// 直接插入trial_subscriptions表
_, err = tx.ExecContext(ctx, `
    INSERT INTO trial_subscriptions (...)
    VALUES (...)
`, ...)
```

**修正方案**:
- ✅ 需求文档已规划：useractivity服务保留邀请关系记录
- ✅ 需求文档已规划：通过serviceclient调用billing服务API创建试用订阅
- ✅ 需求文档已规划：解耦服务间数据依赖

---

### 问题4: 签到Token发放事务一致性问题 ⚠️

**问题描述**:
- 签到功能在useractivity服务
- Token发放需要同步调用billing服务
- 如果billing服务调用失败，签到成功但Token未发放，数据不一致

**当前实现**:
```go
// services/useractivity/internal/handlers/checkin.go
if err := h.creditTokensViaBilling(ctx, userID, tokensEarnedToday, ...); err != nil {
    log.Printf("Warning: Failed to credit tokens via billing service")
    // Don't fail the check-in if billing call fails
}
```

**问题分析**:
- 签到记录已保存，但Token未发放
- 用户看到签到成功，但Token余额未增加
- 缺少补偿机制或重试机制

**修正方案**:
- ✅ 需求文档已规划：改为事件驱动架构
- ✅ 需求文档已规划：useractivity发布CheckinCompleted事件
- ✅ 需求文档已规划：billing服务监听事件异步发放Token
- ✅ 需求文档已规划：Pub/Sub自动重试机制
- ✅ 需求文档已规划：死信队列（DLQ）处理失败事件

---

## 📋 修正方案总览

### 1. 文档修正（已完成）

**已更新文档**:
- ✅ `docs/BasicPrinciples/MustKnowV7.md` - 修正数据库表归属
- ✅ `docs/SupabaseGo/all-services-analysis.md` - 更新服务功能描述
- ✅ `.kiro/specs/subscription-system-enhancement/requirements.md` - 补充架构决策和优化需求

**修正内容**:
- siterank服务表：仅保留评估相关表
- useractivity服务表：明确包含签到、邀请、通知表
- 标注trial_subscriptions表待废弃

### 2. 试用订阅功能迁移（需求已规划）

**迁移步骤**:
1. billing服务新增试用订阅API（POST /api/v1/billing/subscriptions/trial）
2. useractivity服务调用billing服务API创建试用订阅
3. 数据迁移：trial_subscriptions → billing.subscriptions
4. 废弃useractivity服务的试用订阅API
5. 更新前端调用路径

**数据迁移脚本**:
- 需求24已规划：提供迁移脚本
- 转换数据格式（plan=professional, status=trial）
- 生成迁移报告
- 保留备份表（trial_subscriptions_deprecated）

### 3. 邀请追踪集成优化（需求已规划）

**优化方案**:
- useractivity服务保留邀请关系记录（referrals表）
- 通过serviceclient调用billing服务API创建试用订阅
- 解耦服务间数据依赖

**API调用流程**:
```
Frontend → useractivity.TrackReferral
  ↓
useractivity记录邀请关系（referrals表）
  ↓
useractivity调用billing.CreateTrial（被邀请人14天）
  ↓
useractivity调用billing.CreateTrial（邀请人14天）
  ↓
返回成功响应
```

### 4. 签到Token发放事件驱动优化（需求已规划）

**优化方案**:
- useractivity服务签到成功后发布CheckinCompleted事件
- billing服务监听事件异步发放Token
- Pub/Sub保证至少一次投递
- 死信队列处理失败事件

**事件流程**:
```
用户签到 → useractivity记录签到
  ↓
发布CheckinCompleted事件（Pub/Sub）
  ↓
立即返回签到成功响应
  ↓
billing服务监听事件 → 发放Token
  ↓
发布TokenCredited事件
```

**优点**:
- 提升签到响应速度（不等待Token发放）
- 服务解耦（useractivity不依赖billing可用性）
- 自动重试机制（Pub/Sub）
- 可观测性（事件追踪）

---

## 🎯 实施优先级

### P0 - 必须修复（影响数据一致性）

1. **试用订阅功能迁移** - 需求1、4、24
   - 影响：数据孤岛、功能重复
   - 工作量：3-4天
   - 依赖：billing服务API开发

2. **邀请追踪集成优化** - 需求2、5
   - 影响：服务间耦合
   - 工作量：2天
   - 依赖：billing服务API开发

### P1 - 应该优化（提升系统质量）

3. **签到Token发放事件驱动** - 需求26
   - 影响：响应速度、系统解耦
   - 工作量：3天
   - 依赖：Pub/Sub配置、billing服务事件监听

### P2 - 可以延后（文档修正）

4. **文档更新** - 已完成 ✅
   - 影响：开发者理解
   - 工作量：1小时
   - 依赖：无

---

## 📊 影响分析

### 服务变更影响

| 服务 | 变更类型 | 影响范围 | 风险等级 |
|------|---------|---------|---------|
| billing | 新增API | 试用订阅管理 | 低 |
| useractivity | 废弃API | 试用订阅功能 | 中 |
| useractivity | 修改逻辑 | 邀请追踪调用billing | 低 |
| useractivity | 新增事件 | 签到发布事件 | 低 |
| frontend | 修改调用 | 试用订阅API路径 | 低 |

### 数据迁移影响

| 表 | 操作 | 数据量估计 | 风险等级 |
|---|------|-----------|---------|
| trial_subscriptions | 迁移到billing.subscriptions | <10000行 | 中 |
| referrals | 保留不变 | - | 无 |
| checkins | 保留不变 | - | 无 |

---

## ✅ 验收标准

### 功能验收

1. ✅ 用户自注册获得7天Professional试用
2. ✅ 邀请注册双方获得14天Professional试用
3. ✅ 试用到期自动降级为Starter套餐
4. ✅ 签到成功立即返回响应（<100ms）
5. ✅ Token在5秒内发放到账

### 数据一致性验收

1. ✅ 所有试用订阅记录在billing.subscriptions表
2. ✅ 邀请关系记录在useractivity.referrals表
3. ✅ 签到记录在useractivity.checkins表
4. ✅ 无数据孤岛，无重复数据

### 性能验收

1. ✅ 签到响应时间 <100ms（P95）
2. ✅ 试用订阅创建 <500ms（P95）
3. ✅ Token发放延迟 <5s（P95）

---

## 📝 相关文档

- [需求文档](.kiro/specs/subscription-system-enhancement/requirements.md)
- [架构文档](docs/BasicPrinciples/MustKnowV7.md)
- [服务分析](docs/SupabaseGo/all-services-analysis.md)
- [核心业务功能](docs/BasicPrinciples/CoreBusinessFeatures.md)

---

**维护人**: Backend Team
**最后更新**: 2025-10-17
**下次审查**: 实施完成后

