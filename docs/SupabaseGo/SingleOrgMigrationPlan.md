# 单组织模式迁移方案与任务拆解

> 创建时间：2025-10-10  
> 责任团队：AutoAds Core Team  
> 目标：将 AutoAds 从多组织 SaaS 架构收敛为单组织、多用户模式，确保业务连续与数据安全

---

## 1. 可行性分析

- **技术可行性**：组织维度主要集中在路由、Supabase RLS、少量 RPC 调用与前端上下文，核心模型可通过“固定默认组织”策略平滑迁移。
- **业务影响**：需要确认现有客户是否依赖多组织；若无，则变更可简化体验、降低运营成本。
- **风险点**：
  - 数据迁移需保证幂等，防止组织孤儿数据；
  - 前端路由改动涉及大量链接与缓存，需要完整测试；
  - 权限与审计逻辑需同步调整，避免越权。
- **收益**：
  - 降低 UI/交互复杂度，减少 1 层路由与大量组织相关设置；
  - 缩短首屏与 API 参数长度，简化权限/计费模型；
  - 统一监控与指标归属，运维成本下降。

结论：在充分测试与回滚预案保障下，可在 2~3 周内完成单组织化改造。

---

## 2. 迁移路线图

| 阶段 | 时间 | 目标 | 关键交付 |
|------|------|------|----------|
| Phase 0 | 准备期 | 需求确认 & 资产盘点 | 组织/成员数据导出、文档同步 |
| Phase 1 | 后端 | 数据迁移 & API 调整 | 固定默认组织、更新 RLS 与 RPC |
| Phase 2 | 前端 | 路由重构 & 状态收敛 | 移除 `[organization]`、统一上下文 |
| Phase 3 | UI/交互 | 组织概念下线 | 调整设置、邀请文案、Dashboard UI |
| Phase 4 | 运维 | 验证与上线 | 文档更新、监控脚本、灰度发布 |

---

## 3. 详细任务拆解

### Phase 0：准备 & 现状盘点
- [ ] P0-1 统计生产环境组织/成员分布，确认是否存在多组织客户（脚本：`scripts/org/export_organization_stats.sql`）
- [ ] P0-2 与产品/法务确认合同、套餐等是否受影响
- [x] P0-3 冻结新建组织入口（警告提示或 Feature Flag）
- [ ] P0-4 梳理组织依赖（数据库表、Supabase RPC、API、前端路由）

### Phase 1：后端与数据层
- 数据迁移
  - [ ] P1-1 新增配置 `DEFAULT_ORGANIZATION_UID`
  - [ ] P1-2 迁移脚本：将所有 `organization_membership` 指向默认组织
  - [ ] P1-3 清理多余组织及关联数据（保留备份）
  - [ ] P1-4 禁止新建/删除组织（触发器或 RPC 守卫）
- API & 权限
  - [ ] P1-5 更新 Supabase RLS：基于 `user_id` 而非 `organization_id`
  - [ ] P1-6 调整后端服务（console/offer/billing/adscenter）接口，org 参数可为空
  - [ ] P1-7 更新事件、审计日志，将组织字段固定为默认值（保留历史）
  - [ ] P1-8 回归测试：`go test ./services/...`、手动验证关键 API

### Phase 2：前端路由与上下文
- 路由重构
  - [ ] P2-1 将 `/dashboard/[organization]/...` 改为 `/dashboard/...`
  - [ ] P2-2 移除 `OrganizationScopeLayout` 中的动态判断，默认返回固定组织对象
  - [ ] P2-3 调整所有链接/导航/跳转逻辑，取消组织参数拼接
  - [ ] P2-4 对旧链接 `/dashboard/{uuid}/...` 做 301/302 兼容
- 状态与 Hook
  - [ ] P2-5 重构 `useCurrentOrganization`、`OrganizationContext`，输出固定数据
  - [ ] P2-6 更新 Zustand/SWR key，移除组织维度缓存
  - [ ] P2-7 更新数据获取 Hook（Dashboard/Offers/Tasks 等）默认使用固定组织
  - [ ] P2-8 回归 Next.js 路由构建与 lint/typecheck

### Phase 3：UI/文案调整
- [ ] P3-1 移除组织设置页面，合并到“工作区设置”或隐藏
- [ ] P3-2 调整邀请成员流程（描述为“邀请用户”）
- [ ] P3-3 Dashboard/导航文案去掉“组织”字样
- [ ] P3-4 更新空状态、提示信息（例如“还没有创建组织”改为“还没有配置数据”）
- [ ] P3-5 更新权限管理界面（角色改为全局角色）
- [ ] P3-6 更新营销文案、帮助中心、FAQ

### Phase 4：上线与运维保障
- 灰度与回滚
  - [ ] P4-1 Preview 环境执行迁移 + 自动化测试
  - [ ] P4-2 发布前冻结写入，备份组织相关表
  - [ ] P4-3 生产执行迁移脚本，部署服务 & 前端
  - [ ] P4-4 若需回滚：恢复备份、重新部署旧版本
- 验收与监控
  - [ ] P4-5 回归测试：权限、Offer、Billing、Tasks、NPS、Webhook
  - [ ] P4-6 监控：关注 `Permission denied`、API 错误率、Web Vitals
  - [ ] P4-7 更新内部 SOP、客户文档、客户支持脚本

---

## 4. 验收标准

- 前端：路由无 `[organization]`，控制台/设置无组织概念；快捷入口、邀请功能正常。
- 后端：所有 API 默认使用固定 `organization_id`；数据库不存在多余组织数据；RLS policy 通过安全性测试。
- 运维：监控指标 (`console_web_vitals_total`、错误率) 正常；无持续性权限错误日志。
- 文档：更新产品说明、帮助中心条目、GitOps/SOP、飞书/Slack FAQ。

---

## 5. 回滚方案

1. 暂停变更后新增用户注册，防止数据继续写入新模型。
2. 恢复组织数据备份，将 `organization_membership` 还原。
3. 回滚前端路由/接口版本（使用上个部署标签）。
4. 恢复原 RLS/触发器，重新部署相关服务。

> 建议在切换窗口外保留 24h 观察期，再删除历史组织表数据备份。

---

## 6. 资源与沟通

- 负责人：后端 `@billing-team`，前端 `@console-frontend`，平台/运维 `@devops`
- 需要协作：产品、客户成功、法务（确认条款）、市场（更新外部资料）
- 通知渠道：工程例会、变更公示文档、客户成功同步会

---

## 7. 附录

- 现有组织 RPC：`create_new_organization`、`assign_user_to_organization`
- 受影响服务：console、offer、billing、adscenter、notifications
- 参考文档：`docs/FrontendOptimization/frontend-package-optimization-support.md`、`docs/SupabaseGo/MustKnowV6.md`
