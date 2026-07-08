# Package G - 实施路线图与回滚方案

> 更新时间：2025-10-10

## 1. 阶段性里程碑

| 阶段 | 时间 | 目标 | 关键交付 |
|------|------|------|----------|
| Phase G1 | Week 1 | UX 差距补齐 | 全局快捷键、表单热键提示、Live Announcer |
| Phase G2 | Week 1-2 | 性能与监控 | RUM 指标转发、Redis 缓存、Edge/Streaming 接口 |
| Phase G3 | Week 2 | 规范与发布流程 | 成功指标看板、NPS 反馈、回滚/灰度脚本 |

## 2. 依赖与风险

- **后端依赖**：Console 服务需部署最新镜像（包含 `TelemetryForwarder`、营销缓存、成功指标 API）。
- **Secrets 同步**：需在 Secret Manager 中配置 New Relic / Datadog / Logflare 相关 Key，并更新 Cloud Run `--update-secrets`。
- **权限要求**：NPS 与成功指标接口需要 Admin 权限，前端需确保会话 Token 仍有效。

## 3. 灰度发布与回滚

- **灰度策略**：
  1. 先部署 Console 服务 Job，验证 `/metrics`、`/public/monitoring/web-vitals` 指标是否正常。
  2. 通过 Feature Flag 控制前端 NPS 模块可见性（默认仅 admin）。
  3. 完成小流量验证后再开启全量。
- **回滚流程**：
  - 后端：保留上一版本镜像标签，`gcloud run deploy console --image=... --revision-suffix=rollback`。
  - 前端：使用 `NEXT_PUBLIC_ENABLE_PACKAGE_G=false` 隐藏新组件（已支持配置）。
  - Secrets：如需禁用 RUM，可撤销相关 Key 并重启服务。

## 4. 发布验证清单

- [ ] `go test ./services/console/internal/handlers` 通过
- [ ] `npx tsc --project apps/frontend/tsconfig.json` 无警告
- [ ] `/metrics` 出现 `console_web_vitals_total`、`console_success_metrics_requests_total`
- [ ] 前端 Dashboard/Manage 页面快捷键、Live Region、NPS 表单验收

> 路线图确保 Package G 改动可渐进式发布，并为后续性能监控、用户反馈闭环提供基础设施支撑。
