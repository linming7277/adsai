# AutoAds 业务需求实现 - 执行摘要

**文档类型**: 执行摘要
**创建时间**: 2025-10-15
**状态**: ✅ 架构分析完成，设计方案已制定

---

## 📋 项目概述

基于现有AutoAds架构（Next.js 14 + Go微服务），完成5个核心业务模块的详细设计和实现计划。

---

## 🎯 业务需求

### 1. Dashboard仪表盘 (`/dashboard`)
**目标**: 聚合Offer、Ads账号、风险、通知，实现日常运营一览

**核心功能**:
- 8个统计卡片（Offers、Token、任务、广告账号）
- 4个数据图表（饼图、折线图、汇总卡片）
- 风险提醒面板
- 消息通知列表
- 快速操作区

**技术方案**: 并发调用6个微服务API，SWR缓存，懒加载图表

---

### 2. Offer管理 (`/dashboard/offers`)
**目标**: 以Offer为视角，完整的CRUD、状态管理、Ads账号关联

**核心功能**:
- 列表视图（表格、分页、排序）
- 筛选搜索（状态、国家、分类、时间）
- 详情抽屉（基础信息、状态历史、AI评估、KPI、关联账号）
- 批量操作（删除、修改状态、导出、AI评估）
- Offer-Account关联（绑定、解绑、状态显示）
- 创建Offer（表单验证、自动触发评估）

**技术方案**: 基于Offer Service API，集成AdsCenter Service关联API

---

### 3. Ads中心 (`/dashboard/ads-center`)
**目标**: 以Ads账号为视角，OAuth授权、状态管理、数据统计

**核心功能**:
- 账号列表（卡片展示、状态指示、数据预览）
- OAuth授权（Google Ads，弹窗流程、状态轮询）
- 账号管理（详情、同步、断开、删除）
- 账号信息（基础信息、授权状态、关联Offers、预算）
- 数据统计（5个实时卡片、3个趋势图表）
- 批量同步（SSE实时进度）

**技术方案**: 基于AdsCenter Service，OAuth窗口通信，SSE实时更新

---

### 4. 任务中心 (`/dashboard/tasks`)
**目标**: 以任务为视角，展示评估/补点击/换链接等任务，Token消耗透明

**核心功能**:
- 任务列表（类型、状态、Token消耗、时间）
- 状态筛选Tab（全部、进行中、已完成、失败、待处理）
- 详情抽屉（进度、Token明细、关联对象、结果、日志）
- 任务统计（今日/本月任务数、Token消耗）
- 任务操作（取消、重试、查看日志）
- 实时更新（SSE监听状态变更）
- 3种任务类型详解（Evaluation、ClickBoost、LinkRotation）

**技术方案**: 基于Console Service，SSE实时更新，进度条组件

---

### 5. 个人中心 (`/settings/*`)
**目标**: 个人信息、订阅、Token、邀请、签到

**核心功能**:

**个人信息** (`/settings/profile`)
- 显示/编辑（邮箱、用户名、头像）
- 密码管理
- 安全设置（两步验证、登录设备）

**套餐订阅** (`/settings/subscription`)
- 当前套餐（名称、价格、到期、功能对比）
- 套餐列表（Free/Pro/Elite）
- 操作（升级、降级、取消）
- Stripe支付集成

**Token余额** (`/settings/tokens`)
- 统计卡片（余额、今日/本月消耗、待处理）
- 充值入口（4个档位、Stripe支付）
- 使用明细（时间、类型、消耗、余额）
- 交易记录（充值、赠送）

**邀请系统** (`/settings/referral`)
- 邀请链接（复制、二维码）
- 奖励规则（注册+100, 充值返10%）
- 统计（邀请数、注册数、充值数、累计奖励）
- 邀请列表（时间、邮箱、状态、奖励）

**签到系统** (`/settings/checkin`)
- 签到日历（本月情况、连续天数）
- 签到按钮（每日+10 tokens）
- 奖励规则（连续7天+50, 连续30天+200）
- 签到历史

**技术方案**: 基于Billing Service、Console Service，Stripe支付集成

---

## 🏗️ 技术架构

### 现有架构（已验证）
- **前端**: Next.js 14 + React + TailwindCSS + shadcn/ui
- **后端**: 9个Go微服务（offer, adscenter, billing, console, etc.）
- **数据库**: Supabase PostgreSQL (认证) + Cloud SQL (应用数据)
- **API Gateway**: 统一入口、路由、认证
- **认证**: Google OAuth + JWT + RLS

### API端点（已确认可用）
| 微服务 | 端点数 | 状态 |
|--------|--------|------|
| Billing | 14 | ✅ 已实现 |
| Offer | 12 | ✅ 已实现 |
| AdsCenter | 20+ | ✅ 已实现 |
| Console | 15+ | ✅ 已实现 |
| Notifications | 5 | ✅ 已实现 |
| Recommendations | 6 | ✅ 已实现 |

### 数据流设计（已完成）
- Dashboard聚合流程（并发6个API）
- Offer-Account关联流程（跨服务调用）
- AI评估任务流程（异步Pub/Sub）
- OAuth授权流程（窗口通信、状态轮询）

---

## 📅 实施计划

**总工期**: 23天（约5周）
**团队**: Frontend Team (2人) + Backend Team (2人) + QA (1人)

### 阶段1: 架构准备与API增强 (3天)
- Console Service增强（Dashboard聚合API、Task Schema）
- Offer Service增强（统计API、关联API、批量操作）
- AdsCenter Service增强（OAuth优化、SSE数据流）

### 阶段2: Dashboard实现 (3天)
- 核心组件开发（AlertsBanner、PerformanceCharts、NotificationsFeed）
- 数据集成与优化（并发请求、Loading、Error处理）

### 阶段3: Offers页面实现 (4天)
- 列表与筛选（OffersTable、筛选器、批量操作）
- 详情抽屉（OfferDetailDrawer、状态历史、AI评估、KPI）
- Offer-Account关联（绑定/解绑、账号选择器）

### 阶段4: AdsCenter页面实现 (4天)
- OAuth授权流程（OAuthFlowDialog、窗口通信、轮询）
- 账号列表与卡片（AccountCard、状态展示、同步）
- 账号详情页（统计卡片、趋势图表、SSE更新）

### 阶段5: Tasks页面实现 (3天)
- 任务列表与详情（TasksTable、TaskDetailDrawer、进度条）
- 实时更新与操作（SSE监听、取消/重试、日志查看）

### 阶段6: 个人中心实现 (3天)
- Token余额页面（统计、充值、明细、交易记录）
- 邀请与签到（链接、二维码、日历、奖励规则）
- 订阅管理（套餐对比、Stripe支付、升降级）

### 阶段7: 集成测试与优化 (3天)
- E2E测试完善（补全所有页面测试）
- 性能优化（Bundle分析、API优化、缓存策略）
- 文档与上线（用户文档、开发文档、UAT、发布）

---

## 🎨 前端组件设计（已完成）

### Dashboard组件树
- DashboardStatsGrid: 8个统计卡片
- PerformanceCharts: 4个数据图表
- AlertsBanner: 风险提醒
- NotificationsFeed: 通知列表
- QuickActionsCard: 快速操作

### Offers组件树
- OffersTable: 列表表格（可排序、分页）
- OffersHeader: 搜索、筛选、批量操作
- OfferDetailDrawer: 详情抽屉（5个Section）
- CreateOfferDialog: 创建对话框
- AdsAccountBindingSection: 关联账号

### AdsCenter组件树
- AccountsGrid: 账号卡片Grid
- OAuthFlowDialog: OAuth授权对话框
- AccountDetailPage: 账号详情页
- StatsCardsGrid: 统计卡片
- TrendChartsSection: 趋势图表

### Tasks组件树
- TasksTable: 任务表格
- TaskDetailDrawer: 详情抽屉
- ProgressSection: 进度展示
- TokenUsageSection: Token消耗
- RealTimeUpdater: SSE监听

### Settings组件树
- TokenStatsCards: Token统计
- RechargeSection: 充值入口
- ReferralLinkCard: 邀请链接
- CheckinCalendar: 签到日历
- PlansComparisonTable: 套餐对比

---

## 📊 关键指标

### 性能目标
- LCP (最大内容绘制): <2.5s
- API响应时间: <500ms (P95)
- Dashboard加载: <3s (含6个API并发)
- 页面Bundle: <300KB (gzip后)

### 测试覆盖
- 单元测试: 80%+ 覆盖率
- 集成测试: 100% 核心API
- E2E测试: 100% 关键业务流程
- 性能测试: 所有页面<2.5s LCP

### 用户体验
- 统一UI设计（shadcn/ui组件库）
- 完整i18n支持（中英文）
- Loading骨架屏（减少白屏）
- 友好错误提示（Toast）
- 实时数据更新（SSE）

---

## ⚠️ 技术注意事项

### 1. 数据安全
- ✅ JWT认证（所有API必须）
- ✅ RLS隔离（基于user_id）
- ✅ OAuth Token加密存储
- ✅ 敏感数据脱敏

### 2. 性能优化
- ✅ SWR缓存（5分钟）
- ✅ 并发请求（Promise.all）
- ✅ 懒加载（dynamic import）
- ✅ 虚拟滚动（长列表）
- ✅ 分页限制（默认20条）

### 3. 错误处理
- ✅ 统一Error Boundary
- ✅ API重试机制（3次）
- ✅ 友好错误提示
- ✅ 降级方案（骨架屏/空状态）

### 4. i18n国际化
- ✅ 所有文本使用t()函数
- ✅ 中英文切换
- ✅ 日期数字格式化
- ✅ 翻译文件规范

### 5. 测试策略
- ✅ 单元测试（Jest/Vitest）
- ✅ 集成测试（API端点）
- ✅ E2E测试（Playwright）
- ✅ 性能测试（Lighthouse）

---

## 📦 交付物清单

### 文档
- [x] 完整技术实现方案 (`IMPLEMENTATION_PLAN_V1.md`)
- [x] 执行摘要 (`EXECUTIVE_SUMMARY.md`)
- [ ] API端点文档（基于OpenAPI specs）
- [ ] 前端组件文档（Storybook）
- [ ] 用户使用手册
- [ ] 开发部署指南

### 代码
- [ ] Frontend页面（5个核心模块，20+组件）
- [ ] Backend API增强（3个服务，15+端点）
- [ ] E2E测试（12个测试脚本）
- [ ] 单元测试（80%+覆盖率）

### 部署
- [ ] 预发环境部署
- [ ] UAT用户验收测试
- [ ] 生产环境发布
- [ ] 监控告警配置

---

## 🚦 当前状态

### 已完成
- ✅ 现有架构深度分析
- ✅ API端点全面梳理
- ✅ 数据模型理解
- ✅ 5个业务需求详细设计
- ✅ 数据流设计
- ✅ 前端组件设计
- ✅ 实施计划制定
- ✅ 技术方案文档

### 待开始
- ⏳ 后端API增强（3天）
- ⏳ 前端页面开发（14天）
- ⏳ 集成测试与优化（3天）
- ⏳ 部署上线（3天）

---

## 👥 团队分工建议

### Backend Team (2人)
- **Developer A**: Console Service、Offer Service增强
- **Developer B**: AdsCenter Service增强

### Frontend Team (2人)
- **Developer C**: Dashboard、Offers页面
- **Developer D**: AdsCenter、Tasks、Settings页面

### QA Team (1人)
- **Tester**: E2E测试编写、执行、缺陷跟踪

---

## 📈 成功标准

### 功能完整性
- ✅ 5个核心模块100%实现
- ✅ 所有子功能可用
- ✅ 业务流程完整闭环

### 质量标准
- ✅ E2E测试通过率>95%
- ✅ 性能指标达标（LCP<2.5s）
- ✅ 无P0/P1安全漏洞
- ✅ 无P0/P1功能缺陷

### 用户满意度
- ✅ UI/UX友好（参考Makerkit标准）
- ✅ 操作流畅（无明显卡顿）
- ✅ 功能易用（用户上手时间<10分钟）

---

## 📞 联系与支持

**项目负责人**: Development Team Lead
**技术架构师**: Solutions Architect
**前端负责人**: Frontend Lead
**后端负责人**: Backend Lead
**QA负责人**: QA Lead

**文档位置**: `docs/BusinessRequirements/`
**更新频率**: 每周一次（周五17:00）
**问题跟踪**: GitHub Issues + 每日站会

---

**文档创建**: 2025-10-15
**最后更新**: 2025-10-15
**下次Review**: 实施开始后每周五
