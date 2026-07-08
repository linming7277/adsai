# 业务逻辑必要性评估

**日期**: 2025-10-14
**目的**: 重新评估已重构服务/页面的业务逻辑，删除非核心功能

---

## 评估标准

### 核心功能定义
满足以下任一条件视为**核心功能**：
1. ✅ 用户完成主要任务必须使用
2. ✅ 直接产生业务价值
3. ✅ 无法通过专业工具替代
4. ✅ 法律合规要求

### 非核心功能定义
满足以下任一条件视为**非核心功能**（可删除）：
1. ❌ "Nice to have"但非必须
2. ❌ 应该由专业工具提供（GCP、LaunchDarkly等）
3. ❌ 过度设计或提前优化
4. ❌ 实际使用率极低
5. ❌ 维护成本 > 价值

---

## Offer服务评估

### offers_crud_handlers.go (406行) - ✅ 保留
**功能**:
- createOffer, getOffers, getOfferByID, updateOffer, deleteOffer

**评估**:
- ✅ 核心CRUD操作，用户必须使用
- ✅ 直接产生业务价值
- **决定**: 完全保留

---

### offers_kpi_handlers.go (603行) - ⚠️ 部分删除

#### 保留的功能
```
✅ getOfferKPI - 用户查看Offer表现的核心功能
```

#### 删除的功能
```
❌ aggregateOfferKPI - 手动触发聚合，应该由定时任务自动处理
❌ aggregateOfferKPIExec - 复杂的聚合逻辑，应该在数据仓库层处理
❌ aggregateDailyInternal - 内部批量聚合API，应该用Cloud Scheduler + Pub/Sub
❌ listKpiDLQInternal - 死信队列管理，应该用GCP Pub/Sub DLQ
❌ retryKpiDLQInternal - 死信重试，应该用GCP工具
❌ writeKpiDLQ - 死信写入，过度设计
```

**理由**:
- KPI聚合应该是后台自动任务，不应该暴露手动API
- 死信队列系统过度设计，GCP Pub/Sub原生支持DLQ
- 维护复杂的聚合逻辑成本高，应该用专业的数据处理工具

**删除后**: getOfferKPI保留，其他删除 → 约150行

---

### offers_evaluation_handlers.go (227行) - ✅ 保留
**功能**:
- handleEvaluateOffer - 触发Offer评估
- handleGetEvaluations - 查看评估历史

**评估**:
- ✅ 评估是核心功能
- ✅ 历史记录帮助用户决策
- **决定**: 完全保留

---

### offers_status_handlers.go (217行) - ⚠️ 部分删除

#### 保留的功能
```
✅ updateOfferStatus - 用户手动更新状态的核心功能
```

#### 删除的功能
```
❌ suggestOfferStatus - 状态建议，过度设计，应该前端根据规则直接显示
❌ AutoStatusHandler - 自动状态更新，应该由后台任务处理，不需要HTTP API
❌ computeDeterministicKPI - 测试数据生成器，不应该在生产代码中
```

**理由**:
- 状态建议逻辑简单，前端可以直接实现
- 自动状态更新应该是定时任务，不需要暴露HTTP端点
- 测试代码不应该在生产handler中

**删除后**: 约50行

---

### offers_preferences_handlers.go (135行) - ✅ 保留
**功能**:
- getOfferPreferences, updateOfferPreferences

**评估**:
- ✅ 用户个性化设置，核心功能
- **决定**: 完全保留

---

### offers_accounts_handlers.go (84行) - ✅ 保留
**功能**:
- getOfferAccounts, addOfferAccount, deleteOfferAccount

**评估**:
- ✅ Offer与广告账户关联是核心功能
- **决定**: 完全保留

---

### dashboard_handlers.go (111行) - ❌ 删除整个文件

**功能**:
- dashboardOverviewHandler - Dashboard统计聚合

**评估**:
- ❌ Dashboard应该由前端直接调用各服务API
- ❌ 聚合逻辑应该在前端或BFF层，不应该在业务服务中
- ❌ 违反单一职责原则

**理由**:
- Offer服务应该只负责Offer相关操作
- Dashboard统计应该由专门的Dashboard服务或前端聚合
- 减少服务间耦合

**删除后**: -111行

---

### offers_filtering_handlers.go (122行) - ⚠️ 评估后决定

**功能**:
- listModernOffersFiltered - 高级过滤、排序、分页

**评估**:
- 🤔 如果前端已经在getOffers中实现了过滤，这个可能重复
- 🤔 需要检查是否真的在使用

**决定**: 暂时保留，需要确认使用情况

---

### Offer服务总结

| 文件 | 原始行数 | 删除后 | 状态 |
|------|----------|--------|------|
| offers_crud_handlers.go | 406 | 406 | ✅ 保留 |
| offers_kpi_handlers.go | 603 | 150 | ⚠️ 大幅精简 |
| offers_evaluation_handlers.go | 227 | 227 | ✅ 保留 |
| offers_status_handlers.go | 217 | 50 | ⚠️ 大幅精简 |
| offers_preferences_handlers.go | 135 | 135 | ✅ 保留 |
| offers_accounts_handlers.go | 84 | 84 | ✅ 保留 |
| dashboard_handlers.go | 111 | 0 | ❌ 删除 |
| offers_filtering_handlers.go | 122 | 122 | 🤔 待确认 |
| **总计** | **1,905** | **~1,174** | **-38%** |

---

## Frontend页面评估

### 1. Security Settings Page

#### 保留的功能
```
✅ 密码修改 - 核心安全功能（如果Supabase不提供UI）
✅ 2FA设置 - 核心安全功能（如果Supabase不提供UI）
```

#### 删除的功能
```
❌ 审计日志查询 (AuditLogSection) - 应该用GCP Audit Logs
❌ 登录历史 (LoginHistorySection) - 应该用Supabase Auth日志
❌ 设备会话管理 (DeviceSessionsSection) - 应该用Supabase Auth
❌ useAuditLogs hook - 配套删除
❌ useLoginHistory hook - 配套删除
❌ useSessionManagement hook - 配套删除
```

**理由**:
- 审计和安全监控应该用专业工具（GCP Audit Logs, Supabase Auth Dashboard）
- 不应该在应用层重复构建这些功能
- 维护成本高，安全风险大

**删除后**: 页面可能只需要100行左右，甚至可以考虑完全依赖Supabase UI

---

### 2. UserInfo Page

#### 保留的功能
```
✅ ProfileTab - 用户基本信息编辑
✅ SubscriptionTab - 订阅信息查看（如果是付费功能）
✅ TokensTab - Token余额和使用情况
```

#### 删除的功能
```
❌ CheckinTab - 签到功能，非核心
❌ ReferralTab - 推荐系统，应该独立页面或删除
❌ useUserInfoActions hook中的签到、推荐相关逻辑
```

**理由**:
- 签到系统是"Nice to have"，不是核心功能
- 推荐系统如果重要，应该有独立页面；如果不重要，应该删除
- 减少用户信息页面的复杂度

**决定**: 需要确认签到和推荐功能的实际使用率

---

### 3. Notifications Management Page

#### 保留的功能
```
✅ 通知模板管理（如果真的需要）
✅ 发送通知功能
```

#### 删除的功能
```
❌ NotificationStats - 统计数据，应该在独立的Analytics页面
❌ NotificationBroadcastList - 历史记录，非核心功能
❌ useNotifications hook中的统计查询
```

**理由**:
- 通知统计应该在独立的Analytics/Monitoring页面
- 历史记录查询成本高，价值低
- 简化通知管理页面，专注于"发送通知"核心功能

**但是需要质疑**: 是否真的需要通知管理系统？
- 如果只是偶尔发送通知，可以用第三方服务（SendGrid, Postmark等）
- 如果频繁使用，才需要自建系统

---

## 执行计划

### Phase 1: Offer服务精简 (今天完成)

1. ✅ 删除 `dashboard_handlers.go` 整个文件
2. ✅ 精简 `offers_kpi_handlers.go`:
   - 保留: getOfferKPI
   - 删除: 其他所有handler和辅助函数
3. ✅ 精简 `offers_status_handlers.go`:
   - 保留: updateOfferStatus
   - 删除: suggestOfferStatus, AutoStatusHandler, computeDeterministicKPI
4. ✅ 更新 `http.go` 的路由注册，删除已删除handler的路由
5. ✅ 编译验证

### Phase 2: Frontend精简 (明天完成)

1. ✅ 确认功能使用率（查看Analytics数据）
2. ✅ Security page: 删除审计、登录历史、会话管理
3. ✅ UserInfo page: 评估签到和推荐功能使用率后决定
4. ✅ Notifications page: 评估是否需要自建通知系统
5. ✅ 编译验证

### Phase 3: 文档更新

1. ✅ 更新API文档，标记已删除端点
2. ✅ 创建功能精简报告
3. ✅ 更新前端路由（如果有页面被删除）

---

## 风险评估

### 高风险操作
- ❌ 删除KPI聚合API - 如果有定时任务在调用，会导致任务失败
- ❌ 删除Dashboard API - 如果前端在使用，会导致页面报错

### 缓解措施
1. 先检查每个API的调用情况（查看日志/监控）
2. 标记为Deprecated，而不是立即删除
3. 给前端团队1周时间适配
4. 准备回滚方案

---

## 预期收益

### 代码行数减少
- Offer服务: 1,905行 → ~1,174行 (-38%)
- Frontend: 待评估

### 维护成本降低
- 不需要维护复杂的KPI聚合逻辑
- 不需要维护死信队列系统
- 不需要维护审计日志系统

### 系统简化
- 减少服务职责
- 降低系统复杂度
- 提升可理解性

---

**报告编制**: Claude Code
**报告日期**: 2025-10-14
**状态**: 待执行
