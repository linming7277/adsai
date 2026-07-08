# FrontendDesignComplete 任务拆解清单

> 文档依据：`docs/SupabaseGo/FrontendDesignComplete_20251009.md`
> 目标：100% 落地终极版前端设计方案，按模块跟踪执行进度。

## 一、业务逻辑与架构
- [ ] 1.1 落实 Offer 评估新版流程（包含 Token 结算、AI 分支、缓存策略）
- [ ] 1.2 重构页面架构（App Router 路由分层、数据隔离）
- [ ] 1.3 完成路由隔离 & 多租户支持（组织/用户级 Separation）
- [ ] 1.4 更新数据模型与 Supabase 表结构（评估历史、AI 结果、Token 账簿）

## 二、核心业务页面
- [ ] 2.1 Dashboard 页面重构（概览卡片、实时刷新、Shortcut 区域）
- [ ] 2.2 Offers 页面 3 大模块（列表交互、评估详情侧栏、批量操作）
- [ ] 2.3 Ads Center 页面（账号联动、自动审核、统计可视化）
- [ ] 2.4 Tasks 页面（任务看板、批量指派、状态切换）
- [ ] 2.5 User Info 页面（个人中心、Billing、Token 额度展示）

## 三、营销与引导
- [ ] 3.1 首页营销页（Hero、痛点对比、信任背书、CTA）
- [ ] 3.2 Footer 九大页面（Pricing、Privacy、Terms 等）
- [ ] 3.3 新用户引导旅程（Checklist、Aha Moment、空状态）

## 四、导航与组件体系
- [x] 4.1 导航系统（App Shell、左侧导航、顶部工具栏、自适应 Breakpoint）
- [x] 4.2 组件库规范（表格、过滤器、对话框、空状态、加载骨架）
- [x] 4.3 视觉设计系统（色彩/排版/阴影/动效令牌统一）

## 五、国际化与 SEO
- [x] 5.1 国际化工程化方案（语言包、动态路由、Locale 切换）
- [x] 5.2 SEO 优化（meta、OpenGraph、schema.org、Sitemap、性能指标）

## 六、优化与实施支撑
- [ ] 6.1 行业最佳实践落地（对照 Stripe/Linear/Vercel 的 UX 模式）
- [ ] 6.2 性能优化策略（RUM 指标、Lazy/Streaming、Edge Cache）
- [ ] 6.3 制定实施路线图（分阶段里程碑、依赖、回滚策略）
- [ ] 6.4 成功指标汇总与监控接入（Activation、Retention、NPS 等）

> 注：所有任务默认需完成设计稿、组件实现、API 对接、数据校验、埋点/监控以及自测，完成后在文档内同步状态。
