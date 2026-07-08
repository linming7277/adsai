# 环境变量与 Secret Manager 管理方案

> 最后更新：2025-10-09
> 适用范围：AdsAI Monorepo（前端 + 所有 Go 服务 + 运维脚本）

---

## 目标

1. **精简配置**：只保留业务运行必须的环境变量，其余使用代码默认值或配置文件解决。
2. **单一真源**：所有敏感变量统一存放在 Google Cloud Secret Manager 中，禁止在仓库或 CI 配置明文存储。
3. **构建可复现**：镜像构建阶段通过 Secret Manager 提供必要的公开配置，部署阶段再挂载敏感凭据。

---

## 1. 环境变量清单

清单文件：`configs/environment/variables.json`
结构：

```json
{
  "name": "DATABASE_URL",
  "secret": "DATABASE_URL",
  "description": "Primary PostgreSQL connection string …",
  "required": true,
  "scopes": ["global"],
  "used_by": ["billing", "notifications", "siterank", "adscenter"]
}
```

- **name**：代码中 `os.Getenv`/`process.env` 读取的变量名。
- **secret**：Secret Manager 中的名称。
- **scopes**：适用环境（`global / preview / production / ops`）。
- **used_by**：便于追踪依赖服务。

> 维护规则：新增环境变量时必须先更新该清单，再在 Secret Manager 中创建对应 secret。

### 1.1 预发 / 生产环境差异

常用变量在不同环境的归属如下（更多条目请查阅清单文件）：

| 变量名 | Secret 名称 | 预发值示例 | 生产值示例 | 备注 |
|--------|-------------|------------|------------|------|
| `ADS_OAUTH_REDIRECT_URLS` | `ADS_OAUTH_REDIRECT_URLS` | `https://preview.example.com/dashboard/adscenter/callback` | `https://www.example.com/dashboard/adscenter/callback` | 多个 URL 可用逗号或换行分隔 |
| `ADS_OAUTH_REDIRECT_URL` | `ADS_OAUTH_REDIRECT_URL` | （可选）`https://preview.example.com/dashboard/adscenter/callback` | （可选）`https://www.example.com/dashboard/adscenter/callback` | 兼容旧字段，推荐配置 `ADS_OAUTH_REDIRECT_URLS` |
| `AUTH_URL` | `AUTH_URL` | `https://preview.example.com` | `https://www.example.com` | Supabase / NextAuth 登录回调基础地址 |
| `DATABASE_URL` | `DATABASE_URL` | `postgresql://postgres:***@10.6.0.2:5432/adsai_dev` | `postgresql://postgres:***@10.6.0.2:5432/adsai_db` | 内部私网 Postgres 连接串 |
| `DOMAIN` | `DOMAIN` | `preview.example.com` | `example.com` | 客户端展示用主域名 |
| `GEMINI_API_KEY` | `GEMINI_API_KEY` | `AIzaSy***` (示例，不再使用) | `AIzaSy***` (示例，不再使用) | 预发/生产可共用 |
| `GOOGLE_ADS_*` | 同名 | `ABCD-1234-TEST` 等 | `EFGH-5678-LIVE` 等 | 包括 Developer Token、Login Customer、OAuth Client ID/Secret、Test Customer |
| `INTERNAL_JWT_SECRET` | 同名 | `base64-512-bit-secret` | `base64-512-bit-secret` | 内部 JWT 签名 |
| `INTERNAL_SERVICE_TOKEN` | 同名 | `preview-internal-token` | `prod-internal-token` | 微服务间 Bearer Token |
| `NEXTAUTH_SECRET` | `NEXTAUTH_SECRET` | `Qu44kMxa...` | `Qu44kMxa...` | 建议预发/生产各自生成 |
| `NEXTAUTH_URL` | `NEXTAUTH_URL` | `https://preview.example.com` | `https://www.example.com` | NextAuth callback 绝对 URL |
| `NEXT_PUBLIC_API_BASE_URL` | `NEXT_PUBLIC_API_BASE_URL` | `https://adsai-gw-preview-885pd7lz.an.gateway.dev/api/v1` | `https://adsai-gw-885pd7lz.an.gateway.dev/api/v1` | Cloud Build `substitutions` 切换 |
| `NEXT_PUBLIC_DOMAIN` | `NEXT_PUBLIC_DOMAIN` | `preview.example.com` | `example.com` | 旧脚本/容器仍依赖，可与 `DOMAIN` 搭配 |
| `NEXT_PUBLIC_SITE_URL` | `NEXT_PUBLIC_SITE_URL` | `https://preview.example.com` | `https://www.example.com` | 构建阶段通过 build arg 注入 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同名 | `eyJhbGciOiJI...` | `eyJhbGciOiJI...` | Supabase anon key |
| `NEXT_PUBLIC_SUPABASE_URL` | 同名 | `https://jzzvizacfyipzdyiqfzb.supabase.co` | `https://jzzvizacfyipzdyiqfzb.supabase.co` | Supabase 项目 URL |
| `OAUTH_STATE_SECRET` | 同名 | `base64-hmac-secret` | `base64-hmac-secret` | AdsCenter OAuth state HMAC 密钥 |
| `PROXY_URLS` | 同名 | `https://proxy-preview.example.com` | `https://proxy-prod.example.com` | JSON/逗号分隔代理列表 |
| `Proxy_URL_US` | `Proxy_URL_US` | `https://api.iprocket.io/...` | `https://api.iprocket.io/...` | 兼容旧代理配置（可选） |
| `READ_REPLICA_URL` | 同名 | `postgresql://...` | `postgresql://...` | 读副本连接串，若无副本可留空 |
| `REDIS_URL` | 同名 | `redis://10.25.251.131:6379/0` | `redis://10.25.251.131:6379/0` | Memorystore 私网地址 |
| `REFRESH_TOKEN_ENC_KEY_B64` | 同名 | `base64(32B)` | `base64(32B)` | AdsCenter refresh token 加密密钥 |
| `SIMILARWEB_BASE_URL` | 同名 | `https://data.similarweb.com/api/v1/data` | `https://data.similarweb.com/api/v1/data` | 公共 API，可按需要改为内部代理 |
| `STRIPE_PUBLISHABLE_KEY` | 同名 | `pk_test_***` | `pk_live_***` | 前端使用 |
| `STRIPE_SECRET_KEY` | 同名 | `sk_test_***` | `sk_live_***` | 后端使用 |
| `STRIPE_WEBHOOK_SECRET_PREVIEW` | 同名 | `whsec_test_***` | `whsec_test_***` | 预发 Webhook |
| `STRIPE_WEBHOOK_SECRET_PRODUCTION` | 同名 | `whsec_live_***` | `whsec_live_***` | 生产 Webhook |
| `SUPER_ADMIN_EMAIL` | 同名 | `admin-preview@adsai.dev` | `admin@adsai.dev` | 控制台最高权限账号（可选） |
| `SUPABASE_ACCESS_TOKEN` | 同名 | `sb-access-test-token` | `sb-access-prod-token` | Supabase Management API（可选） |
| `SUPABASE_SERVICE_KEY` | 同名 | `service-role-key` | `service-role-key` | 后端 / 迁移使用 |
| `VALKEY_URL` | 同名 | `redis://10.25.251.132:6379/0` | `redis://10.25.251.132:6379/0` | 若未启用 Valkey 可留空 |
| `ADMIN_POLICY_SECRET` | `ADMIN_POLICY` | `projects/.../secrets/admin-policy/versions/latest` | `projects/.../secrets/admin-policy/versions/latest` | 控制台策略 JSON，`{}` 表示关闭 |

> 提醒：若 Secret 需要区分环境，可通过不同版本或命名空间（例如 `PREVIEW__*` 与 `PROD__*`）管理，并在清单中新增条目。

---

## 2. 审计与导出工具

- `python scripts/env/audit_secrets.py --project <PROJECT_ID>`
  - 校验清单中所有 secret 是否存在。
  - 若缺失会列出变量名及用途。

- `scripts/env/export-secrets.sh <PROJECT_ID> <OUTPUT_FILE>`
  - 导出最新版本的 secret 为 `.env` 格式，供本地调试或 CI 临时使用。
  - 示例：`scripts/env/export-secrets.sh your-gcp-project-id .env.preview.generated`

建议在 CI 中新增“配置审计”步骤：

```yaml
- name: Audit secrets
  run: python scripts/env/audit_secrets.py --project your-gcp-project-id --warn-extra
```

---

## 3. Secret Manager 操作规范

1. 使用 `service-account@your-gcp-project-id.iam.gserviceaccount.com` 服务账号管理 Secret。
2. 新建/更新：
   ```bash
   echo -n "value" | gcloud secrets create SECRET_NAME \
     --project=your-gcp-project-id \
     --replication-policy=automatic \
     --data-file=-
   ```
   或新增版本：
   ```bash
   echo -n "value" | gcloud secrets versions add SECRET_NAME \
     --project=your-gcp-project-id \
     --data-file=-
   ```
3. 不再使用的变量：请先从代码/清单移除，再执行 `gcloud secrets delete SECRET_NAME`。
4. 任何回滚操作务必保留旧版本 (`gcloud secrets versions list`) 以便恢复。

---

## 4. 镜像构建阶段

- 构建阶段仅需要公开配置（`NEXT_PUBLIC_*`、API 网关地址等）；敏感凭据不写入镜像。
- Cloud Build 模板 `deployments/cloudbuild/build-frontend-supabase.yaml` 通过 `availableSecrets` 挂载 Supabase/Stripe 配置并以 `--build-arg` 传给 Docker，构建完成后环境变量不会保留在层中。
- Go 服务镜像构建不依赖任何敏感变量，编译后在运行时再读取 Secret。

如需本地构建带有公开变量的镜像：

```bash
export PROJECT_ID=your-gcp-project-id
VALUE=$(gcloud secrets versions access latest --secret NEXT_PUBLIC_API_BASE_URL --project "$PROJECT_ID")
docker build --build-arg NEXT_PUBLIC_API_BASE_URL="$VALUE" -t adsai/frontend -f apps/frontend/Dockerfile .
```

---

## 5. 部署阶段

推荐流程（Cloud Run）：

```bash
PROJECT_ID=your-gcp-project-id
REGION=asia-northeast1

gcloud run services update billing \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --update-secrets=\
DATABASE_URL=projects/$PROJECT_ID/secrets/DATABASE_URL/versions/latest,\
REDIS_URL=projects/$PROJECT_ID/secrets/REDIS_URL/versions/latest,\
INTERNAL_SERVICE_TOKEN=projects/$PROJECT_ID/secrets/INTERNAL_SERVICE_TOKEN/versions/latest
```

如需自动化，可复用 `deployments/scripts/secret-env-sync.sh` 或结合新的清单生成 `SECRETS` 参数。

> 快捷方式：`scripts/env/update-run-service.sh <project> <region> <service>` 会自动生成并执行 `gcloud run services update ... --update-secrets=...`。

---

## 6. 本地开发建议

1. 首次启动时：
   ```bash
   scripts/env/export-secrets.sh your-gcp-project-id .env.generated
   cp .env.generated .env.local
   ```
2. 不要在仓库提交 `.env.local`；只将调试需要的差异写入 `.env.local`，其余依赖 Secret 导出的模板。
3. 定期运行 `python scripts/env/audit_secrets.py --project your-gcp-project-id --warn-extra` 确认 secret 未缺失。

---

## 7. 常见问题 & FAQ

| 问题 | 解决方案 |
|------|----------|
| Secret Manager 缺少某变量 | 更新 `configs/environment/variables.json`，创建 Secret，并在审计脚本无告警后再使用。 |
| 构建阶段需要额外变量 | 将变量标记为非敏感 (`NEXT_PUBLIC_*`)，或在 Cloud Build 中通过 `availableSecrets` 挂载。 |
| 需要临时查看 secret | 使用 `gcloud secrets versions access latest --secret SECRET_NAME --project PROJECT_ID`，操作完成后删除输出文件。 |
| 发现冗余变量 | 更新清单并清理 Secret 与代码引用，确保上述脚本无告警。 |

---

## 8. 后续工作

- 引入 CI 检查：确保 PR 中新增的 `os.Getenv` 必须同步清单，否则阻塞合并。
- 将 `configs/environment/variables.json` 与 Terraform/Infra 代码联动，进一步自动化 Secret 管理。
- 在运行服务中引入缓存或配置热更新，减少频繁访问 Secret Manager 的成本。

---

如需帮助或审批新增变量，请联系平台工程小组。*** End Patch
