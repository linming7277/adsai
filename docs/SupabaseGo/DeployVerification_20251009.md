# 部署后验证流程（阶段三任务 10.6）

**日期**: 2025-10-09  
**执行人**: Codex 助手

---

## 实施内容

1. 新增脚本 `scripts/deploy/smoke-service.sh`：
   - 根据环境（preview/prod）解析 Cloud Run 服务 URL。
   - 依次请求 `/healthz`、`/readyz`、`/health` 等端点，验证服务是否可用。
   - 任何服务健康检查失败即退出并标记部署失败。

2. GitHub Actions `deploy-backend.yml` 增加 `service-smoke` Job：
   - 依赖 `deploy-services`，对本次变更涉及的每个服务执行烟雾测试。
   - 成功后才继续同步 API Gateway 等后续流程。

## 收益

- 部署完成即刻验证关键服务是否能对外提供健康响应。
- 失败时阻断后续步骤，提示人工排查或回滚，显著降低“部署成功但不可用”的风险。

---

**相关文件**
- `.github/workflows/deploy-backend.yml`
- `scripts/deploy/smoke-service.sh`

## 发布汇总

- 在 GitHub Actions 中新增 `deployment-summary` Job，向 Job Summary 输出环境、标签、服务列表，并上传 `deploy-summary.json`，方便追踪部署记录。
