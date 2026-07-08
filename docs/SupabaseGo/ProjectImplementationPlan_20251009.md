# AutoAds 前端完整方案落地实施计划

基于 `FrontendDesignComplete_20251009.md` 8,728 行完整设计规范

---

## 一、项目概览

### 1.1 项目目标
按照完整设计规范实施 AutoAds 前端系统，包括：
- 5 个核心业务页面（Dashboard、Offers、Ads Center、Tasks、User Info）
- 1 个营销首页（8 个 Section）
- 9 个 Footer 页面
- 完整的 Offer 评估业务逻辑（13 个需求）
- 签到和邀请机制
- 导航系统、组件库、国际化、性能优化

### 1.2 时间规划
**总工期**：11 周（77 个工作日）
**开始日期**：2025-10-14
**预计完成**：2026-01-03

### 1.3 团队配置建议
- 前端开发：2 人
- 后端开发（Go）：1 人
- UI/UX 设计师：1 人（前 3 周全职，后兼职）
- QA 测试：1 人（第 9 周起全职）
- 项目经理：1 人（兼职）

---

## 二、任务拆分体系（WBS - Work Breakdown Structure）

### 2.1 第一层级：阶段划分（6 个阶段）

```
Phase 1: 基础设施（第 1-2 周）
Phase 2: 核心业务功能（第 3-6 周）
Phase 3: 营销和用户中心（第 7-8 周）
Phase 4: 系统增强（第 9 周）
Phase 5: 测试和优化（第 10 周）
Phase 6: 上线准备（第 11 周）
```

### 2.2 第二层级：功能模块（21 个模块）

每个模块对应设计文档的一个章节：

1. ✅ Offer 评估业务逻辑（文档第 1 章）
2. ✅ 架构设计（文档第 2-4 章）
3. ✅ Dashboard 页面（文档第 5 章）
4. ✅ Offers 页面（文档第 6 章）
5. ✅ Ads Center 页面（文档第 7 章）
6. ✅ Tasks 页面（文档第 8 章）
7. ✅ User Info 页面（文档第 9 章）
8. ✅ 首页营销（文档第 10 章）
9. ✅ Footer 页面（文档第 11 章）
10. ✅ 导航系统（文档第 12 章）
11. ✅ 组件库（文档第 13 章）
12. ✅ 视觉设计系统（文档第 14 章）
13. ✅ 国际化（文档第 15 章）
14. ✅ 性能优化（文档第 16 章）
15. ✅ 签到机制（文档第 21.1 章）
16. ✅ 邀请机制（文档第 21.2 章）
17. ✅ SEO 优化
18. ✅ 安全审计
19. ✅ 监控告警
20. ✅ 测试覆盖
21. ✅ 文档和培训

### 2.3 第三层级：开发任务（200+ 个任务）

每个功能模块拆分为具体的开发任务，每个任务：
- **时长**：0.5-2 天（避免过大任务）
- **可测试**：有明确的验收标准
- **可追踪**：关联代码提交和文档章节

---

## 三、详细任务清单（按周划分）

### 🗓️ Week 1-2: 基础架构与核心页面

#### 📦 模块 1: 项目初始化与基础架构（5 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T001 | 初始化 Next.js 14 项目，配置 TypeScript | 0.5d | 前端 A | `package.json`, `tsconfig.json` | 第 2 章 |
| T002 | 配置 Tailwind CSS + shadcn/ui | 0.5d | 前端 A | `tailwind.config.js` | 第 14 章 |
| T003 | 集成 Supabase 客户端库 | 0.5d | 前端 A | `lib/supabase/client.ts` | 第 2 章 |
| T004 | 配置 NextAuth（Email + OAuth） | 1d | 前端 A | `app/api/auth/[...nextauth]/route.ts` | 第 2 章 |
| T005 | 实现 Middleware 路由拦截 | 1d | 前端 A | `middleware.ts` | 第 4 章 |
| T006 | 配置 Supabase RLS 策略 | 1d | 后端 | SQL 脚本 | 第 4 章 |
| T007 | 创建基础数据表（User, Offer） | 0.5d | 后端 | SQL 脚本 | 第 3 章 |

**里程碑 M1**: 用户可以注册、登录，访问受保护路由

---

#### 📦 模块 2: Dashboard 页面（3 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T008 | 创建 Dashboard 路由（Server Component） | 0.5d | 前端 A | `app/dashboard/page.tsx` | 第 5 章 |
| T009 | 实现 5 个 KPI 卡片组件 | 1d | 前端 A | `components/dashboard/kpi-card.tsx` | 第 5 章 |
| T010 | 实现待办任务流组件 | 0.5d | 前端 A | `components/dashboard/action-items.tsx` | 第 5 章 |
| T011 | 集成 Recharts 数据趋势图表 | 1d | 前端 B | `components/dashboard/charts.tsx` | 第 5 章 |
| T012 | 实现 Dashboard 数据查询 API | 0.5d | 后端 | `lib/queries/dashboard.ts` | 第 5 章 |
| T013 | 集成 SWR 30 秒自动刷新 | 0.5d | 前端 A | `hooks/use-dashboard-data.ts` | 第 5 章 |

**里程碑 M2**: Dashboard 显示真实数据，30 秒自动刷新

---

#### 📦 模块 3: Offers 页面基础（2 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T014 | 创建 Offers 路由和页面布局 | 0.5d | 前端 B | `app/offers/page.tsx` | 第 6 章 |
| T015 | 实现 OffersTable 组件（8 列） | 1d | 前端 B | `components/offers/offers-table.tsx` | 第 6 章 |
| T016 | 实现搜索筛选组件 | 0.5d | 前端 B | `components/offers/offers-filters.tsx` | 第 6 章 |
| T017 | 配置 Zustand 筛选状态管理 | 0.5d | 前端 B | `hooks/use-offer-filters.ts` | 第 6 章 |
| T018 | 实现 Offers 数据查询 API | 0.5d | 后端 | `lib/queries/offers.ts` | 第 6 章 |

---

### 🗓️ Week 3-4: Offer 评估业务逻辑

#### 📦 模块 4: SiteRank 评估服务（Go 后端）（5 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T019 | 创建 SiteRank 服务基础架构 | 0.5d | 后端 | `services/siterank/main.go` | 第 1 章 |
| T020 | 实现 Browser-Exec 客户端集成 | 1d | 后端 | `services/siterank/clients/browserexec.go` | 第 1 章 |
| T021 | 实现 SimilarWeb API 集成 | 1d | 后端 | `services/siterank/clients/similarweb.go` | 第 1 章 |
| T022 | 实现 Redis 全局缓存策略 | 1d | 后端 | `services/siterank/cache/redis.go` | 第 1 章 |
| T023 | 实现 URL Hash 计算和聚合 | 0.5d | 后端 | `services/siterank/utils/urlhash.go` | 第 1 章 |
| T024 | 实现基础评估逻辑（不含 AI） | 1d | 后端 | `services/siterank/services/evaluation.go` | 第 1 章 |
| T025 | 创建 OfferEvaluation 数据表 | 0.5d | 后端 | SQL 脚本 | 第 1 章 |

**里程碑 M3**: 单个 Offer 基础评估成功，数据存储到数据库

---

#### 📦 模块 5: AI 评估集成（Vertex AI）（3 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T026 | 配置 Vertex AI Gemini 客户端 | 0.5d | 后端 | `services/siterank/clients/vertexai.go` | 第 1 章 |
| T027 | 实现 AI 评估 Prompt 工程 | 1d | 后端 | `services/siterank/prompts/evaluation.go` | 第 1 章 |
| T028 | 实现 AI 评估结果解析 | 0.5d | 后端 | `services/siterank/parsers/ai_response.go` | 第 1 章 |
| T029 | 集成 AI 评估到评估流程（Elite 用户） | 1d | 后端 | `services/siterank/services/evaluation.go` | 第 1 章 |
| T030 | 扩展 Offer 表（AI 字段） | 0.5d | 后端 | SQL 脚本 | 第 1 章 |

---

#### 📦 模块 6: Token 消耗和权限控制（2 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T031 | 创建 TokenConsumptionLog 表 | 0.5d | 后端 | SQL 脚本 | 第 1 章 |
| T032 | 实现 Token 扣费逻辑 | 0.5d | 后端 | `services/siterank/services/token.go` | 第 1 章 |
| T033 | 实现订阅套餐权限检查 | 0.5d | 后端 | `services/siterank/middleware/auth.go` | 第 1 章 |
| T034 | 实现 Token 余额不足处理 | 0.5d | 后端 | 错误处理逻辑 | 第 1 章 |

---

#### 📦 模块 7: 前端评估功能集成（3 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T035 | 实现 EvaluateButton 组件 | 1d | 前端 A | `components/offers/evaluate-button.tsx` | 第 6 章 |
| T036 | 实现 AIScoreCell 组件 | 0.5d | 前端 A | `components/offers/ai-score-cell.tsx` | 第 6 章 |
| T037 | 实现批量评估队列组件 | 1d | 前端 A | `components/offers/evaluation-queue.tsx` | 第 6 章 |
| T038 | 实现评估 API 路由 | 0.5d | 前端 A | `app/api/offers/[id]/evaluate/route.ts` | 第 6 章 |
| T039 | 集成评估历史记录 Tab | 0.5d | 前端 A | `components/offers/evaluation-history-tab.tsx` | 第 6 章 |

**里程碑 M4**: Offer 评估完整流程打通（基础 + AI），Token 正确扣费

---

### 🗓️ Week 5: Ads Center + Tasks 页面

#### 📦 模块 8: Ads Center 页面（3 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T040 | 创建 Ads Center 路由和布局 | 0.5d | 前端 B | `app/adscenter/page.tsx` | 第 7 章 |
| T041 | 实现 OAuth 授权流程（Google Ads） | 1d | 前端 B + 后端 | OAuth 集成 | 第 7 章 |
| T042 | 实现账号列表展示（Card 布局） | 0.5d | 前端 B | `components/adscenter/accounts-tab.tsx` | 第 7 章 |
| T043 | 实现执行策略管理 Tab | 1d | 前端 B | `components/adscenter/policies-tab.tsx` | 第 7 章 |
| T044 | 创建 AdsAccount 数据表 | 0.5d | 后端 | SQL 脚本 | 第 7 章 |

---

#### 📦 模块 9: Tasks 页面（2 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T045 | 创建 Tasks 路由和布局 | 0.5d | 前端 A | `app/tasks/page.tsx` | 第 8 章 |
| T046 | 实现 Token Overview 卡片 | 0.5d | 前端 A | `components/tasks/token-overview.tsx` | 第 8 章 |
| T047 | 实现任务列表组件 | 0.5d | 前端 A | `components/tasks/tasks-table.tsx` | 第 8 章 |
| T048 | 实现任务详情对话框 | 0.5d | 前端 A | `components/tasks/task-detail-dialog.tsx` | 第 8 章 |
| T049 | 创建 Task 数据表 | 0.5d | 后端 | SQL 脚本 | 第 8 章 |

---

### 🗓️ Week 6: User Info 页面（5 个 Tab）

#### 📦 模块 10: User Info 页面（5 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T050 | 创建 User Info 路由和 Tab 布局 | 0.5d | 前端 B | `app/userinfo/page.tsx` | 第 9 章 |
| T051 | 实现 Profile Tab（头像上传） | 1d | 前端 B | `components/userinfo/profile-tab.tsx` | 第 9 章 |
| T052 | 实现 Subscription Tab（套餐对比） | 1d | 前端 B | `components/userinfo/subscription-tab.tsx` | 第 9 章 |
| T053 | 实现 Tokens Tab（充值流程） | 1d | 前端 B | `components/userinfo/tokens-tab.tsx` | 第 9 章 |
| T054 | 实现 Referral Tab（邀请功能） | 1d | 前端 A | `components/userinfo/referral-tab.tsx` | 第 21.2 章 |
| T055 | 实现 Checkin Tab（签到功能） | 0.5d | 前端 A | `components/userinfo/checkin-tab.tsx` | 第 21.1 章 |

**里程碑 M5**: 用户中心 5 个 Tab 全部可用

---

### 🗓️ Week 7: 首页营销页面

#### 📦 模块 11: 首页 8 个 Section（5 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T056 | 实现 Hero Section | 1d | 前端 B | `components/landing/hero-section.tsx` | 第 10 章 |
| T057 | 实现 Trust Bar（实时统计） | 0.5d | 前端 B | `components/landing/trust-bar.tsx` | 第 10 章 |
| T058 | 实现 Features Section | 1d | 前端 B | `components/landing/features-section.tsx` | 第 10 章 |
| T059 | 实现 How It Works Section | 1d | 前端 B | `components/landing/how-it-works.tsx` | 第 10 章 |
| T060 | 实现 Pricing Section | 0.5d | 前端 B | `components/landing/pricing-section.tsx` | 第 10 章 |
| T061 | 实现 Final CTA Section | 0.5d | 前端 B | `components/landing/final-cta.tsx` | 第 10 章 |
| T062 | 首页性能优化（图片懒加载） | 0.5d | 前端 B | 性能优化 | 第 16 章 |

---

### 🗓️ Week 8: Footer 页面 + 导航系统

#### 📦 模块 12: Footer 9 个页面（2.5 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T063 | 实现 Footer 组件 | 0.5d | 前端 A | `components/layout/footer.tsx` | 第 11 章 |
| T064 | 创建 Features 页面 | 0.5d | 前端 A | `app/features/page.tsx` | 第 11 章 |
| T065 | 创建 Changelog 页面 | 0.25d | 前端 A | `app/changelog/page.tsx` | 第 11 章 |
| T066 | 创建 Roadmap 页面 | 0.25d | 前端 A | `app/roadmap/page.tsx` | 第 11 章 |
| T067 | 创建 Case Studies 页面 | 0.5d | 前端 A | `app/case-studies/page.tsx` | 第 11 章 |
| T068 | 创建 Support 页面（知识库） | 0.5d | 前端 A | `app/support/page.tsx` | 第 11 章 |
| T069 | 创建其他 Footer 页面（4 个） | 0.5d | 前端 A | Privacy/Terms/Contact/Careers | 第 11 章 |

---

#### 📦 模块 13: 导航系统（2.5 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T070 | 实现顶部导航栏 | 1d | 前端 B | `components/layout/navbar.tsx` | 第 12 章 |
| T071 | 实现移动端底部导航 | 0.5d | 前端 B | `components/layout/mobile-bottom-nav.tsx` | 第 12 章 |
| T072 | 实现通知中心 | 0.5d | 前端 B | `components/layout/notifications.tsx` | 第 12 章 |
| T073 | 导航状态管理（高亮、角标） | 0.5d | 前端 B | 状态逻辑 | 第 12 章 |

**里程碑 M6**: 营销页面和导航系统完成

---

### 🗓️ Week 9: 国际化 + 视觉优化

#### 📦 模块 14: 国际化（2 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T074 | 配置 i18next | 0.5d | 前端 A | `i18n/config.ts` | 第 15 章 |
| T075 | 提取所有文案到翻译文件 | 1d | 前端 A+B | 8 个 namespace JSON | 第 15 章 |
| T076 | 实现语言切换组件 | 0.5d | 前端 A | `components/ui/language-switcher.tsx` | 第 15 章 |
| T077 | 英文翻译审校 | 1d | 外包翻译 | 翻译文件 | 第 15 章 |

---

#### 📦 模块 15: 视觉设计系统（3 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T078 | 实现设计 Token（颜色/间距/排版） | 1d | 前端 B | `styles/design-tokens.css` | 第 14 章 |
| T079 | 实现动画系统 | 0.5d | 前端 B | `styles/animations.css` | 第 14 章 |
| T080 | 优化所有页面动画效果 | 1d | 前端 A+B | 动画优化 | 第 14 章 |
| T081 | 响应式设计审查 | 0.5d | 前端 A+B | 移动端适配 | 第 14 章 |

---

### 🗓️ Week 10: 性能优化 + 测试

#### 📦 模块 16: 性能优化（3 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T082 | 实现代码分割和懒加载 | 1d | 前端 A | Dynamic imports | 第 16 章 |
| T083 | 优化图片加载（Next.js Image） | 0.5d | 前端 A | 图片优化 | 第 16 章 |
| T084 | 添加数据库索引 | 0.5d | 后端 | SQL 脚本 | 第 16 章 |
| T085 | 实现虚拟滚动（大数据量表格） | 1d | 前端 B | 虚拟滚动组件 | 第 16 章 |
| T086 | 添加 Skeleton 加载状态 | 0.5d | 前端 B | Skeleton 组件 | 第 16 章 |

---

#### 📦 模块 17: 测试覆盖（2 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T087 | 编写单元测试（核心组件） | 1d | QA + 前端 | Jest 测试 | - |
| T088 | 编写 E2E 测试（关键流程） | 1d | QA | Playwright 测试 | - |
| T089 | 性能压测（Lighthouse） | 0.5d | QA | 性能报告 | 第 16 章 |

**里程碑 M7**: Lighthouse 分数 > 90，测试覆盖率 > 80%

---

### 🗓️ Week 11: 上线准备

#### 📦 模块 18: 上线准备（5 天）

| ID | 任务 | 工作量 | 负责人 | 输出物 | 文档章节 |
|----|------|--------|--------|--------|----------|
| T090 | 生产环境配置 | 0.5d | 后端 | 环境变量配置 | - |
| T091 | SEO 优化（Meta 标签、Sitemap） | 1d | 前端 A | SEO 配置 | - |
| T092 | 安全审计（OWASP Top 10） | 1d | 后端 | 安全报告 | - |
| T093 | 监控告警配置（Sentry、GA） | 0.5d | 后端 | 监控配置 | - |
| T094 | 用户文档编写 | 1d | PM | 用户手册 | - |
| T095 | Beta 用户内测 | 3d | 全员 | 反馈收集 | - |
| T096 | Bug 修复和优化 | 2d | 全员 | Bug 修复 | - |

**里程碑 M8**: 生产环境上线，Beta 用户满意度 > 4.5/5

---

## 四、任务跟进体系

### 4.1 任务管理工具选择

推荐使用 **Linear** 或 **Jira**：
- 支持 Kanban 看板
- 支持 Sprint 管理
- 支持任务依赖关系
- 集成 GitHub PR 自动更新
- 支持自定义字段（文档章节引用）

### 4.2 任务状态流转

```
待开始 (Backlog) 
  ↓
进行中 (In Progress) 
  ↓
代码审查 (Code Review) 
  ↓
测试中 (Testing) 
  ↓
已完成 (Done)
```

### 4.3 每日站会（Daily Standup）

**时间**: 每天早上 10:00，15 分钟

**固定模板**:
1. 昨天完成了什么？
2. 今天计划做什么？
3. 有什么阻碍？

**记录工具**: Notion 或 Confluence

### 4.4 周报机制

**每周五下午 5:00**，项目经理生成周报：

| 维度 | 内容 |
|------|------|
| 本周完成任务 | 列出所有 Done 的任务 ID |
| 本周未完成任务 | 列出延期任务及原因 |
| 下周计划任务 | 列出下周 Sprint 任务 |
| 风险和阻碍 | 需要管理层支持的事项 |
| 里程碑进度 | 当前 M1-M8 完成情况 |

### 4.5 里程碑评审会

每个里程碑完成后，召开评审会：

**参与人员**: 全体团队 + 产品负责人

**评审内容**:
1. 演示功能（Live Demo）
2. 验收标准检查
3. 性能指标检查
4. 决定是否通过里程碑

**输出**: 里程碑验收报告

---

## 五、任务优先级管理

### 5.1 优先级定义

| 级别 | 说明 | 标识 |
|------|------|------|
| P0 | 阻塞性任务，必须立即完成 | 🔴 |
| P1 | 重要任务，本周必须完成 | 🟠 |
| P2 | 中等任务，本 Sprint 完成 | 🟡 |
| P3 | 低优先级，可延期 | 🟢 |

### 5.2 P0 任务清单（关键路径）

| ID | 任务 | 原因 |
|----|------|------|
| T006 | 配置 Supabase RLS 策略 | 数据安全基础 |
| T024 | 实现基础评估逻辑 | 核心业务功能 |
| T029 | 集成 AI 评估 | 核心差异化功能 |
| T035 | 实现 EvaluateButton | 用户核心操作 |
| T041 | OAuth 授权流程 | 广告平台集成基础 |
| T091 | SEO 优化 | 影响流量获取 |

### 5.3 依赖关系管理

使用 **关键路径法（CPM）** 识别阻塞任务：

```
T001 → T003 → T005 → T008 → M1 (基础架构完成)
         ↓
       T006 → T007 → T018 → T014 → M2 (Offers 基础完成)
                               ↓
                             T024 → T029 → T035 → M4 (评估功能完成)
```

---

## 六、风险管理

### 6.1 技术风险

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|----------|
| Vertex AI API 延迟高 | 中 | 高 | 1) 实现超时机制 2) 降级到基础评估 |
| SimilarWeb API 配额不足 | 低 | 高 | 1) Redis 缓存 7 天 2) 购买更高配额 |
| Browser-Exec 服务不稳定 | 中 | 中 | 1) 实现重试机制 2) 备用域名提取方案 |
| 数据库性能瓶颈 | 中 | 高 | 1) 提前添加索引 2) 实现查询分页 |
| 前端包体积过大 | 高 | 中 | 1) 代码分割 2) Tree-shaking 3) 按需加载 |

### 6.2 项目风险

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|----------|
| 人员流失 | 低 | 高 | 1) 代码文档化 2) 知识转移会议 |
| 需求变更 | 中 | 中 | 1) 需求冻结机制 2) 变更评审会 |
| 第三方服务故障 | 中 | 高 | 1) 服务降级方案 2) 监控告警 |
| 时间延期 | 中 | 高 | 1) 每周进度审查 2) 调整资源分配 |

---

## 七、质量保证

### 7.1 代码质量标准

| 维度 | 标准 | 检查工具 |
|------|------|----------|
| TypeScript 类型覆盖 | 100% | tsc --noEmit |
| ESLint 通过率 | 100% | ESLint |
| 代码格式化 | 统一 Prettier | Prettier |
| 单元测试覆盖率 | > 80% | Jest |
| E2E 测试覆盖 | 核心流程 100% | Playwright |

### 7.2 Code Review 规范

**每个 PR 必须**:
1. 关联至少 1 个任务 ID
2. 包含测试用例
3. 通过 CI/CD 检查
4. 至少 1 人审查通过
5. 文档章节引用（如 `Ref: 第 6.3 节`）

### 7.3 发布流程

```
1. 开发分支 (feature/T001-xxx)
   ↓
2. 提交 PR 到 dev 分支
   ↓
3. Code Review + CI 通过
   ↓
4. 合并到 dev 分支
   ↓
5. 每周五合并 dev → staging
   ↓
6. Staging 环境测试 2 天
   ↓
7. 合并 staging → main
   ↓
8. 生产环境发布
```

---

## 八、沟通机制

### 8.1 会议安排

| 会议 | 频率 | 时长 | 参与人 | 目的 |
|------|------|------|--------|------|
| 每日站会 | 每天 | 15min | 全员 | 同步进度，暴露阻碍 |
| 周会 | 每周一 | 1h | 全员 | Sprint 计划 |
| 周报会 | 每周五 | 30min | 全员 + PM | 回顾本周，规划下周 |
| 里程碑评审 | 按需 | 2h | 全员 + 产品 | 验收里程碑 |
| 技术评审 | 按需 | 1h | 技术团队 | 技术方案评审 |

### 8.2 沟通渠道

| 渠道 | 用途 |
|------|------|
| Slack/飞书 | 日常沟通 |
| Linear/Jira | 任务管理 |
| GitHub | 代码协作 |
| Notion/Confluence | 文档知识库 |
| Zoom/腾讯会议 | 视频会议 |

---

## 九、成功指标（KPI）

### 9.1 项目管理 KPI

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 按时交付率 | > 90% | (按时完成任务数 / 总任务数) × 100% |
| Bug 修复时间 | < 2 天 | P0/P1 Bug 从发现到修复的平均时间 |
| 代码审查时间 | < 4 小时 | PR 提交到审查通过的平均时间 |
| 里程碑完成率 | 100% | M1-M8 是否全部通过验收 |
| 技术债务 | < 10 个 | 积压的重构任务数量 |

### 9.2 质量 KPI

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| Lighthouse 性能分数 | > 90 | Lighthouse CI |
| 单元测试覆盖率 | > 80% | Jest Coverage Report |
| 生产环境错误率 | < 0.1% | Sentry 错误统计 |
| 页面加载时间 | < 2 秒 | Google Analytics |
| 移动端适配 | 100% | 手动测试 + BrowserStack |

---

## 十、工具和资源

### 10.1 开发工具

| 工具 | 用途 |
|------|------|
| VS Code | 代码编辑器 |
| Cursor | AI 辅助编程 |
| Postman | API 测试 |
| TablePlus | 数据库管理 |
| Figma | UI 设计协作 |

### 10.2 参考文档

| 文档 | 位置 |
|------|------|
| 完整设计规范 | `docs/SupabaseGo/FrontendDesignComplete_20251009.md` |
| 业务逻辑补充 | `docs/SupabaseGo/BusinessLogicSupplement_20251009.md` |
| 项目实施计划 | `docs/SupabaseGo/ProjectImplementationPlan_20251009.md` |
| Makerkit 文档 | `docs/MarkerkitGo/MustKnowV4.md` |

---

## 十一、附录

### 附录 A: 任务 ID 与文档章节对照表

| 任务范围 | 任务 ID | 文档章节 |
|---------|---------|----------|
| 基础架构 | T001-T007 | 第 2-4 章 |
| Dashboard | T008-T013 | 第 5 章 |
| Offers 基础 | T014-T018 | 第 6 章 |
| Offer 评估 | T019-T039 | 第 1、6 章 |
| Ads Center | T040-T044 | 第 7 章 |
| Tasks | T045-T049 | 第 8 章 |
| User Info | T050-T055 | 第 9、21 章 |
| 首页 | T056-T062 | 第 10 章 |
| Footer + 导航 | T063-T073 | 第 11-12 章 |
| 国际化 | T074-T077 | 第 15 章 |
| 视觉系统 | T078-T081 | 第 14 章 |
| 性能优化 | T082-T086 | 第 16 章 |
| 测试 | T087-T089 | - |
| 上线 | T090-T096 | - |

### 附录 B: Git Commit 规范

```
feat(offers): implement evaluate button component

- Add EvaluateButton with Elite tier detection
- Integrate Token consumption display
- Add loading and error states

Ref: T035, 第 6.4 节
```

**Commit 类型**:
- `feat`: 新功能
- `fix`: Bug 修复
- `refactor`: 重构
- `style`: 样式调整
- `test`: 测试
- `docs`: 文档

---

**文档版本**: v1.0  
**生成日期**: 2025-10-09  
**维护者**: 项目经理  
**更新频率**: 每周更新一次
