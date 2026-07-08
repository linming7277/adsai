# Google Ads OAuth 客户端迁移指南

## 背景

当前使用的 OAuth 客户端凭据不属于项目 `gen-lang-client-0944935873`：
- 旧 Client ID: `1007142410985-hfisahctd27v9jqj0g17meprdh8i581r.apps.googleusercontent.com`
- 旧项目编号: `1007142410985`
- 当前项目编号: `644672509127`

需要在当前项目中创建新的 OAuth 2.0 客户端凭据。

## 操作步骤

### 步骤 1: 配置 OAuth 同意屏幕

访问链接：
```
https://console.cloud.google.com/apis/credentials/consent?project=gen-lang-client-0944935873
```

配置参数：
- **User Type**: External (外部)
- **App name**: AutoAds
- **User support email**: 您的邮箱地址
- **Developer contact email**: 您的邮箱地址
- **Scopes**:
  - `https://www.googleapis.com/auth/adwords` (Google Ads API)
  - `https://www.googleapis.com/auth/userinfo.email`
  - `https://www.googleapis.com/auth/userinfo.profile`

### 步骤 2: 创建 OAuth 2.0 客户端 ID

访问链接：
```
https://console.cloud.google.com/apis/credentials/oauthclient?project=gen-lang-client-0944935873
```

配置参数：

**1. Application type**: Web application

**2. Name**: Google Ads OAuth Client

**3. Authorized JavaScript origins**:
```
https://www.urlchecker.dev
https://www.autoads.dev
https://urlchecker.dev
https://autoads.dev
```

**4. Authorized redirect URIs**:
```
https://www.urlchecker.dev/api/v1/adscenter/oauth/callback
https://www.autoads.dev/api/v1/adscenter/oauth/callback
https://urlchecker.dev/api/v1/adscenter/oauth/callback
https://autoads.dev/api/v1/adscenter/oauth/callback
```

可选（本地开发）：
```
http://localhost:3000/api/v1/adscenter/oauth/callback
```

### 步骤 3: 获取凭据

创建完成后，Google Cloud Console 会显示：
- **Client ID**: `644672509127-xxxxx.apps.googleusercontent.com`
- **Client Secret**: `GOCSPX-xxxxx`

请妥善保存这些信息。

### 步骤 4: 更新 Secret Manager

使用以下命令更新 Secret Manager 中的凭据：

```bash
# 更新 GOOGLE_ADS_OAUTH_CLIENT_ID
echo 'YOUR_NEW_CLIENT_ID' | gcloud secrets versions add GOOGLE_ADS_OAUTH_CLIENT_ID \
  --data-file=- \
  --project=gen-lang-client-0944935873

# 更新 GOOGLE_ADS_OAUTH_CLIENT_SECRET
echo 'YOUR_NEW_CLIENT_SECRET' | gcloud secrets versions add GOOGLE_ADS_OAUTH_CLIENT_SECRET \
  --data-file=- \
  --project=gen-lang-client-0944935873
```

**或者提供凭据给我，我来执行更新操作。**

### 步骤 5: 验证凭据

```bash
# 验证 Client ID 格式（应以 644672509127- 开头）
gcloud secrets versions access latest \
  --secret=GOOGLE_ADS_OAUTH_CLIENT_ID \
  --project=gen-lang-client-0944935873

# 验证 Client Secret 格式（应以 GOCSPX- 开头）
gcloud secrets versions access latest \
  --secret=GOOGLE_ADS_OAUTH_CLIENT_SECRET \
  --project=gen-lang-client-0944935873
```

### 步骤 6: 重新部署服务

```bash
# 提交变更
git add .
git commit -m "chore: migrate Google Ads OAuth to project gen-lang-client-0944935873"

# 推送到 preview 环境
git push origin main

# 推送到生产环境（确认测试通过后）
git push origin production
```

### 步骤 7: 测试 OAuth 流程

1. 访问预发环境：https://www.urlchecker.dev
2. 点击 Google Ads 连接按钮
3. 完成 OAuth 授权流程
4. 验证能否成功获取 Google Ads 数据

## 回滚方案

如果新凭据出现问题，可以回滚到旧版本：

```bash
# 列出历史版本
gcloud secrets versions list GOOGLE_ADS_OAUTH_CLIENT_ID --project=gen-lang-client-0944935873

# 启用旧版本（替换 VERSION_NUMBER）
gcloud secrets versions enable VERSION_NUMBER \
  --secret=GOOGLE_ADS_OAUTH_CLIENT_ID \
  --project=gen-lang-client-0944935873
```

## 注意事项

1. **旧凭据保留**：旧的 OAuth 客户端在迁移完成并验证无误前不要删除
2. **测试环境优先**：先在 preview 环境测试，确认无误后再部署到生产环境
3. **用户重新授权**：已授权的用户需要重新进行 OAuth 授权流程
4. **Refresh Token 失效**：旧的 Refresh Token 将失效，需要重新获取

## 完成状态

- [ ] 配置 OAuth 同意屏幕
- [ ] 创建 OAuth 2.0 客户端 ID
- [ ] 获取新的 Client ID 和 Client Secret
- [ ] 更新 Secret Manager
- [ ] 验证凭据格式正确
- [ ] 重新部署服务
- [ ] 测试 OAuth 授权流程
- [ ] 验证 API 调用正常

## 联系信息

如有问题，请参考：
- Google Ads API 文档: https://developers.google.com/google-ads/api/docs/oauth/overview
- GCP OAuth 文档: https://cloud.google.com/docs/authentication/end-user
