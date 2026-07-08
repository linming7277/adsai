# 环境变量优化方案

> 更新时间：2025-10-09  
> 适用范围：AutoAds Monorepo（前端 + 后端 + 运维）

---

## 1. 目标与原则

1. **精简必需项**：仅保留业务运行必需的环境变量，减少重复配置。
2. **双环境一致性**：所有变量同时覆盖预发（preview）与生产（production）两个环境，值可相同但必需可区分。
3. **Secret 真源**：统一通过 Google Cloud Secret Manager 管理敏感配置，禁止在仓库或 CI 中保留明文。
4. **构建可复现**：镜像构建阶段不依赖敏感变量；部署时再通过 Secret 注入。

---

## 2. 关键交付物

| 文件/脚本 | 说明 |
|-----------|------|
| `configs/environment/variables.json` | 环境变量清单（30 项），包含变量→Secret 映射、描述、作用域、依赖服务。 |
| `scripts/env/audit_secrets.py` | 审计脚本：检查 Secret Manager 是否存在清单中的所有变量。 |
| `scripts/env/export-secrets.sh` | 导出脚本：将 Secret Manager 的最新值导出为 `.env` 文件（临时使用）。 |
| `docs/operations/environment-management.md` | 管理手册：详细说明流程、预发/生产差异、构建/部署注入方法。 |
| `README.md`（更新） | 环境配置章节指向上述文档，指导开发者使用新流程。 |
| `scripts/update-supabase-secrets.sh`（废弃） | 旧脚本已被替换为提示信息，避免再从 `.env` 覆盖 Secret。 |

---

## 3. 全量变量清单

详见 `configs/environment/variables.json`；核心变量示例：

| 变量 | Secret | 适用环境 | 用途 |
|------|--------|----------|------|
| `DATABASE_URL` | 同名 | preview / production | Go 服务主库连接串 |
| `REDIS_URL` | 同名 | preview / production | 缓存/限流（Memorystore） |
| `VALKEY_URL` | 同名 | preview / production | Valkey 兼容地址（可选） |
| `AUTH_URL` | 同名 | preview / production | Supabase / NextAuth 登录回调基础 URL |
| `NEXTAUTH_SECRET` | 同名 | preview / production | NextAuth session 加密 secret |
| `NEXTAUTH_URL` | 同名 | preview / production | NextAuth callback 绝对 URL |
| `NEXT_PUBLIC_SITE_URL` | 同名 | preview / production | 前端站点地址（build arg） |
| `NEXT_PUBLIC_API_BASE_URL` | 同名 | preview / production | API Gateway base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | 同名 | preview / production | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同名 | preview / production | Supabase anon key |
| `SUPABASE_SERVICE_KEY` | 同名 | preview / production | Supabase service role key |
| `STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY` | 同名 | preview / production | Stripe 前端/后端密钥 |
| `STRIPE_WEBHOOK_SECRET_PREVIEW` / `STRIPE_WEBHOOK_SECRET_PRODUCTION` | 同名 | preview / production | Stripe webhook 签名 secret |
| `GOOGLE_ADS_*` | 同名 | preview / production | Google Ads API / OAuth 集成 |
| `INTERNAL_SERVICE_TOKEN` | 同名 | preview / production | 微服务间鉴权 token |
| `INTERNAL_JWT_SECRET` | 同名 | preview / production | 内部 JWT HMAC secret |
| `SIMILARWEB_BASE_URL` | 同名 | preview / production | Similarweb 公共 API（默认 https://data.similarweb.com/api/v1/data） |
| `GEMINI_API_KEY` | 同名 | preview / production | Gemini AI 接口 |
| `PROXY_URLS` | 同名 | preview / production | 爬虫代理地址 |
| `admin-policy` | 同名 | preview / production | 运维策略 JSON |

> 默认要求：每个变量在 Secret Manager 中分别维护预发与生产两个值（即使值相同，也需要区分版本或 Secret）。

---

## 4. Secret Manager 流程

1. **新建/更新**：
   ```bash
   echo -n "value" | gcloud secrets create SECRET_NAME \
     --project=gen-lang-client-0944935873 \
     --replication-policy=automatic \
     --data-file=-
   ```
   若已存在，可用 `gcloud secrets versions add` 添加新版本。

2. **审计**：
   ```bash
   python scripts/env/audit_secrets.py --project gen-lang-client-0944935873
   ```
   缺失的 Secret 会列在控制台，需补齐后再继续工作。

3. **本地导出（可选）**：
   ```bash
   scripts/env/export-secrets.sh gen-lang-client-0944935873 .env.preview.generated
   cp .env.preview.generated .env.local  # 仅供开发临时使用，禁止提交
   ```

4. **回滚**：使用 `gcloud secrets versions list/access/add` 操作旧版本，严禁从本地 `.env` 覆盖 Secret。

---

## 5. 构建与部署

### 5.1 镜像构建
- 仅通过 `--build-arg` 注入公开配置（如 `NEXT_PUBLIC_SITE_URL`）。
- Cloud Build 模板（示例：`deployments/cloudbuild/build-frontend-supabase.yaml`）使用 `availableSecrets` 提供必要参数，但敏感值不会写入镜像层。
- Go 服务镜像构建无需任何敏感变量。

### 5.2 部署注入
- Cloud Run 推荐命令：
  ```bash
  PROJECT_ID=gen-lang-client-0944935873
  REGION=asia-northeast1

  gcloud run services update billing \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --update-secrets=DATABASE_URL=projects/$PROJECT_ID/secrets/DATABASE_URL/versions/latest,\
REDIS_URL=projects/$PROJECT_ID/secrets/REDIS_URL/versions/latest,\
INTERNAL_SERVICE_TOKEN=projects/$PROJECT_ID/secrets/INTERNAL_SERVICE_TOKEN/versions/latest
  ```
- 可复用 `deployments/scripts/secret-env-sync.sh` 或根据 `variables.json` 自动生成参数列表。

---

## 6. 本地开发建议

1. 初次启动使用导出脚本生成 `.env.local`，仅需覆盖个别调试变量。
2. 任何敏感变量不得提交至仓库；`.env.local` 保持在 `.gitignore` 内。
3. 定期执行审计脚本，确保 Secret 完备。

---

## 7. 并行开发约束

- 除非得到明确授权，不触碰不在当前任务范围内且尚未提交的文件，尤其是其他分支正在开发的内容。
- 在执行恢复/删除操作前需先确认目标文件是否由当前任务管理，避免误删。

---

## 8. 后续工作

1. 将 `python scripts/env/audit_secrets.py --project …` 纳入 CI，阻止缺失 Secret 的改动合并。
2. 基于 `variables.json` 自动生成 Cloud Run `--update-secrets` 参数，进一步规范部署流程。
3. 若后续引入 Terraform/Infra as Code，可将清单与 IaC 绑定，做到“一处定义，自动同步”。

---

如需新增或调整变量，请先更新 `configs/environment/variables.json`，再在 Secret Manager 中创建对应条目，并遵循审计脚本通过的流程。任何疑问请联系平台工程小组。 
