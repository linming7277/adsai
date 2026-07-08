# 集成测试快速参考

## 🚀 一键运行

```bash
./scripts/test-preview-env.sh
```

## 📋 前置条件

```bash
# 设置 GCP 项目
export GCP_PROJECT="your-gcp-project-id"

# 获取 Supabase 密码
export SUPABASE_PASSWORD=$(gcloud secrets versions access latest \
  --secret="supabase-db-password" \
  --project="${GCP_PROJECT}")
```

## 🎯 测试文件

| 服务 | 文件 |
|------|------|
| Billing | `services/billing/integration_preview_test.go` |
| Offer | `services/offer/integration_preview_test.go` |
| Siterank | `services/siterank/integration_preview_test.go` |

## 🌐 预发环境 URL

```bash
# Billing
https://billing-preview-asia-northeast1.a.run.app

# Offer
https://offer-preview-asia-northeast1.a.run.app

# Siterank
https://siterank-preview-asia-northeast1.a.run.app
```

## 🗄️ 数据库连接

```bash
# Supabase PostgreSQL (PgBouncer)
postgresql://postgres.jzzvizacfyipzdyiqfzb:${PASSWORD}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

## 🧪 运行特定测试

```bash
# Billing
go test -tags=integration -v ./services/billing/integration_preview_test.go

# Offer
go test -tags=integration -v ./services/offer/integration_preview_test.go

# Siterank
go test -tags=integration -v ./services/siterank/integration_preview_test.go
```

## 📊 测试覆盖

### Billing
- ✅ 健康检查
- ✅ 数据库连接
- ✅ 用户操作
- ✅ 订阅管理
- ✅ Token 操作
- ✅ 端到端流程

### Offer
- ✅ 健康检查
- ✅ Offer 操作
- ✅ KPI 管理
- ✅ 指标计算

### Siterank
- ✅ 健康检查
- ✅ 分析流程
- ✅ 评分计算
- ✅ 批量处理

## 🔍 故障排查

### 服务连接失败
```bash
# 检查服务状态
gcloud run services describe billing-preview \
  --region=asia-northeast1 \
  --project=your-gcp-project-id
```

### 数据库连接失败
```bash
# 验证密码
echo $SUPABASE_PASSWORD

# 测试连接
psql "postgresql://postgres.jzzvizacfyipzdyiqfzb:${SUPABASE_PASSWORD}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
```

## 📚 完整文档

- [预发环境集成测试指南](./PREVIEW-ENV-INTEGRATION-TESTING.md)
- [集成测试总结](./INTEGRATION-TESTING-SUMMARY.md)
- [完成报告](./PREVIEW-ENV-TESTING-COMPLETE.md)

## 💡 提示

1. **无需 Docker**: 直接测试预发环境
2. **自动清理**: 测试数据自动清理
3. **安全凭证**: 从 Secret Manager 获取
4. **真实环境**: 测试真实的服务和数据库

---

**快速开始**: `./scripts/test-preview-env.sh`
