# Console 服务简化计划

**日期**: 2025-10-14
**目标**: 删除非核心功能，将代码从3,965行减少到~800行

---

## 📋 删除清单

### 1. 监控相关 (3个API)

#### 删除理由
GCP Cloud Monitoring已提供完善的监控能力，无需自建。

#### 待删除API
- `GET /api/v1/console/monitoring` - 监控概览
- `GET /api/v1/console/monitoring/stream` - 实时监控流
- `GET /api/v1/console/health/services` - 服务健康状态

#### 影响分析
- Frontend影响: 检查 `/manage/monitoring` 页面
- 替代方案: 使用GCP Console查看监控数据
- 风险: 低（可用GCP原生工具）

---

### 2. 审计增强功能 (5个API，保留3个基础审计)

#### 删除理由
过度设计，基础审计日志足够。

#### 待删除API
- `GET /api/v1/console/audit/stats` - 审计统计
- `GET /api/v1/console/audit/users/{userId}/actions` - 用户行为追踪
- `GET /api/v1/console/audit-logs/critical` - 关键日志
- `GET /api/v1/console/audit-logs/enhanced` - 增强审计
- `POST /api/v1/console/audit/impersonation` - 模拟登录审计

#### 保留API
- `GET /api/v1/console/audit` - 基础审计日志列表
- `GET /api/v1/console/audit/{logId}` - 审计日志详情
- `POST /api/v1/console/audit` - 创建审计日志

#### 影响分析
- Frontend影响: 检查 `/manage/audit` 页面
- 替代方案: 简化为基础日志查看
- 风险: 中（需调整前端页面）

---

### 3. 营销数据聚合 (3个API)

#### 删除理由
前端应直接从i18n文件读取营销内容，无需后端聚合。

#### 待删除API
- `GET /public/marketing/summary` - 营销内容摘要
- `POST /api/v1/console/cache/marketing/invalidate` - 营销缓存失效
- *(相关handler: GetMarketingSummary, InvalidateMarketingCache)*

#### 影响分析
- Frontend影响: 检查首页/定价页是否使用
- 替代方案: 前端直接使用 `public/locales/*/marketing.json`
- 风险: 低（前端已有i18n）

---

### 4. 导航配置 (1个API)

#### 删除理由
前端应自行管理导航结构，无需后端配置。

#### 待删除API
- `GET /api/v1/console/navigation` - 导航配置

#### 影响分析
- Frontend影响: 检查 `core/ui/Navigation` 组件
- 替代方案: 前端硬编码导航配置
- 风险: 低（导航很少变动）

---

### 5. 本地化配置 (1个API)

#### 删除理由
前端i18n通过 `public/locales/` 管理，无需后端配置。

#### 待删除API
- `GET /public/localization/config` - 本地化配置

#### 影响分析
- Frontend影响: 检查i18n初始化代码
- 替代方案: 前端直接管理语言切换
- 风险: 低（已有完整i18n）

---

### 6. Web Vitals监控 (1个API)

#### 删除理由
应使用Google Analytics或Sentry监控性能。

#### 待删除API
- `POST /public/monitoring/web-vitals` - 记录Web性能指标

#### 影响分析
- Frontend影响: 检查性能监控代码
- 替代方案: 集成GA4或Sentry
- 风险: 低（可用第三方工具）

---

### 7. NPS反馈 (1个API)

#### 删除理由
应使用专业NPS工具（如Delighted, SurveyMonkey）。

#### 待删除API
- `POST /api/v1/console/feedback/nps` - 记录NPS反馈

#### 影响分析
- Frontend影响: 检查NPS弹窗组件
- 替代方案: 集成专业NPS工具
- 风险: 低（可用第三方工具）

---

### 8. 成功指标 (1个API)

#### 删除理由
应使用BI工具（如Looker, Metabase）分析业务指标。

#### 待删除API
- `GET /api/v1/console/metrics/success` - 成功指标聚合

#### 影响分析
- Frontend影响: 检查 `/manage/metrics` 页面
- 替代方案: 使用BI工具
- 风险: 中（需调整管理后台）

---

### 9. Insights实时流 (2个API)

#### 删除理由
实时推送应使用Pub/Sub，避免复杂的SSE实现。

#### 待删除API
- `GET /api/v1/console/insights` - Insights聚合
- `GET /api/v1/console/insights/stream` - Insights实时流

#### 影响分析
- Frontend影响: 检查Dashboard实时更新
- 替代方案: 使用轮询或Pub/Sub
- 风险: 中（需调整实时更新逻辑）

---

### 10. 组织分析 (2个API)

#### 删除理由
项目已移除组织模式，改为用户直连。

#### 待删除API
- `GET /api/v1/console/organizations/{id}/analytics` - 组织分析
- `GET /api/v1/console/organizations/rankings` - 组织排名

#### 影响分析
- Frontend影响: 无（已移除组织功能）
- 替代方案: N/A
- 风险: 无

---

### 11. Dashboard聚合 (7个API)

#### 删除理由
前端应直接调用各业务服务API，console不应做数据聚合。

#### 待删除API
- `GET /api/v1/console/dashboard/{userId}` - 用户Dashboard
- `GET /api/v1/console/dashboard/stats` - Dashboard统计
- `GET /api/v1/console/dashboard/metrics` - Dashboard指标
- `GET /api/v1/console/dashboard/trends` - Dashboard趋势
- `GET /api/v1/console/dashboard/activity` - 活动流
- `GET /api/v1/console/dashboard/today-activity` - 今日活动
- `GET /api/v1/console/dashboard/alerts` - 告警列表

#### 影响分析
- Frontend影响: 检查 `/dashboard/page.tsx`
- 替代方案: 前端直接调用 `offer`, `billing`, `tasks` 服务
- 风险: 高（需大幅调整Dashboard页面）

---

### 12. 财务统计 (3个API)

#### 删除理由
应由 `billing` 服务提供财务数据。

#### 待删除API
- `GET /api/v1/console/financial/overview` - 财务概览
- `GET /api/v1/console/financial/monthly` - 月度财务
- `GET /api/v1/console/financial/trends` - 财务趋势

#### 影响分析
- Frontend影响: 检查 `/manage/financial` 页面
- 替代方案: 前端直接调用 `billing` 服务
- 风险: 中（需调整财务页面）

---

### 13. Offers统计 (6个API)

#### 删除理由
应由 `offer` 服务提供Offer统计。

#### 待删除API
- `GET /api/v1/console/offers` - Offers列表（管理后台）
- `GET /api/v1/console/offers/stats` - Offers统计
- `GET /api/v1/console/offers/quality-metrics` - 质量指标
- `GET /api/v1/console/offers/failure-reasons` - 失败原因
- `GET /api/v1/console/offers/problem-offers` - 问题Offers
- `POST /api/v1/console/offers/batch-archive` - 批量归档

#### 影响分析
- Frontend影响: 检查 `/manage/offers` 页面
- 替代方案: 前端直接调用 `offer` 服务API
- 风险: 中（需调整管理页面）

---

### 14. 报表生成 (2个API)

#### 删除理由
应创建独立的 `reports` 服务或使用BI工具。

#### 待删除API
- `GET /api/v1/console/reports/offer-metrics` - Offer指标报表
- `GET /api/v1/console/reports/token-usage` - Token使用报表

#### 影响分析
- Frontend影响: 检查 `/manage/reports` 页面
- 替代方案: 使用BI工具或独立报表服务
- 风险: 中（需调整报表页面）

---

### 15. 导出中心 (3个API)

#### 删除理由
应创建独立的 `exports` 服务或使用云存储。

#### 待删除API
- `POST /api/v1/console/exports/record` - 记录导出请求
- `GET /api/v1/console/exports/history` - 导出历史
- `GET /api/v1/console/exports/stats` - 导出统计

#### 影响分析
- Frontend影响: 检查 `/manage/exports` 页面
- 替代方案: 独立导出服务或直接下载CSV
- 风险: 中（需调整导出页面）

---

### 16. 通知广播 (5个API)

#### 删除理由
已有独立的 `notifications` 服务，功能重复。

#### 待删除API
- `GET /api/v1/console/notifications/broadcasts` - 广播列表
- `POST /api/v1/console/notifications/broadcasts/send` - 发送广播
- `GET /api/v1/console/notifications/broadcasts/stats` - 广播统计
- `GET /api/v1/console/notifications/templates` - 通知模板
- `POST /api/v1/console/notifications/templates/create` - 创建模板
- `POST /api/v1/console/notifications/templates/preview` - 预览模板

#### 影响分析
- Frontend影响: 检查 `/manage/notifications` 页面
- 替代方案: 前端直接调用 `notifications` 服务
- 风险: 中（需调整通知管理页面）

---

### 17. 功能开关 (2个API)

#### 删除理由
应使用专业工具（如LaunchDarkly, Unleash）。

#### 待删除API
- `GET /api/v1/console/feature-flags` - 功能开关列表
- `PUT /api/v1/console/feature-flags/` - 更新功能开关

#### 影响分析
- Frontend影响: 检查 `/manage/feature-flags` 页面
- 替代方案: 集成LaunchDarkly或环境变量
- 风险: 高（需重新设计功能开关机制）

---

### 18. 批量操作 (3个API)

#### 删除理由
各业务服务应提供自己的批量操作API。

#### 待删除API
- `POST /api/v1/console/bulk/offers/archive` - 批量归档Offers
- `POST /api/v1/console/bulk/offers/status` - 批量更新Offer状态
- `POST /api/v1/console/bulk/tokens/topup` - 批量充值Tokens

#### 影响分析
- Frontend影响: 检查批量操作相关功能
- 替代方案: 调用各服务的批量API
- 风险: 低（功能可迁移）

---

## ✅ 保留的核心API (32个)

### 用户管理 (2个)
- `GET /api/v1/console/users` - 用户列表
- `GET|PUT|DELETE /api/v1/console/users/{id}` - 用户CRUD

### Token管理 (7个)
- `GET /api/v1/console/tokens/stats` - Token统计
- `GET /api/v1/console/tokens/balances` - Token余额
- `POST /api/v1/console/tokens/topup` - 充值Token
- `GET|POST /api/v1/console/tokens/rules` - Token规则
- `GET|PUT|DELETE /api/v1/console/tokens/rules/{id}` - 规则CRUD
- `GET /api/v1/console/tokens/trends` - 消耗趋势
- `GET /api/v1/console/tokens/top-consumers` - Top消费者

### 任务管理 (4个)
- `GET /api/v1/console/tasks/stats` - 任务统计
- `GET /api/v1/console/tasks` - 任务列表
- `POST /api/v1/console/tasks/{id}/cancel` - 取消任务
- `POST /api/v1/console/tasks/{id}/retry` - 重试任务

### 订阅管理 (3个)
- `GET /api/v1/console/subscriptions` - 订阅列表
- `GET|PUT /api/v1/console/subscriptions/{id}` - 订阅CRUD
- `GET /api/v1/console/subscriptions/stats` - 订阅统计

### 广告账户 (2个)
- `GET /api/v1/console/ads-accounts/stats` - 广告账户统计
- `GET /api/v1/console/ads-accounts` - 广告账户列表

### API密钥 (3个)
- `GET|POST /api/v1/console/apikeys` - 密钥列表/创建
- `GET|DELETE /api/v1/console/apikeys/{id}` - 密钥详情/删除
- `POST /api/v1/console/apikeys/validate` - 验证密钥（内部调用）

### 配置管理 (3个)
- `GET /api/v1/console/config` - 配置列表
- `GET /api/v1/console/config/history` - 配置历史
- `GET|PUT /api/v1/console/config/{key}` - 配置CRUD

### 恢复码 (4个)
- `POST /api/v1/console/recovery-codes/generate` - 生成恢复码
- `GET /api/v1/console/recovery-codes` - 恢复码列表
- `GET /api/v1/console/recovery-codes/stats` - 恢复码统计
- `POST /api/v1/auth/recovery-code` - 验证恢复码（公开）

### 健康检查 (4个)
- `GET /healthz` - Kubernetes健康检查
- `GET /readyz` - Kubernetes就绪检查
- `GET /health` - 简单健康检查
- `GET /api/health` - 聚合健康检查

---

## 📊 简化效果预测

| 指标 | 当前 | 删除后 | 改善 |
|------|------|--------|------|
| API端点 | 90 | 36 | **-60%** |
| Handler方法 | 54 | 22 | **-59%** |
| 代码行数 | 3,965 | ~800 | **-80%** |
| 依赖服务数 | 5+ | 2 | **-60%** |

---

## 🔄 执行步骤

### Phase 1: 前端影响分析
1. 扫描前端代码，查找所有调用待删除API的位置
2. 评估每个调用的替代方案
3. 创建前端调整任务清单

### Phase 2: 删除非核心功能
1. 备份当前代码（创建git分支）
2. 按模块逐步删除handler和路由
3. 删除对应的测试文件
4. 更新文档

### Phase 3: 重构保留代码
1. 将22个核心handler拆分到独立文件
2. 按业务领域创建子目录
3. 更新路由注册逻辑

### Phase 4: 测试验证
1. 运行单元测试
2. 本地集成测试
3. 预发环境验证

---

## 🚨 风险评估

### 高风险项
1. **Dashboard聚合删除** - 需大幅调整前端Dashboard
2. **功能开关删除** - 需重新设计功能开关机制

### 中风险项
1. 审计增强功能
2. 财务统计
3. Offers统计
4. 报表生成
5. 导出中心
6. 通知广播

### 低风险项
1. 监控（用GCP）
2. 营销聚合（用i18n）
3. 导航配置（前端硬编码）
4. 本地化配置（前端管理）
5. Web Vitals（用GA/Sentry）
6. NPS反馈（用第三方工具）

---

## 📝 下一步行动

1. **用户确认删除清单** - 审核本文档，标记不可删除的功能
2. **前端代码扫描** - 检查前端依赖
3. **执行删除** - 按风险等级逐步删除
4. **重构保留代码** - 拆分handler到独立文件

---

**文档状态**: 待审核
**预计工作量**: 2-3天
**预计代码减少**: 3,165行 (-80%)
