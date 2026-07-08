# Package G - 成功指标与观测方案

> 更新时间：2025-10-10

## 1. 指标定义

| 指标 | 计算方式 | 数据来源 |
|------|----------|----------|
| Activation Rate | `activatedUsers / usersTotal` | `offer_evaluations` 成功记录 + `User` 表 |
| Retention Rate | `returningUsers / activatedUsers`（近 60 天 ≥2 次评估） | `offer_evaluations` |
| Conversion Rate | `readyOffers / totalOffers` | `offers` 表 |
| Qualified Offers | `readyOffers` 绝对值 | `offers` 表 |

## 2. 技术实现

- **后端 API**：`GET /api/v1/console/metrics/success`
  - 使用 PG 聚合 + 5s 超时，结果缓存 120s。
  - Prometheus Counter：`console_success_metrics_requests_total{status=ok|error}`。
- **前端看板**：`<SuccessMetricsPanel />`
  - `useSuccessMetrics`（SWR, 120s refresh）获取数据。
  - KPI 卡片展示激活/留存/转化率，并支持手动刷新。
- **NPS 反馈**：`POST /api/v1/console/feedback/nps`
  - 前端 `NpsSurveyCard` 统一提交（含键盘操作、SR 提示）。

## 3. 监控与报警

- **Prometheus**：
  - 监控 `console_success_metrics_requests_total{status="error"}`，设定 5 分钟内 >3 次触发告警。
  - 结合 `console_web_vitals_total` 观察改动对页面性能影响。
- **前端提醒**：成功指标刷新失败触发 toast + LiveAnnouncer 提醒。
- **运维流程**：如长时间无数据，执行 `/api/v1/console/cache/marketing/invalidate` 与 `console` 服务回滚检查。

## 4. 数据使用建议

- **Activation Rate < 50%**：分析新手引导完成度，优先排查 Offer 录入流程与 Token 余额。
- **Retention Rate 下滑**：回看 60 天内评估成功率、批量任务失败率。
- **Conversion Rate < 20%**：联动 Offer 质量面板，检查 `ready_to_deploy` 判定条件。
- **NPS 低于 6 分**：自动创建任务分派给 CS 团队，结合评论内容制定改进计划。

> 本方案实现“指标→看板→反馈”闭环，配合 Package G 其他改动，可在 120 秒内掌握交付与满意度趋势。
