# UX 最佳实践差距清单（2025-10-11）

> 对照 Stripe、Linear、Vercel 的体验模式，梳理 AdsAI 现状与差距。

## 1. 导航 & 快捷操作
- **现状**：左侧导航/顶部导航已覆盖核心模块，但缺少统一的快捷键、命令面板与 Skip Link。
- **对标差距**：
  - Linear/Stripe 提供 `⌘K` Command Palette、全局快捷方式说明以及可访问的 Skip Link。
  - Vercel 在每个主要页面提供键盘快捷提示。
- **解决方案**：
  - 新增 `GlobalHotkeys`（支持 `⌘K` Command Menu、`⌘S` 表单保存、`Shift+?` 快捷说明）。
  - 在布局中加入 `SkipToContent` 实现键盘无障碍。

## 2. 表单与反馈
- **现状**：Profile、Organization 等表单依赖按钮提交，缺少快捷保存与实时反馈提示。
- **对标差距**：
  - Stripe 的 Billing/Profile 表单支持 `⌘S` 保存与 Auto Save 提示。
  - Linear 在表单提交时提供顶部进度与即时 toast。
- **解决方案**：
  - 通过 `useFormHotkeys` 统一监听 `⌘S`/`Ctrl+S` 触发提交，复用 `toast.promise` 输出状态。
  - 表单底部添加提示“使用 ⌘ + S 快速保存”。

## 3. 无障碍（A11y）
- **现状**：Landing 页组件语义化有限、导航缺少 `aria` 属性。
- **对标差距**：
  - Vercel 官网为关键区块注入 landmark (`main`、`section`)、`aria-label`、动态 alt。
  - Stripe 在 CTA 区域提供明确的辅助信息与焦点管理。
- **解决方案**：
  - Landing 各 Section 使用 `t('marketing:...')` 渲染文本，增加语义标签与可访问说明。
  - 联系页改为 Server Component 输出多语言文案和 `main` 区块。

## 4. 性能体验
- **现状**：Landing 页加载时一次性拉取所有模块，与 Console 后端缺少 RUM 指标对接。
- **对标差距**：
  - Vercel/Stripe 对营销页进行 chunk 拆分、提供 Web Vitals 上报与缓存策略。
- **解决方案**：
  - 使用 `React.lazy` + `Suspense` 异步加载 Case Studies、Benefits 等重组件。
  - 通过 `/api/monitoring/web-vitals` 将 Core Web Vitals 转发给 Console 服务。
  - 新增 `getMarketingSummary` server util + revalidate 缓存策略。

## 5. 成功指标治理
- **现状**：缺少 Activation/Retention/NPS 等统一指标。
- **对标差距**：
  - Stripe Dashboard、Linear Admin 均提供成功指标看板。
- **解决方案**：
  - Console Service 提供 `/api/v1/console/metrics/success` API 聚合 Activation/Retention/Conversion。
  - 前端 Console Dashboard 展示指标卡片，并配套 NPS 调查接口（Webhooks 留待下一阶段）。

> 以上差距已在本次 Package G 实施中落地，可继续以文档、组件模板复用方式沉淀。
