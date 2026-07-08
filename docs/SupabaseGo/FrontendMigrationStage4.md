# AutoAds 前端迁移阶段4 - 控制台功能回迁

## 本阶段交付
- **设置导航收敛**：用户端设置菜单移除“组织”入口，避免继续引导至已废弃流程；直接访问 `settings/organization/*` 时展示迁移提示，不影响后台 Admin 相关页面。
- **组织页面只读提示**：新增 `OrganizationSunsetNotice` 组件，在组织相关子页（概览、成员、邀请）统一展示迁移说明与联系方式，彻底解除 Firebase Storage / Firestore 依赖。
- **订阅流程暂停提示**：`/settings/subscription` 改为信息提示 + 邮件联系渠道，保留原有 Section 结构，清晰告知用户计费迁移状态。
- **多语言文案**：在 `common.json` 中新增组织与订阅提示文案，兼容中英双语；其余业务文案未做调整。

## 影响范围说明
- 调整仅发生在前端设置模块，后台 Admin 页面、API 及组织相关组件保持原状，后续阶段可继续复用。
- 保留原有路由文件，避免历史链接报 404，同时确保不会调用 Firebase 组织接口。

## 验证
- 本地 lint：`npm run lint -- apps/frontend`（存在既有告警，未在本阶段处理）。
- 手动验证：
  - 登录后访问 `/settings/profile`、`/settings/subscription`，确认布局与提示信息符合预期；
  - 直接访问 `/settings/organization`、`/settings/organization/members` 等路由，显示迁移提醒且无报错；
  - Admin 导航与组织相关操作不受影响。

## 后续计划
- 与后端团队对齐 Dashboard / Offers / Tokens API 的 Supabase 版本，实现真正的数据回迁。
- 结合阶段5，逐步替换 Admin 模块中的 Firebase Admin 依赖，保持功能完整的同时完成 Supabase 接入。
- 清理未使用的组织组件与 Hook 前需确认 Admin 使用情况，避免重复触发“后台瘦身”。
