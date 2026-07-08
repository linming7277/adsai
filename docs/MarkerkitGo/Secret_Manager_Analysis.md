# Secret Manager 环境变量分析报告

**日期**: 2025-10-01
**项目**: gen-lang-client-0944935873 (Project Number: 644672509127)

## 发现的问题

### �� GOOGLE_ADS_* 配置来自其他 GCP 项目

发现以下 secrets 中的 OAuth 客户端 ID 不属于当前 GCP 项目：

| Secret Name | Value | 所属项目 | 状态 |
|------------|-------|---------|------|
| **GOOGLE_ADS_OAUTH_CLIENT_ID** | 1007142410985-hfisahctd27v9jqj0g17meprdh8i581r.apps.googleusercontent.com | **1007142410985** | ❌ 不是当前项目 |
| **GOOGLE_ADS_OAUTH_CLIENT_SECRET** | GOCSPX-uGHY4CJTswkeYneMRt-jwBx... | 配套上述 Client ID | ❌ 不是当前项目 |
| GOOGLE_ADS_DEVELOPER_TOKEN | lDeJ3piwcNBEhnWHL-s_... | N/A (可跨项目) | ℹ️  可继续使用 |
| GOOGLE_ADS_LOGIN_CUSTOMER_ID | 5010618892 | N/A (Ads账户) | ✅ 与 GCP 无关 |
| GOOGLE_ADS_TEST_CUSTOMER_ID | 1408550645 | N/A (Ads账户) | ✅ 与 GCP 无关 |

**当前项目信息**:
- Project ID: `gen-lang-client-0944935873`
- Project Number: `644672509127`

**OAuth 客户端所属项目**:
- Project Number: `1007142410985`
- 状态: 无法访问（可能是其他账号、已删除或无权限）

## 所有 Secret Manager 配置清单

### Firebase 配置 (✅ 正确)
```
NEXT_PUBLIC_FIREBASE_API_KEY          ✅ 当前项目
NEXT_PUBLIC_FIREBASE_APP_ID           ✅ 当前项目
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN      ✅ www.urlchecker.dev
NEXT_PUBLIC_FIREBASE_PROJECT_ID       ✅ gen-lang-client-0944935873
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET   ✅ 当前项目
```

### Google Ads API 配置 (⚠️ 混合)
```
GOOGLE_ADS_OAUTH_CLIENT_ID        ❌ 来自项目 1007142410985
GOOGLE_ADS_OAUTH_CLIENT_SECRET    ❌ 来自项目 1007142410985
GOOGLE_ADS_DEVELOPER_TOKEN        ℹ️  可跨项目使用
GOOGLE_ADS_LOGIN_CUSTOMER_ID      ✅ Ads 账户 ID
GOOGLE_ADS_TEST_CUSTOMER_ID       ✅ Ads 测试账户 ID
```

### Stripe 配置
```
STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET_PREVIEW
STRIPE_WEBHOOK_SECRET_PRODUCTION
```

### OAuth & Auth 配置
```
ADS_OAUTH_REDIRECT_URL
ADS_OAUTH_REDIRECT_URLS
AUTH_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
OAUTH_STATE_SECRET
```

### 数据库配置
```
DATABASE_URL
POSTGRES_PASSWORD
REDIS_URL
VALKEY_URL
```

### 其他配置
```
DOMAIN
INTERNAL_JWT_SECRET
INTERNAL_SERVICE_TOKEN
NEXT_PUBLIC_DOMAIN
Proxy_URL_US
REFRESH_TOKEN_ENC_KEY_B64
SIMILARWEB_BASE_URL (公共 API，无需密钥)
SUPER_ADMIN_EMAIL
admin-policy
```

## 影响分析

### 1. Google Ads OAuth 功能

**当前状态**:
- 使用的 OAuth 客户端 ID 来自项目 `1007142410985`
- 如果该项目已删除或不可访问，OAuth 流程可能失败

**潜在问题**:
- ❌ 无法在当前项目的 Google Cloud Console 中管理这个 OAuth 客户端
- ❌ 无法修改 redirect URIs 或其他配置
- ❌ 如果原项目被删除，功能将完全失效
- ⚠️  安全风险：依赖外部项目的凭据

### 2. Firebase Authentication OAuth

**当前状态**: ✅ 正常
- Firebase Authentication 使用的是当前项目的配置
- 与 Google Ads OAuth 是两个独立的系统

### 3. Google Ads API 调用

**当前状态**: ⚠️  部分依赖外部项目
- Developer Token: 可继续使用（跨项目有效）
- Customer IDs: 正常（与 GCP 项目无关）
- OAuth 凭据: 依赖项目 1007142410985

## 建议措施

### 选项 1: 迁移到当前项目 (推荐) ✅

**步骤**:

1. **在当前项目中创建新的 OAuth 客户端**
   ```bash
   # 访问 Google Cloud Console
   https://console.cloud.google.com/apis/credentials?project=gen-lang-client-0944935873

   # 创建 OAuth 2.0 客户端 ID
   # 类型: Web application
   # 名称: Google Ads OAuth Client
   ```

2. **配置 Authorized redirect URIs**
   ```
   # 根据应用需要添加，例如:
   https://www.urlchecker.dev/api/auth/callback/google-ads
   https://www.autoads.dev/api/auth/callback/google-ads
   http://localhost:3000/api/auth/callback/google-ads  # 开发环境
   ```

3. **更新 Secret Manager**
   ```bash
   # 获取新的客户端 ID 和 Secret
   NEW_CLIENT_ID="644672509127-xxxxx.apps.googleusercontent.com"
   NEW_CLIENT_SECRET="GOCSPX-xxxxx"

   # 更新 secrets
   echo -n "$NEW_CLIENT_ID" | gcloud secrets versions add GOOGLE_ADS_OAUTH_CLIENT_ID \
     --data-file=- --project=gen-lang-client-0944935873

   echo -n "$NEW_CLIENT_SECRET" | gcloud secrets versions add GOOGLE_ADS_OAUTH_CLIENT_SECRET \
     --data-file=- --project=gen-lang-client-0944935873
   ```

4. **重新部署服务**
   ```bash
   git commit -m "chore: update Google Ads OAuth to current GCP project"
   git push origin main
   ```

### 选项 2: 继续使用外部项目凭据 (不推荐) ⚠️

**前提条件**:
- 确认项目 1007142410985 仍然存在且可访问
- 获得该项目的管理权限
- 能够在该项目中修改 OAuth 配置

**风险**:
- 依赖外部资源，不可��
- 无法在当前项目中统一管理
- 安全隐患

### 选项 3: 调查原项目关系

**步骤**:
1. 检查项目历史记录
2. 联系之前的开发人员
3. 确认是否有意使用外部项目
4. 评估迁移成本

## 检查清单

- [ ] 确认 Google Ads 功能是否正常工作
- [ ] 测试 Google Ads OAuth 登录流程
- [ ] 确定是否需要迁移到当前项目
- [ ] 如需迁移，创建新的 OAuth 客户端
- [ ] 更新 Secret Manager 配置
- [ ] 测试更新后的功能
- [ ] 删除旧的 secrets（如果不再需要）

## 其他 GOOGLE_* 相关配置检查

除了上述 GOOGLE_ADS_* 配置外，没有发现其他 GOOGLE_* 前缀的配置不属于当前项目。

## 总结

**不属于当前 GCP 项目的配置**:
1. ❌ `GOOGLE_ADS_OAUTH_CLIENT_ID` (来自项目 1007142410985)
2. ❌ `GOOGLE_ADS_OAUTH_CLIENT_SECRET` (配套上述 Client ID)

**建议**: 尽快迁移到当前项目 (gen-lang-client-0944935873) 以确保：
- ✅ 完全控制 OAuth 配置
- ✅ 统一的项目管理
- ✅ 更好的安全性
- ✅ 避免外部依赖风险

---

**生成时间**: 2025-10-01 21:42 UTC+8
**分析工具**: gcloud secrets list & analyze
