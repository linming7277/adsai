# AutoAds 完整优化路线图

**版本**: V1.0
**日期**: 2025-10-17
**状态**: 规划阶段

---

## 一、优化目标概览

基于对项目现状的全面Review和需求文档分析，AutoAds需要进行以下核心优化：

### 1.1 核心优化方向

1. **套餐配置管理系统** - 实现灵活的配置管理，支持热更新
2. **权限管理体系** - 统一的权限检查机制
3. **Token计费系统** - 灵活的Token消耗规则
4. **前端配置动态化** - 前端配置从硬编码改为API驱动
5. **国际化支持** - 完善的中英文支持

### 1.2 预期收益

- **业务灵活性**: 配置更新无需重启服务，快速响应业务需求
- **开发效率**: 减少重复代码，统一权限和计费逻辑
- **用户体验**: 实时配置同步，多语言支持
- **可维护性**: 配置集中管理，变更历史可追溯

---

## 二、优化任务清单

### 任务组 A: 套餐配置管理系统（核心）

**优先级**: P0
**工作量**: 7周
**负责团队**: Backend + Frontend + QA

#### A1. 数据库设计和迁移
- [ ] 设计4张新表（permissions, token_costs, pricing, config_history）
- [ ] 编写迁移脚本（支持幂等性）
- [ ] 初始数据导入（从现有配置迁移）
- [ ] Preview和Production环境部署

#### A2. Billing服务API开发
- [ ] 配置查询API（GET /api/v1/subscription/config/*）
- [ ] 权限检查API（POST /api/v1/subscription/check-permission）
- [ ] Token消耗计算API（POST /api/v1/subscription/get-token-cost）
- [ ] 单元测试和集成测试

#### A3. 配置热更新机制
- [ ] Redis缓存层实现（TTL 5分钟）
- [ ] Pub/Sub通知机制（配置更新事件）
- [ ] SSE推送机制（前端实时通知）
- [ ] 缓存失效策略

#### A4. Console管理界面
- [ ] 权限配置页面（/manage/subscription/permissions）
- [ ] Token消耗规则页面（/manage/subscription/token-costs）
- [ ] 套餐价格配置页面（/manage/subscription/pricing）
- [ ] 配置变更历史页面（/manage/subscription/history）

#### A5. 前端配置动态化
- [ ] useSubscriptionConfig hook（SWR + SSE）
- [ ] usePermission hook（权限检查）
- [ ] 套餐展示页面重构（动态渲染）
- [ ] 多语言支持（中文¥/英文$）

#### A6. 微服务集成
- [ ] siterank服务集成（评估权限、Token计算）
- [ ] adscenter服务集成（账号数量限制）
- [ ] batchopen服务集成（代理IP国家限制）
- [ ] 其他服务按需集成

#### A7. 测试和上线
- [ ] 单元测试（覆盖率 > 80%）
- [ ] 集成测试（端到端流程）
- [ ] 性能测试（API响应时间 < 100ms）
- [ ] Preview环境验证
- [ ] Production环境灰度上线

**详细计划**: 见 `docs/SupabaseGo/subscription-system-implementation-plan.md`

---

### 任务组 B: 权限管理体系优化（支撑）

**优先级**: P0
**工作量**: 2周
**负责团队**: Backend

#### B1. 统一权限检查包
- [ ] 创建pkg/permissions包
- [ ] 实现权限检查逻辑（布尔、数字、字符串）
- [ ] 实现权限缓存（Redis + 内存）
- [ ] 单元测试

#### B2. 权限中间件
- [ ] HTTP中间件（权限拦截）
- [ ] gRPC拦截器（权限验证）
- [ ] 错误处理和日志

#### B3. 微服务集成
- [ ] siterank服务集成
- [ ] adscenter服务集成
- [ ] offer服务集成
- [ ] 其他服务按需集成

**依赖**: 任务组A完成后开始

---

### 任务组 C: Token计费系统优化（支撑）

**优先级**: P0
**工作量**: 1.5周
**负责团队**: Backend

#### C1. Token消耗规则优化
- [ ] 优化token_consumption_rules表结构
- [ ] 支持套餐级别差异化计费
- [ ] 支持"unsupported"标识
- [ ] 数据迁移

#### C2. Token预留机制优化
- [ ] 优化CheckAndReserveTokens逻辑
- [ ] 支持套餐级别Token计算
- [ ] 优化ConfirmTokenDeduction逻辑
- [ ] 优化RefundTokens逻辑

#### C3. Token余额缓存优化
- [ ] 优化GetBalance缓存策略
- [ ] 优化GetBalanceSummary缓存策略
- [ ] 缓存失效优化

**依赖**: 任务组A完成后开始

---

### 任务组 D: 前端配置动态化（支撑）

**优先级**: P1
**工作量**: 1周
**负责团队**: Frontend

#### D1. 配置管理Hooks
- [ ] useSubscriptionConfig hook
- [ ] usePermission hook
- [ ] useTokenCost hook
- [ ] 单元测试

#### D2. 套餐页面重构
- [ ] /settings/subscription页面重构
- [ ] 动态渲染套餐卡片
- [ ] 功能列表动态渲染
- [ ] Token消耗显示

#### D3. 权限控制组件
- [ ] PermissionGate组件（权限门控）
- [ ] TokenCostBadge组件（Token消耗显示）
- [ ] UpgradePrompt组件（升级提示）

**依赖**: 任务组A完成后开始

---

### 任务组 E: 国际化支持完善（增强）

**优先级**: P1
**工作量**: 1周
**负责团队**: Frontend

#### E1. 翻译文件完善
- [ ] 补充subscription.json翻译
- [ ] 补充common.json翻译
- [ ] 翻译文件验证

#### E2. 货币符号切换
- [ ] 实现货币符号根据语言切换（中文¥/英文$）
- [ ] 价格显示格式化
- [ ] 单位显示（/月 vs /mo）

#### E3. i18n key支持
- [ ] 配置中使用i18n key
- [ ] 前端自动翻译
- [ ] fallback机制

**依赖**: 任务组A和D完成后开始

---

### 任务组 F: 监控和告警（增强）

**优先级**: P2
**工作量**: 1周
**负责团队**: DevOps + Backend

#### F1. 配置监控
- [ ] 配置API响应时间监控
- [ ] 配置缓存命中率监控
- [ ] 配置更新延迟监控

#### F2. 权限监控
- [ ] 权限检查失败率监控
- [ ] 权限检查响应时间监控

#### F3. Token监控
- [ ] Token消耗异常监控
- [ ] Token余额告警
- [ ] Token预留失败监控

#### F4. 告警规则
- [ ] 配置API响应时间 > 500ms告警
- [ ] 缓存命中率 < 95%告警
- [ ] 权限检查失败率 > 5%告警
- [ ] Token消耗异常告警

**依赖**: 任务组A、B、C完成后开始

---

### 任务组 G: 文档和培训（支撑）

**优先级**: P1
**工作量**: 1周
**负责团队**: Product + Engineering

#### G1. 技术文档
- [ ] 数据库表结构文档
- [ ] API文档（OpenAPI规范）
- [ ] 架构设计文档
- [ ] 部署文档

#### G2. 使用文档
- [ ] 管理员操作手册
- [ ] 开发者集成指南
- [ ] 故障排查指南

#### G3. 培训
- [ ] 管理员培训（配置管理）
- [ ] 开发者培训（API集成）
- [ ] QA培训（测试方法）

**依赖**: 任务组A完成后开始

---

## 三、实施时间线

### 3.1 总体时间线（10周）

```
Week 1-7:  任务组A（套餐配置管理系统）
Week 8-9:  任务组B（权限管理体系）+ 任务组C（Token计费系统）
Week 9-10: 任务组D（前端配置动态化）+ 任务组E（国际化支持）
Week 10:   任务组F（监控和告警）+ 任务组G（文档和培训）
```

### 3.2 详细时间线

| 周次 | 任务组 | 主要工作 | 交付物 |
|------|--------|----------|--------|
| Week 1 | A1 | 数据库设计和迁移 | 4张新表 + 迁移脚本 |
| Week 2-3 | A2 | Billing服务API开发 | 配置查询、权限检查、Token计算API |
| Week 3-4 | A3 | 配置热更新机制 | Redis缓存 + Pub/Sub + SSE |
| Week 4-5 | A4 | Console管理界面 | 4个配置管理页面 |
| Week 5-6 | A5 | 前端配置动态化 | Hooks + 套餐页面重构 |
| Week 6-7 | A6 + A7 | 微服务集成 + 测试上线 | 集成完成 + 上线 |
| Week 8-9 | B + C | 权限管理 + Token计费优化 | 统一权限包 + Token优化 |
| Week 9-10 | D + E | 前端优化 + 国际化 | 配置动态化 + i18n完善 |
| Week 10 | F + G | 监控 + 文档 | 监控告警 + 文档培训 |

---

## 四、资源需求

### 4.1 人力资源

| 角色 | 人数 | 投入时间 | 主要任务 |
|------|------|----------|----------|
| Backend Engineer | 2人 | 10周 | 任务组A、B、C |
| Frontend Engineer | 1人 | 6周 | 任务组A、D、E |
| QA Engineer | 1人 | 3周 | 任务组A、F |
| DevOps Engineer | 1人 | 2周 | 任务组A、F |
| Product Manager | 1人 | 2周 | 任务组A、G |

### 4.2 基础设施

- **数据库**: PostgreSQL（现有）
- **缓存**: Redis（现有）
- **消息队列**: Google Cloud Pub/Sub（现有）
- **监控**: Cloud Monitoring（现有）
- **日志**: Cloud Logging（现有）

---

## 五、风险管理

### 5.1 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 数据迁移失败 | 高 | 低 | 充分测试 + 回滚预案 |
| 缓存失效不及时 | 中 | 中 | Pub/Sub + SSE双重保障 |
| 性能下降 | 高 | 低 | 三层缓存 + 性能测试 |
| 向后兼容问题 | 高 | 中 | 保留fallback + 灰度发布 |

### 5.2 进度风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 人力资源不足 | 高 | 中 | 提前规划 + 外部支持 |
| 需求变更 | 中 | 中 | 敏捷开发 + 快速迭代 |
| 技术难题 | 中 | 低 | 技术预研 + 专家支持 |

### 5.3 业务风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 用户体验下降 | 高 | 低 | 充分测试 + 用户反馈 |
| 业务中断 | 高 | 低 | 灰度发布 + 快速回滚 |
| 数据丢失 | 高 | 极低 | 数据备份 + 事务保护 |

---

## 六、成功指标

### 6.1 功能指标

- [ ] 配置更新无需重启服务
- [ ] 配置更新5秒内生效
- [ ] 前端自动同步最新配置
- [ ] 支持中英文切换
- [ ] 配置变更历史完整记录
- [ ] 统一的权限检查机制
- [ ] 灵活的Token计费规则

### 6.2 性能指标

- [ ] 配置API响应时间 < 100ms
- [ ] 权限检查响应时间 < 50ms
- [ ] Token计算响应时间 < 50ms
- [ ] 缓存命中率 > 95%
- [ ] 配置更新延迟 < 5秒
- [ ] 支持1000并发请求

### 6.3 质量指标

- [ ] 测试覆盖率 > 80%
- [ ] 零生产故障
- [ ] 用户满意度 > 90%
- [ ] 代码审查通过率 100%

---

## 七、后续优化方向

### 7.1 短期优化（1-2个月）

- [ ] 配置A/B测试支持
- [ ] 配置回滚功能
- [ ] 配置审批流程
- [ ] 配置模板功能
- [ ] 权限组管理
- [ ] Token充值优惠

### 7.2 中期优化（3-6个月）

- [ ] 配置可视化编辑器
- [ ] 配置影响分析
- [ ] 配置自动化测试
- [ ] 配置性能优化
- [ ] 权限继承机制
- [ ] Token积分系统

### 7.3 长期优化（6-12个月）

- [ ] 配置智能推荐
- [ ] 配置自动调优
- [ ] 配置多租户支持
- [ ] 配置国际化扩展
- [ ] 权限细粒度控制
- [ ] Token动态定价

---

## 八、相关文档

### 8.1 需求文档

- `docs/BasicPrinciples/CoreBusinessFeatures.md` - 核心业务功能说明
- `docs/productrefactoring-v2/FunctionalSpecs/SubscriptionConfigManagement.md` - 套餐配置管理功能规格
- `docs/BasicPrinciples/SubscriptionMatrix.md` - 套餐权限与Token消耗矩阵

### 8.2 设计文档

- `docs/SupabaseGo/subscription-system-implementation-plan.md` - 套餐配置管理系统实施计划
- `.kiro/specs/subscription-config-management/requirements.md` - 套餐配置管理系统需求文档

### 8.3 技术文档

- `docs/BasicPrinciples/MustKnowV7.md` - 架构设计和技术栈
- `docs/monorepo-build-best-practices.md` - Monorepo构建最佳实践

---

## 九、决策记录

### 9.1 为什么选择数据库配置而不是配置文件？

**决策**: 使用PostgreSQL数据库存储配置

**理由**:
1. 支持复杂的配置结构（JSONB）
2. 支持事务和一致性保证
3. 支持配置变更历史记录
4. 支持实时查询和更新
5. 与现有架构一致

### 9.2 为什么选择Pub/Sub而不是轮询？

**决策**: 使用Google Cloud Pub/Sub进行配置更新通知

**理由**:
1. 实时性更好（秒级延迟）
2. 减少数据库查询压力
3. 支持多服务订阅
4. 与现有架构一致
5. 可靠性高（消息持久化）

### 9.3 为什么选择三层缓存？

**决策**: Redis + 内存缓存 + 前端SWR缓存

**理由**:
1. Redis缓存：跨服务共享，TTL 5分钟
2. 内存缓存：单服务高性能，定时刷新
3. 前端缓存：减少网络请求，SSE触发刷新
4. 三层缓存平衡了性能和实时性

### 9.4 为什么选择SSE而不是WebSocket？

**决策**: 使用Server-Sent Events (SSE)进行前端通知

**理由**:
1. 单向通信足够（服务器推送）
2. 实现简单，浏览器原生支持
3. 自动重连机制
4. HTTP协议，无需额外端口
5. 与现有架构一致

---

## 十、附录

### 10.1 术语表

- **Plan**: 订阅套餐（Starter、Professional、Elite）
- **Permission**: 功能权限配置
- **Token Cost**: Token消耗规则
- **Pricing**: 套餐价格配置
- **Hot Reload**: 配置热更新，无需重启服务
- **Cache**: Redis缓存，用于提升配置读取性能
- **Pub/Sub**: Google Cloud Pub/Sub，用于配置更新通知
- **SSE**: Server-Sent Events，用于前端实时接收配置更新
- **i18n**: 国际化，支持中英文切换

### 10.2 缩写表

- **API**: Application Programming Interface
- **TTL**: Time To Live
- **SSE**: Server-Sent Events
- **SWR**: Stale-While-Revalidate
- **RBAC**: Role-Based Access Control
- **JSONB**: JSON Binary (PostgreSQL数据类型)
- **QA**: Quality Assurance
- **P0/P1/P2**: Priority 0/1/2（优先级）

---

**维护人**: Product & Engineering Team
**最后更新**: 2025-10-17
**下次审查**: Week 1完成后
