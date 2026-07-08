# Supabase 前端 i18n 迭代进度

> 记录 2025-01-XX 迭代中针对前端国际化的最新修复项与待办。

## 本轮完成

- ✅ 设置快捷命令面板 `SettingsCommandPalette` 接入 `settings` 命名空间，支持标题、描述、关键词多语言搜索。
- ✅ 侧边导航使用 `navigation` 命名空间，兼容 API / fallback 配置的翻译展示。
- ✅ Style Guide 页面（`/style-guide`）全面切换翻译键，覆盖色板、排版、组件示例与图标库。
- ✅ Subscription 方案组件 `Plans.tsx` 完成 i18n 重构，包含推荐卡片、滑块、表格、当前套餐摘要等所有文案；新增 `catalog.*` 等翻译键。
- ✅ 管理后台通知中心（Templates / Broadcasts）接入 `admin` 命名空间，包含 Toast、空态、弹窗、表格字段与状态徽标翻译。
- ✅ Pricing 页面（`/pricing`）改造为基于 `marketing` 命名空间的多语言文案，支持套餐介绍、FAQ、CTA 等完整内容。
- ✅ Careers 页面（`/careers`）接入 `marketing` 命名空间，岗位信息与招募 CTA 全部支持双语展示。
- ✅ 翻译资源补充：新增 `styleGuide.json`、扩展 `subscription.json`、更新 `navigation.json`，并调整 `icon-registry` 默认英文标签。
- ✅ Magic Link 确认页（`/auth/confirm`）接入 `auth.magicLink` 命名空间，统一处理加载、成功与失败状态的提示文案。
- ✅ 语言切换器、个人菜单与移动端底部导航全部使用翻译键，并补充 `common.table` / `common.languages` / `navigation.mobileNav` 命名空间资源。
- ✅ Dashboard 顶部搜索框、通知弹窗与 Token 徽章采用 `common.dashboardTopbar` 翻译键；系统告警横幅 `SystemAlertsBanner` 接入 `admin.systemAlerts`，实现多语言提示与 aria-label。
- ✅ Setup Error 页面与手动信息补录表单迁移至 `setup` 命名空间，完成标题、描述、按钮与错误提示的全面国际化。
- ✅ 管理后台 Feature Flags 列表、创建/编辑/历史弹窗接入 `admin.featureFlags`，统一统计卡、表格列、按钮、确认弹窗与时间格式的多语言输出。
- ✅ 管理后台趋势面板 `DashboardTrendsCharts` 使用 `admin.dashboardTrends` 翻译键，覆盖错误文案、时间范围切换、空态提示及图表标题。
- ✅ Token 余额管理列表接入 `admin.tokens.management` 翻译键，统一搜索输入、表格列、提示信息与操作按钮文案。
- ✅ **Round 11 构建修复 + 页面国际化**：
  - **TypeScript 类型错误修复**：
    - 修复 `SettingsCommandPalette.tsx` Line 99 类型推断错误（为 `result` 添加显式类型注解 `as string | string[] | undefined`）
    - 修复 `Plans.tsx` Line 105 count 参数类型错误（将 `toLocaleString()` 改为直接传递数字）
    - 修复 6 个 Marketing 页面 `maxWidth` 类型错误（将 `"3xl"` 和 `"4xl"` 统一改为 `"5xl"`）
      - `changelog/page.tsx`
      - `blog/page.tsx`
      - `contact/page.tsx`
      - `privacy/page.tsx`
      - `faq/page.tsx`
      - `features/page.tsx`
  - **Marketing 页面 i18n 完整改造**：
    - `privacy/page.tsx` - 隐私政策页面接入 `marketing.privacyPage` 命名空间（hero + 3个sections）
    - `resources/page.tsx` - 资源中心页面接入 `marketing.resourcesPage` 命名空间（hero + 3个sections + support CTA）
    - `LandingPageClient.tsx` - 修复控制台警告中的中文硬编码（console.warn）
  - **管理后台页面 i18n 改造**：
    - `manage/page.tsx` - 修复 console.warn 中文硬编码
    - `manage/exports/components/ExportCenterClient.tsx` - 完整i18n改造（toast消息、空态、错误提示）
    - `manage/performance/page.tsx` - 完整i18n改造（标题、描述、6个Web Vitals指标说明、阈值标签）
  - **翻译资源补充**：
    - 新增 `marketing.privacyPage.*` 中英双语翻译（标题、描述、3个隐私条款章节）
    - 新增 `marketing.resourcesPage.*` 中英双语翻译（标题、描述、3个资源分类 + 支持区域）
    - 新增 `admin.exports.*` 中英双语翻译（错误消息、成功提示、空态文案）
    - 新增 `admin.performance.*` 中英双语翻译（页面标题、3个section标题、6个指标描述、3个阈值标签）
  - ✅ 构建成功通过（`npm run build` 无错误，所有69个页面已 SSR 预渲染）

## 未解决事项 / 后续计划

- [ ] Marketing 静态页（Landing 等）仍存在部分中文占位，需要继续统一翻译。
- [ ] 管理后台其余模块（Exports、Metrics 等）仍有中文提示，需逐步接入 `admin` 命名空间。
- [ ] UI 组件 Storybook 示例及若干核心组件（Badge 等）的中文默认文案待清理。
- [x] ~~构建仍受 `MarketingPageLayout` `maxWidth` 枚举限制影响~~ **已修复**
- [x] ~~`privacy/page.tsx` 仍使用硬编码中文内容~~ **已修复**
- [x] ~~`resources/page.tsx` 仍使用硬编码中文内容~~ **已修复**
- [ ] 对既有 `storybook` 展示、命令面板关键词进行双语校验，确保搜索覆盖英文/中文输入。

## 备注

- 所有翻译键存储于 `public/locales/{locale}`，本轮新增命名空间需同步在 `src/i18n/i18n.settings.ts` 中声明。
- 翻译键命名遵循 `模块.结构.字段` 约定（例如 `subscriptionTableMonthly`、`styleGuide.colors.items.surfaceMuted.label`）。
- 继续迭代时，请先在此文档更新进度，再进行代码修改，确保 i18n 状态可追踪。 
