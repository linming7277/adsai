# AutoAds 完整实施路线图

**版本**: V1.0 (整合版)
**日期**: 2025-10-17
**状态**: 待实施

---

## 一、任务总览

基于对现有代码的深入Review和需求文档分析，AutoAds需要完成以下任务：

### 任务分类

| 类别 | 任务数 | 优先级 | 工作量 |
|------|--------|--------|--------|
| **P0: 紧急修复** | 3个 | 最高 | 1周 |
| **P1: 核心功能** | 4个 | 高 | 6周 |
| **P2: 功能增强** | 3个 | 中 | 4周 |

**总工期**: 11周

---

## 二、P0任务：紧急修复（Week 1）

### P0-1: 修复用户注册/登录流程 🚨

**问题**: 
- 试用订阅API不存在（`/api/v1/trial/create`）
- 邀请追踪API不存在（`/api/v1/referral/track`）
- Supabase触发器未验证

**影响**: 
- 新用户无法获得试用订阅
- 邀请功能完全失效
- 用户可能无法正常使用系统

**工作量**: 3天

**实施步骤**:

#### Day 1: 实现试用订阅API
**服务**: billing
**文件**: `services/billing/internal/handlers/trial.go`（新建）

```go
// POST /api/v1/trial/create
// 创建Pro套餐试用订阅
// - 自注册：7天 + 500 tokens
// - 邀请注册：14天 + 1000 tokens
```

**路由注册**:
```go
// services/billing/main.go
r.Post("/api/v1/trial/create", apiHandler.CreateTrial)
```

#### Day 2: 实现邀请追踪API
**服务**: useractivity
**文件**: `services/useractivity/internal/handlers/referral.go`

```go
// POST /api/v1/referral/track
// 追踪邀请关系
// - 为被邀请人创建14天Pro试用
// - 为邀请人发放100 tokens奖励
```

#### Day 3: 验证Supabase触发器
**任务**:
1. 连接Supabase数据库
2. 检查`on_auth_user_created`触发器
3. 如果不存在，创建触发器
4. 测试触发器功能

**触发器功能**:
- 创建`users`表记录
- 创建`UserToken`表记录（初始balance=0）
- 创建`referrals`表记录（生成邀请码）

**验收标准**:
- [ ] 自注册用户获得7天Pro试用 + 500 tokens
- [ ] 邀请注册用户获得14天Pro试用 + 1000 tokens
- [ ] 邀请人获得100 tokens奖励
- [ ] Supabase触发器正常工作
- [ ] 完整流程测试通过

**详细文档**: `docs/SupabaseGo/user-auth-flow-review.md`

---

## 三、P1任务：核心功能（Week 2-7）

### P1-1: 套餐配置管理系统（Week 2-5）

**工作量**: 4周

#### Week 2: Billing服务API集成

**任务**:
1. 集成`subscription_plans.go`到main.go（1天）
   - 初始化SubscriptionPlanHandler
   - 注册路由（使用Chi或适配器）
   - 测试API可访问性

2. 补充Gateway Middleware需要的API（2天）
   - `GET /api/v1/billing/plans/:tier/permissions`
   - `POST /api/v1/billing/check-permission`
   - `POST /api/v1/billing/get-token-cost`

3. 配置变更历史API（1天）
   - `GET /api/v1/billing/plans/history`

4. 单元测试（1天）

**验收标准**:
- [ ] 所有API端点可访问
- [ ] Gateway Middleware可以成功调用
- [ ] Redis缓存正常工作
- [ ] Pub/Sub通知正常工作

#### Week 3-4: Gateway Middleware部署

**任务**:
1. 完成Phase 4功能（3天）
   - 配置热更新（Pub/Sub订阅）
   - 限流中间件
   - 完整测试

2. Preview环境部署（2天）
   - 部署gateway-middleware-preview
   - 配置GCP API Gateway
   - 功能验证

3. Production环境部署（2天）
   - 灰度发布
   - 监控和告警
   - 性能验证

**验收标准**:
- [ ] Gateway Middleware部署成功
- [ ] 权限检查正常工作
- [ ] Token预留正常工作
- [ ] API响应时间 < 10ms (P95)
- [ ] billing服务负载降低60%

#### Week 5: 前端配置动态化

**任务**:
1. 实现配置查询Hook（2天）
   - `useSubscriptionConfig`
   - `usePermission`
   - `useTokenCost`

2. 重构套餐展示页面（2天）
   - 从API获取套餐配置
   - 动态渲染功能列表
   - 多语言支持（中文¥/英文$）

3. 测试（1天）

**验收标准**:
- [ ] 前端从API获取套餐配置
- [ ] 配置更新自动同步
- [ ] 中英文切换正常
- [ ] 货币符号正确显示

**详细文档**: `docs/SupabaseGo/subscription-config-final-plan.md`

---

### P1-2: 每日落地页巡检（Week 6）

**工作量**: 1周

**实施内容**:
1. 数据库表设计（0.5天）
   - `landing_page_monitors`表
   - `landing_page_check_history`表

2. Worker实现（2天）
   - 每日自动检查
   - 并发检查（限制10个）
   - 记录检查历史

3. Cloud Scheduler配置（0.5天）
   - 每天凌晨2点执行

4. 用户通知（1天）
   - 连续3次失败发送告警
   - 通过useractivity服务

5. 前端页面（1天）
   - 监控配置页面
   - 检查历史查看

**验收标准**:
- [ ] 每日自动检查所有启用的monitors
- [ ] 连续3次失败发送通知
- [ ] 用户可以查看检查历史
- [ ] 用户可以启用/禁用监控

**详细文档**: `docs/SupabaseGo/business-features-enhancement-plan.md`

---

### P1-3: Batchopen代理配置和轮换（Week 7）

**工作量**: 1周

**实施内容**:
1. 集成proxy-pool服务（2天）
   - ProxyPoolClient实现
   - 代理获取和释放

2. 任务配置扩展（1天）
   - ProxyConfig结构
   - 支持国家选择
   - 支持轮换策略

3. 执行逻辑优化（2天）
   - browser-exec集成代理
   - 代理失败重试
   - 代理使用统计

**验收标准**:
- [ ] 支持指定国家代理
- [ ] 支持每个URL轮换代理
- [ ] 代理失败自动重试
- [ ] 任务成功率提升20%

**详细文档**: `docs/SupabaseGo/business-features-enhancement-plan.md`

---

### P1-4: Console管理界面（Week 8）

**工作量**: 1周

**实施内容**:
1. 套餐配置管理页面（3天）
   - `/manage/subscription/plans`
   - 权限配置编辑
   - Token消耗规则编辑
   - 价格配置编辑

2. 配置变更历史页面（2天）
   - `/manage/subscription/history`
   - 变更记录列表
   - 筛选和搜索
   - 详情查看和对比

**验收标准**:
- [ ] 管理员可以修改套餐配置
- [ ] 配置变更立即生效
- [ ] 变更历史完整记录
- [ ] 支持筛选和导出

**详细文档**: `docs/SupabaseGo/subscription-config-final-plan.md`

---

## 四、P2任务：功能增强（Week 9-12）

### P2-1: Adscenter批量操作（Week 9-10）

**工作量**: 2周

**实施内容**:
1. 批量操作API设计（3天）
   - 批量CPC调整
   - 批量预算调整
   - 批量URL suffix修改
   - 批量启停操作

2. Dry Run预演模式（2天）
   - 影响评估
   - 成本预测
   - 风险提示

3. 批量操作审计（1天）
   - 操作记录
   - 支持回滚

4. 前端界面（2天）
   - 批量选择
   - 操作配置
   - 预演结果展示

**验收标准**:
- [ ] 支持批量CPC调整
- [ ] 支持批量预算调整
- [ ] Dry Run预演模式
- [ ] 影响评估报告
- [ ] 操作审计日志

**详细文档**: `docs/SupabaseGo/business-features-enhancement-plan.md`

---

### P2-2: 测试覆盖率提升（Week 11）

**工作量**: 1周

**目标**: 测试覆盖率从10%提升到70%

**实施内容**:
1. Offer服务单元测试（2天）
2. Siterank服务单元测试（2天）
3. 集成测试（1天）

**验收标准**:
- [ ] Offer服务覆盖率 > 80%
- [ ] Siterank服务覆盖率 > 80%
- [ ] 集成测试覆盖核心流程

---

### P2-3: 监控和告警完善（Week 12）

**工作量**: 1周

**实施内容**:
1. 注册流程监控（2天）
2. 试用订阅监控（1天）
3. 邀请功能监控（1天）
4. 告警规则配置（1天）

**验收标准**:
- [ ] 注册成功率监控
- [ ] 试用创建率监控
- [ ] 邀请转化率监控
- [ ] 告警规则生效

---

## 五、实施时间线

```
Week 1: P0紧急修复
├─ Day 1: 试用订阅API
├─ Day 2: 邀请追踪API
├─ Day 3: Supabase触发器
└─ Day 4-5: 测试和验证

Week 2-5: P1核心功能 - 套餐配置管理
├─ Week 2: Billing API集成
├─ Week 3-4: Gateway Middleware部署
└─ Week 5: 前端动态化

Week 6: P1核心功能 - 落地页巡检

Week 7: P1核心功能 - 代理配置

Week 8: P1核心功能 - Console管理界面

Week 9-10: P2功能增强 - 批量操作

Week 11: P2功能增强 - 测试覆盖

Week 12: P2功能增强 - 监控告警
```

---

## 六、依赖关系

```
P0-1 (用户注册修复)
    ↓ 必须先完成
P1-1 (套餐配置管理)
    ↓
├─ P1-2 (落地页巡检) ← 可并行
├─ P1-3 (代理配置) ← 可并行
└─ P1-4 (Console管理)
    ↓
├─ P2-1 (批量操作) ← 可并行
├─ P2-2 (测试覆盖) ← 可并行
└─ P2-3 (监控告警) ← 可并行
```

---

## 七、资源需求

### 7.1 人力资源

| 角色 | Week 1 | Week 2-5 | Week 6-8 | Week 9-12 |
|------|--------|----------|----------|-----------|
| Backend Engineer | 2人 | 2人 | 2人 | 1人 |
| Frontend Engineer | - | 1人 | 1人 | 1人 |
| QA Engineer | 0.5人 | 0.5人 | 0.5人 | 1人 |
| DevOps Engineer | - | 0.5人 | - | 0.5人 |

### 7.2 基础设施

- PostgreSQL（现有）
- Redis（现有）
- Google Cloud Pub/Sub（现有）
- Cloud Scheduler（新增，成本可忽略）

---

## 八、成功指标

### 8.1 P0指标（用户注册）

- [ ] 注册成功率 > 95%
- [ ] 试用创建成功率 > 99%
- [ ] 邀请追踪成功率 > 99%
- [ ] Supabase触发器成功率 > 99%

### 8.2 P1指标（核心功能）

- [ ] 配置更新无需重启服务
- [ ] 配置更新5秒内生效
- [ ] Gateway响应时间 < 10ms (P95)
- [ ] 落地页检查覆盖率 > 80%
- [ ] 代理任务成功率提升20%

### 8.3 P2指标（功能增强）

- [ ] 批量操作效率提升10x
- [ ] 测试覆盖率 > 70%
- [ ] 监控告警覆盖所有关键流程

---

## 九、风险管理

### 高风险项

#### 1. P0修复可能影响现有用户
**缓解**: 
- 充分测试
- 灰度发布
- 保留回滚方案

#### 2. Gateway Middleware部署可能影响所有API
**缓解**:
- Preview环境先行1周
- 完整的回滚方案
- 实时监控

### 中风险项

#### 1. 前端配置切换可能有兼容性问题
**缓解**:
- 保留硬编码作为fallback
- 分步实施
- 充分测试

---

## 十、相关文档

### 需求文档
- `docs/BasicPrinciples/CoreBusinessFeatures.md` - 核心业务功能
- `docs/productrefactoring-v2/FunctionalSpecs/SubscriptionConfigManagement.md` - 套餐配置管理
- `docs/BasicPrinciples/SubscriptionMatrix.md` - 权限和Token矩阵

### 技术文档
- `docs/BasicPrinciples/MustKnowV7.md` - 架构设计
- `docs/ArchitectureOpV1/COMPLETE-OPTIMIZATION-PLAN.md` - 完整优化计划
- `services/gateway-middleware/IMPLEMENTATION_PLAN.md` - Gateway实施计划

### 实施方案
- `docs/SupabaseGo/user-auth-flow-review.md` - 用户注册登录Review
- `docs/SupabaseGo/subscription-config-final-plan.md` - 套餐配置管理
- `docs/SupabaseGo/business-features-enhancement-plan.md` - 业务功能增强

---

## 十一、下一步行动

### 立即开始（本周）

1. **验证Supabase触发器**
   ```bash
   # 连接Supabase数据库
   psql "postgresql://postgres.jzzvizacfyipzdyiqfzb:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
   
   # 检查触发器
   SELECT * FROM pg_trigger WHERE tgname LIKE '%auth%';
   ```

2. **实现试用订阅API**
   - 创建`services/billing/internal/handlers/trial.go`
   - 注册路由
   - 测试

3. **实现邀请追踪API**
   - 创建`services/useractivity/internal/handlers/referral.go`
   - 注册路由
   - 测试

### Week 2开始

- 按照P1-1计划实施套餐配置管理系统

---

**让我们开始实施，确保用户可以顺畅注册和使用AutoAds！** 🚀
