# 立即执行数据库迁移

## 🚀 快速开始

### 方式1: 使用快速脚本（推荐）

```bash
# 运行交互式脚本
./scripts/db/trigger-cicd-migration.sh
```

脚本会引导你：
1. 选择环境（preview/production）
2. 选择模式（实际执行/Dry Run）
3. 确认执行
4. 自动触发GitHub Actions
5. 可选：查看实时日志

### 方式2: 使用GitHub CLI

```bash
# 安装GitHub CLI（如果未安装）
brew install gh

# 登录
gh auth login

# 触发迁移（preview环境）
gh workflow run database-migration.yml -f environment=preview -f dry_run=false

# 查看执行状态
gh run watch
```

### 方式3: 通过GitHub网页界面

1. 访问: https://github.com/linming7277/adsai/actions/workflows/database-migration.yml
2. 点击 "Run workflow" 按钮
3. 选择参数：
   - Environment: `preview` 或 `production`
   - Dry run: `false`（实际执行）或 `true`（只验证）
4. 点击 "Run workflow"

## 📋 执行前检查清单

### 必须完成的准备工作

- [ ] ✅ 所有迁移文件已验证通过
  ```bash
  ./scripts/db/verify-migration-files.sh
  ```

- [ ] ✅ 所有代码已更新完成
  ```bash
  ./scripts/db/find-table-references.sh
  ```

- [ ] ✅ GitHub Secrets已配置
  - GCP_SA_KEY

- [ ] ✅ GCP Secret Manager已配置
  - DATABASE_URL

- [ ] ✅ 服务账号权限已配置
  - Cloud SQL Client
  - Secret Manager Secret Accessor

- [ ] ✅ 已创建数据库备份（生产环境）
  ```bash
  gcloud sql backups create --instance=adsai
  ```

## 🔄 执行流程

### 阶段1: 验证（1-2分钟）
```
✓ 验证迁移文件格式
✓ 检查表引用问题
✓ 确保up/down文件配对
```

### 阶段2: 迁移（5-10分钟）
```
1. Billing服务 (billing + useractivity schema)
   ↓
2. Adscenter服务 (adscenter schema) ← 并行
   Offer服务 (offers + siterank schema) ← 并行
   ↓
3. Console服务 (public + system schema)
```

### 阶段3: 验证（1-2分钟）
```
✓ 列出所有schemas
✓ 列出所有tables
✓ 统计表数量
✓ 生成迁移报告
```

### 预期结果

执行成功后，数据库应该有：

| Schema | 表数量 | 说明 |
|--------|--------|------|
| billing | 6 | 用户、订阅、代币 |
| useractivity | 6 | 签到、推荐、通知 |
| offers | 5 | Offer管理 |
| siterank | 5 | 网站评估 |
| adscenter | 6 | Google Ads集成 |
| system | 2 | 系统元数据 |
| **总计** | **40** | |

## 📊 监控执行

### 实时查看日志

```bash
# 方式1: GitHub CLI
gh run watch

# 方式2: 查看最新运行
gh run view --log

# 方式3: 列出所有运行
gh run list --workflow=database-migration.yml
```

### 查看GitHub Actions页面

访问: https://github.com/linming7277/adsai/actions

## ✅ 验证成功

### 1. 检查GitHub Actions状态

所有jobs应该显示绿色✅：
- validate-migrations ✅
- migrate-billing ✅
- migrate-adscenter ✅
- migrate-offer ✅
- migrate-console ✅
- verify-all-schemas ✅
- notify-completion ✅

### 2. 下载迁移报告

在GitHub Actions页面下载 `migration-report` artifact

### 3. 验证数据库

```bash
# 连接数据库
./cloud_sql_proxy -instances=PROJECT_ID:REGION:INSTANCE=tcp:5432 &

# 查看所有schemas
psql -h localhost -U adsai_admin -d adsai_db -c "\dn+"

# 查看表数量
psql -h localhost -U adsai_admin -d adsai_db -c "
  SELECT schemaname, COUNT(*) 
  FROM pg_tables 
  WHERE schemaname IN ('billing', 'useractivity', 'offers', 'siterank', 'adscenter', 'system')
  GROUP BY schemaname;
"
```

预期输出：
```
 schemaname    | count 
---------------+-------
 billing       |     6
 useractivity  |     6
 offers        |     5
 siterank      |     5
 adscenter     |     6
 system        |     2
(6 rows)
```

### 4. 测试服务连接

```bash
# 测试各服务的健康检查
curl https://billing-preview-xxx.run.app/health
curl https://offer-preview-xxx.run.app/health
curl https://adscenter-preview-xxx.run.app/health
```

## 🔧 故障排查

### 如果迁移失败

1. **查看详细日志**
   ```bash
   gh run view --log
   ```

2. **检查失败的job**
   - 点击失败的job查看具体错误
   - 常见错误见 [CI_CD_MIGRATION_GUIDE.md](./CI_CD_MIGRATION_GUIDE.md#故障排查)

3. **回滚（如果需要）**
   ```bash
   # 手动触发回滚
   # 或使用down迁移
   ```

### 常见问题

**Q: 表已存在错误**
```
ERROR: relation "billing.users" already exists
```
A: 数据库可能已经执行过迁移，检查当前状态或先执行down迁移

**Q: 外键约束失败**
```
ERROR: foreign key constraint cannot be implemented
```
A: 确保迁移按正确顺序执行（billing → adscenter/offer → console）

**Q: 连接超时**
```
ERROR: could not connect to server
```
A: 检查Cloud SQL实例状态和网络配置

## 📞 获取帮助

如果遇到问题：

1. 查看完整文档: [CI_CD_MIGRATION_GUIDE.md](./CI_CD_MIGRATION_GUIDE.md)
2. 检查GitHub Actions日志
3. 查看Cloud SQL日志
4. 联系DevOps团队

## 🎯 下一步

迁移成功后：

1. ✅ 监控服务日志
2. ✅ 运行端到端测试
3. ✅ 检查性能指标
4. ✅ 更新文档状态

---

## 立即执行命令

```bash
# 最简单的方式 - 运行交互式脚本
./scripts/db/trigger-cicd-migration.sh

# 或者直接使用GitHub CLI
gh workflow run database-migration.yml -f environment=preview -f dry_run=false
gh run watch
```

**准备好了吗？开始执行吧！** 🚀
