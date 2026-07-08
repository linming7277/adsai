# Google Ads OAuth 客户端迁移验证报告

## 迁移概况

**迁移时间**: 2025-10-01
**项目**: gen-lang-client-0944935873
**状态**: ✅ 已完成

## 迁移详情

### 旧配置
- Client ID: `1007142410985-xxxxx.apps.googleusercontent.com`
- 归属项目: `1007142410985` (非当前项目)
- Client Secret: `GOCSPX-xxxxx` (已废弃)

### 新配置
- Client ID: `644672509127-xxxxx.apps.googleusercontent.com`
- 归属项目: `644672509127` (gen-lang-client-0944935873) ✅
- Client Secret: `GOCSPX-xxxxx` (存储于 Secret Manager)

### Secret Manager 更新

```bash
# GOOGLE_ADS_OAUTH_CLIENT_ID
Created version [2] of the secret [GOOGLE_ADS_OAUTH_CLIENT_ID]

# GOOGLE_ADS_OAUTH_CLIENT_SECRET
Created version [2] of the secret [GOOGLE_ADS_OAUTH_CLIENT_SECRET]
```

### 验证结果

✅ Client ID 格式正确（以 644672509127- 开头）
✅ Client Secret 格式正确（以 GOCSPX- 开头）
✅ Secret Manager 更新成功
✅ 凭据归属项目匹配

## 授权重定向 URI 配置

以下 URI 已配置到新的 OAuth 客户端：

- `https://www.urlchecker.dev/api/v1/adscenter/oauth/callback`
- `https://www.autoads.dev/api/v1/adscenter/oauth/callback`
- `https://urlchecker.dev/api/v1/adscenter/oauth/callback`
- `https://autoads.dev/api/v1/adscenter/oauth/callback`

## 下一步行动

### 1. 更新本地配置文件

更新 `secrets/Google_Ads_API.md`：

```bash
# ⚠️ 注意：所有敏感凭据已迁移到 Secret Manager
# secrets/ 目录下的文件已删除，避免敏感信息泄露
# 使用以下命令从 Secret Manager 获取凭据：

gcloud secrets versions access latest --secret=GOOGLE_ADS_OAUTH_CLIENT_ID --project=gen-lang-client-0944935873
gcloud secrets versions access latest --secret=GOOGLE_ADS_OAUTH_CLIENT_SECRET --project=gen-lang-client-0944935873
```

### 2. 重新部署服务

由于 Secret Manager 已更新，Cloud Run 服务需要重启才能加载新凭据：

```bash
# Preview 环境
gcloud run services update browser-exec \
  --region=asia-northeast1 \
  --project=gen-lang-client-0944935873

# 或推送代码触发自动部署
git add .
git commit -m "chore: migrate Google Ads OAuth to project 644672509127"
git push origin main
```

### 3. 测试 OAuth 流程

- [ ] 访问 https://www.urlchecker.dev
- [ ] 清除浏览器缓存和 Cookie
- [ ] 点击 Google Ads 连接按钮
- [ ] 完成 OAuth 授权流程
- [ ] 验证能否成功获取 Google Ads 账户列表
- [ ] 测试 API 调用是否正常

### 4. 用户重新授权通知

⚠️ **重要**：由于 OAuth 客户端已更改，所有已授权用户的 Refresh Token 将失效，需要：

1. 通知用户重新进行 Google Ads 账户授权
2. 在应用中添加友好提示信息
3. 提供一键重新授权的按钮

### 5. 监控和验证

部署后监控以下指标：

```bash
# 查看服务日志
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=browser-exec AND textPayload=~'oauth'" \
  --limit=50 \
  --project=gen-lang-client-0944935873 \
  --format=json

# 检查错误日志
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" \
  --limit=20 \
  --project=gen-lang-client-0944935873
```

## 回滚方案

如需回滚到旧凭据：

```bash
# 启用 version 1
gcloud secrets versions enable 1 \
  --secret=GOOGLE_ADS_OAUTH_CLIENT_ID \
  --project=gen-lang-client-0944935873

gcloud secrets versions enable 1 \
  --secret=GOOGLE_ADS_OAUTH_CLIENT_SECRET \
  --project=gen-lang-client-0944935873

# 禁用 version 2
gcloud secrets versions disable 2 \
  --secret=GOOGLE_ADS_OAUTH_CLIENT_ID \
  --project=gen-lang-client-0944935873

gcloud secrets versions disable 2 \
  --secret=GOOGLE_ADS_OAUTH_CLIENT_SECRET \
  --project=gen-lang-client-0944935873
```

## 总结

✅ OAuth 客户端已成功迁移到当前 GCP 项目
✅ Secret Manager 凭据已更新
✅ 所有配置符合项目归属要求
⏭️ 待部署和测试验证
