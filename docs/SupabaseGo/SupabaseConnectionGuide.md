# Supabase 数据库连接与基线初始化指南

更新时间：2025-10-07

## 连接方式

- **Session Pooler (IPv4)** — 推荐作为默认连接串：

  ```bash
  export SUPABASE_DB_URL="postgresql://postgres.jzzvizacfyipzdyiqfzb:<DB_PASSWORD>@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
  ```

  - `postgres.jzzvizacfyipzdyiqfzb` = `postgres.<项目Ref>`
  - `<DB_PASSWORD>` 可通过 `jq -r '.db_password' secrets/supabase-credentials.json` 获取
  - Supavisor Session Pooler 支持 IPv4，适合本地/CI 环境。

- **Transaction Pooler**（可选）: 将端口改为 `5432` 或附加 `?pgbouncer=true` 用于高并发短连接。
- **直接连接**: `db.<ref>.supabase.co:5432` 仅支持 IPv6，本地网络若无 IPv6 路由会超时，建议改用 Pooler。

## 基础表结构初始化

运行 Stage 1 脚本以创建核心业务表与 RLS 策略：

```bash
export SUPABASE_DB_URL="postgresql://postgres.jzzvizacfyipzdyiqfzb:<DB_PASSWORD>@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
psql "$SUPABASE_DB_URL" -f docs/SupabaseGo/SupabaseSchemaStage1.sql
```

脚本内容包括：

- `user_profiles` / `offers` / `tasks` / `ads_connections` / `token_wallets` / `token_transactions` / `dashboard_risk_alerts` 等表结构。
- 默认 RLS 策略（`auth.uid()` 绑定），以及更新时间戳触发器。
- `admin_impersonation_events` 维持无 RLS（由后台服务统一访问）。

> **注意**: 若 Supabase CLI 提示迁移历史不一致，可忽略（我们直接执行 SQL）。

## RLS 校验

使用新增的脚本快速验证：

```bash
export SUPABASE_DB_URL="postgresql://postgres.jzzvizacfyipzdyiqfzb:<DB_PASSWORD>@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
./scripts/db/rls-smoke-test.sh
```

- 默认检查用户态表（不含 `admin_impersonation_events`）。
- 如需扩展检查范围，设置 `TABLES="table_a table_b"` 自定义列表。
- 输出中的 ⚠ 表示启用了 `FORCE ROW LEVEL SECURITY`（预期行为）。

## 阶段性成果

- 2025-10-07：Stage1 SQL 已在远端数据库执行。
- `./scripts/db/rls-smoke-test.sh` 全部通过（用户数据表 RLS 已启用，策略生效）。
- 连接串、脚本留存于仓库，供后续 CI/迁移流程复用。

## 下一步建议

1. 基于新表结构补充 Seed 数据或迁移脚本（参考 `docs/SupabaseGo/DataMigrationPlan.md`）。
2. 编写 Supabase CLI/Makefile 任务，将 Stage1 初始化纳入自动化流水线。
3. 对 `token_wallets`、`token_transactions` 等表设计数据迁移/对账方案，确保与旧 Firebase 数据一致。

## CI / CD 环境变量与 Secrets 对照

为配合 Stage 5 的构建流水线，需要在 GitHub Actions 与 Cloud Build 中统一注入 Supabase 凭证。推荐的变量命名如下：

| 环境变量 | 用途 | 备注 |
| --- | --- | --- |
| `SUPABASE_PROJECT_URL` | REST/Auth API Base URL | 例如 `https://jzzvizacfyipzdyiqfzb.supabase.co` |
| `SUPABASE_PROJECT_REF` | Project Ref | `supabase db url` 中 `postgres.<ref>` 的 `<ref>` 部分 |
| `SUPABASE_ANON_KEY` | 公共客户端 Key | 用于前端/健康检查 |
| `SUPABASE_SERVICE_KEY` | Service Role Key | 供后台服务/脚本使用（受保护） |
| `SUPABASE_ACCESS_TOKEN` | Supabase 管理 API Token | 可通过 `supabase projects list` 获取 |
| `SUPABASE_DB_HOST` | PgBouncer Host | 如 `aws-1-ap-northeast-1.pooler.supabase.com` |
| `SUPABASE_DB_PORT` | PgBouncer Port | Session Pooler 默认 `6543` |
| `SUPABASE_DB_NAME` | 数据库名称 | 默认 `postgres`，也可使用逻辑库 |
| `SUPABASE_DB_USER` | 数据库用户 | `postgres.<ref>` |
| `SUPABASE_DB_PASSWORD` | 数据库密码 | Supabase Dashboard -> Project Settings -> Database |

- **GitHub Actions**：在仓库/组织 Secrets 中配置上述变量，即可触发 `.github/workflows/build-service-docker.yml` 的 Supabase 冒烟测试。
- **Cloud Build**：通过新增 substitutions `_SUPABASE_*` 字段并在 Cloud Build Trigger 中绑定 Secret Manager 条目，`deployments/cloudbuild/build-service-docker.yaml` 会自动调用 `scripts/test-supabase-connection.sh`。
- 当未配置上述变量时，冒烟脚本会自动跳过测试并输出提示；一旦配置完成，若任一 API/数据库连接失败会立即终止流水线。
