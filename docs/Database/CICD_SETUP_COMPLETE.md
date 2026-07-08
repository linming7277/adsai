# CI/CD数据库迁移配置完成

## 配置概览

已完成通过GitHub Actions执行数据库迁移的完整配置。

## 📁 创建的文件

### 1. GitHub Actions工作流
- `.github/workflows/database-migration.yml` - 主工作流配置

### 2. 执行脚本
- `scripts/db/trigger-cicd-migration.sh` - 交互式触发脚本

### 3. 文档
- `docs/Database/CI_CD_MIGRATION_GUIDE.md` - 完整使用指南
- `docs/Database/EXECUTE_MIGRATION_NOW.md` - 快速执行指南
- `docs/Database/CICD_SETUP_COMPLETE.md` - 本文档

## ✅ 配置要求

### GitHub Secrets

需要在GitHub仓库中配置：

| Secret名称 | 说明 | 获取方式 |
|-----------|------|---------|
| `GCP_SA_KEY` | GCP服务账号密钥 | GCP Console → IAM → Service Accounts |

### GCP Secret Manager

需要在GCP Secret Manager中配置：

| Secret名称 | 说明 | 格式示例 |
|-----------|------|---------|
| `DATABASE_URL` | 数据库连接URL | `postgresql://user:pass@/cloudsql/PROJECT:REGION:INSTANCE/dbname?sslmode=disable` |

### 服务账号权限

GCP服务账号需要以下权限：
- ✅ Cloud SQL Client
- ✅ Secret Manager Secret Accessor
- ✅ Cloud Run Admin（可选，用于更新服务配置）

## 🚀 执行方式

### 方式1: 交互式脚本（最简单）

```bash
./scripts/db/trigger-cicd-migration.sh
```

### 方式2: GitHub CLI

```bash
gh workflow run database-migration.yml \
  -f environment=preview \
  -f dry_run=false
```

### 方式3: GitHub网页界面

访问: https://github.com/xxrenzhe/autoads/actions/workflows/database-migration.yml

## 📊 工作流程

```
1. validate-migrations (验证迁移文件)
   ↓
2. migrate-billing (创建billing + useractivity schema)
   ↓
3. migrate-adscenter (并行) | migrate-offer (并行)
   ↓
4. migrate-console (创建console相关表和视图)
   ↓
5. verify-all-schemas (验证所有schema)
   ↓
6. notify-completion (发送完成通知)
```

## 🔧 DATABASE_URL配置说明

### 格式

```
postgresql://[用户名]:[密码]@/cloudsql/[PROJECT_ID]:[REGION]:[INSTANCE]/[数据库名]?sslmode=disable
```

### 示例

```
postgresql://autoads_admin:your_password@/cloudsql/gen-lang-client-0944935873:asia-northeast1:autoads/autoads_db?sslmode=disable
```

### 工作流中的处理

GitHub Actions工作流会自动：
1. 从GCP Secret Manager读取`DATABASE_URL`
2. 启动Cloud SQL Proxy在本地端口5432
3. 将Unix Socket路径替换为`localhost:5432`
4. 使用转换后的URL执行迁移

转换示例：
```bash
# 原始URL（Unix Socket）
postgresql://user:pass@/cloudsql/project:region:instance/db

# 转换后URL（TCP）
postgresql://user:pass@localhost:5432/db
```

## 📋 执行前检查清单

### 必须完成

- [ ] GitHub Secret `GCP_SA_KEY` 已配置
- [ ] GCP Secret `DATABASE_URL` 已配置
- [ ] 服务账号权限已配置
- [ ] 迁移文件已验证通过
- [ ] 代码已更新完成

### 推荐完成

- [ ] 在preview环境先测试
- [ ] 创建数据库备份（生产环境）
- [ ] 准备回滚计划
- [ ] 通知相关团队

## 🎯 预期结果

执行成功后，数据库应该有：

| Schema | 表数量 | 说明 |
|--------|--------|------|
| billing | 6 | 用户、订阅、代币、试用订阅 |
| useractivity | 6 | 签到、推荐、通知、状态 |
| offers | 5 | Offer管理和性能 |
| siterank | 5 | 网站评估和缓存 |
| adscenter | 6 | Google Ads集成 |
| system | 2 | 系统元数据 |
| public | 10+ | Console相关表 |
| **总计** | **40+** | |

## 📝 验证命令

### 检查GitHub Actions状态

```bash
# 列出最近的运行
gh run list --workflow=database-migration.yml

# 查看最新运行的日志
gh run view --log

# 实时监控
gh run watch
```

### 验证数据库

```bash
# 启动Cloud SQL Proxy
./cloud_sql_proxy -instances=PROJECT_ID:REGION:INSTANCE=tcp:5432 &

# 连接数据库
psql "postgresql://user:pass@localhost:5432/dbname"

# 查看所有schemas
\dn+

# 查看表数量
SELECT schemaname, COUNT(*) 
FROM pg_tables 
WHERE schemaname IN ('billing', 'useractivity', 'offers', 'siterank', 'adscenter', 'system')
GROUP BY schemaname;
```

## 🔄 迁移顺序说明

### 为什么这样设计？

1. **Billing先行**
   - 创建`billing.users`表
   - 其他服务的外键依赖此表

2. **Adscenter和Offer并行**
   - 都依赖`billing.users`
   - 彼此独立，可并行执行
   - 节省时间

3. **Console最后**
   - 创建跨服务视图
   - 依赖其他服务的表

### 依赖关系图

```
billing.users
    ↓
    ├─→ adscenter.user_ads_connections
    ├─→ offers.offers
    │   └─→ siterank.analyses
    └─→ useractivity.checkins
        └─→ console views
```

## 🛠️ 故障排查

### 常见问题

**Q: DATABASE_URL格式错误**
```
ERROR: invalid connection string
```
A: 检查DATABASE_URL格式，确保包含所有必需部分

**Q: Secret不存在**
```
ERROR: Secret [DATABASE_URL] not found
```
A: 在GCP Secret Manager中创建DATABASE_URL secret

**Q: 权限不足**
```
ERROR: permission denied
```
A: 检查服务账号是否有Secret Manager Secret Accessor权限

## 📞 获取帮助

如果遇到问题：

1. 查看[完整指南](./CI_CD_MIGRATION_GUIDE.md)
2. 查看[快速执行指南](./EXECUTE_MIGRATION_NOW.md)
3. 检查GitHub Actions日志
4. 查看Cloud SQL日志
5. 联系DevOps团队

## 🎉 下一步

配置完成后：

1. ✅ 运行验证测试
   ```bash
   ./scripts/db/verify-migration-files.sh
   ./scripts/db/find-table-references.sh
   ```

2. ✅ 在preview环境执行
   ```bash
   ./scripts/db/trigger-cicd-migration.sh
   # 选择: 1) preview
   # 选择: 1) 实际执行
   ```

3. ✅ 验证结果
   - 检查GitHub Actions状态
   - 验证数据库schema
   - 测试服务连接

4. ✅ 在production环境执行
   - 创建备份
   - 执行迁移
   - 监控服务

---

**配置完成时间**: 2025-10-21  
**配置状态**: ✅ 完成  
**DATABASE_URL**: ✅ 已配置使用
