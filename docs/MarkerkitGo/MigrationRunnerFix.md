# Cloud Build 迁移 Runner 修复记录

## 背景
- 目标：通过 Cloud Build + Cloud Run Job 执行 `schemas/sql/024-026` 迁移。
- 现状：Git 仓库中已有 `scripts/cloudbuild-migrate.yaml`，但原始 Dockerfile 采用 Go 迁移 Runner，且 `.gcloudignore` 导致 Cloud Build 上传 1.6GB 源代码，构建效率低。
- 问题：
  1. 迁移镜像改写为 Postgres 基础镜像后未携带 `scripts/run-migrations.sh`，Cloud Build Step #0 失败 (`COPY ... file does not exist`)。
  2. 迁移脚本解码 `DATABASE_URL` 时破坏了包含 `@` 的密码，Cloud Run Job 执行时报错 `could not translate host name "uX4@10.6.0.2"`。

## 修复措施
1. **轻量化源代码打包**
   - 新增 `.gcloud-submit.sh`，仅打包 3 个 SQL 文件 + `scripts/Dockerfile.migrate` + `scripts/run-migrations.sh` + `scripts/cloudbuild-migrate.yaml`。
   - 生成的 tarball 体积约 8KB，替代以往 1.6GB 的全仓库上传。

2. **补齐构建上下文**
   - 将 `scripts/run-migrations.sh` 加入 tarball，解决 Docker 构建阶段缺失脚本的问题。

3. **安全解析 DATABASE_URL**
   - `scripts/run-migrations.sh` 使用 Python `urllib.parse` 拆解 URI，分别导出 `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE`，再通过 `psql "host=... port=..."` 执行。
   - 彻底避免密码中 `@`、`%` 等特殊字符导致的连接失败。

4. **Dockerfile 优化**
   - 基于 `postgres:17-alpine`，仅安装 `python3`（解析 URI）。
   - 入口脚本统一放置在 `/run-migrations.sh`。

## 验证结果
- Cloud Build：`3f6ae6f0-84d4-463a-baeb-eb8c81673ffc`（2025-10-06 03:27 UTC）状态 `SUCCESS`。
- Cloud Run Job：`db-migrate-97zpm` 日志显示三份迁移脚本依次执行并输出 `🎉 All migrations completed successfully`。
- 迁移镜像发布：`gcr.io/gen-lang-client-0944935873/migrate-runner:latest`。

## 流水线集成
- `.github/workflows/deploy-backend.yml` 新增 `migrations_changed` 判定：当 `schemas/sql/`、`scripts/run-migrations.sh`、`scripts/Dockerfile.migrate`、`scripts/cloudbuild-migrate.yaml` 或 `.gcloud-submit.sh` 改动时自动触发。
- `db-migrate` Job 改为调用 `bash .gcloud-submit.sh migrate`，无需再构建旧的 golang-migrate 镜像。
- 如果本次提交未触及上述文件，Job 会快速跳过，同时保持依赖链（`deploy-services`）正常执行。

## 使用说明
```bash
# 激活服务账号（如尚未设置）
gcloud auth activate-service-account \
  codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com \
  --key-file=secrets/gcp_codex_dev.json

gcloud config set project gen-lang-client-0944935873

# 触发 Cloud Build + Cloud Run Job
bash .gcloud-submit.sh migrate
```

执行完成后，可通过以下命令查看最近一次执行日志：
```bash
gcloud run jobs executions list --job db-migrate --region asia-northeast1 --limit 1
gcloud beta run jobs executions logs read <execution-name> --region asia-northeast1
```

## 后续建议
- 将 `.gcloud-submit.sh` 集成进手动迁移 runbook，统一迁移触发方式。
- 为 `scripts/run-migrations.sh` 增加幂等校验（例如查询 `schema_migrations` 表）以便未来扩展。
- 评估是否需要为 `db-migrate` Job 绑定专用服务账号，而非默认的 Compute Engine SA。
