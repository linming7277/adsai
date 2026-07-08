# 数据库治理快速使用指南
## MustKnowV7统一数据库治理实践

**适用服务**: 所有Go微服务 (useractivity, adscenter, billing, offer等)
**更新时间**: 2025-01-19

---

## 🎯 核心原则

### ✅ **必须遵守**
1. **禁用运行时DDL** - 服务代码中禁止任何`CREATE TABLE`语句
2. **使用YAML迁移** - 所有schema变更必须通过`migrations/{service}/`目录的YAML文件
3. **通过db-admin执行** - 使用`scripts/db/apply-migration.sh`工具应用迁移
4. **配置DB_CONNECTION_MODE** - 所有服务必须配置`DB_CONNECTION_MODE=dbadmin`

### ❌ **禁止行为**
- 在服务代码中直接执行DDL
- 绕过db-admin直接修改数据库
- 使用硬编码的数据库schema
- 忽略迁移文件的验证步骤

---

## 🛠️ 工具使用指南

### 1. 验证db-admin连接
```bash
# 检查preview环境db-admin状态
scripts/db/verify-db-admin.sh --env preview

# 检查production环境db-admin状态
scripts/db/verify-db-admin.sh --env production
```

### 2. 应用数据库迁移
```bash
# 查看可用迁移
ls migrations/useractivity/*.yaml

# 预览迁移（dry-run模式）
scripts/db/apply-migration.sh --service useractivity --env preview --version 003_new_feature --dry-run

# 应用单个迁移
scripts/db/apply-migration.sh --service useractivity --env preview --version 003_new_feature

# 应用所有待处理迁移
scripts/db/apply-migration.sh --service useractivity --env preview --all
```

### 3. 验证服务配置
```bash
# 检查所有服务的数据库配置
scripts/db/verify-db-config.sh --env preview

# 检查生产环境配置
scripts/db/verify-db-config.sh --env production
```

### 4. 运行功能测试
```bash
# 运行useractivity服务smoke测试
scripts/db/smoke-test-useractivity.sh --env preview
```

---

## 📝 创建新迁移文件

### 步骤1: 创建YAML文件
```bash
# 在正确的服务目录下创建新迁移
touch migrations/your_service/003_new_feature.yaml
```

### 步骤2: 编写迁移内容
```yaml
version: "003"
service: "your_service"
description: "添加新功能相关表"
author: "your-name"
created_at: "2025-01-20T10:00:00Z"
risk_level: "low"
dependencies:
  - "002"

changes:
  - type: "CREATE_TABLE"
    name: "new_table"
    if_not_exists: true
    columns:
      - { name: id, type: bigserial, primary_key: true }
      - { name: user_id, type: text, nullable: false }
      - { name: data, type: jsonb, default: "'{}'::jsonb" }
      - { name: created_at, type: timestamptz, default: now(), nullable: false }
    description: "新功能表"

  - type: "CREATE_INDEX"
    table: "new_table"
    name: "ix_new_table_user_id"
    columns: [user_id]
    description: "用户ID索引"

validation:
  - type: "table_exists"
    table: "new_table"
  - type: "index_exists"
    table: "new_table"
    index: "ix_new_table_user_id"
```

### 步骤3: 本地验证
```bash
# 验证YAML格式
python3 -m json.tool migrations/your_service/003_new_feature.yaml

# 预览迁移
scripts/db/apply-migration.sh --service your_service --env preview --version 003_new_feature --dry-run
```

---

## 🔍 服务配置检查清单

### 部署前检查
- [ ] `DB_CONNECTION_MODE` secret已创建
- [ ] 服务账户有secret访问权限
- [ ] 迁移文件格式正确
- [ ] 迁移文件路径正确
- [ ] 已通过dry-run验证

### 部署后验证
- [ ] 服务健康检查通过
- [ ] 服务日志无DDL错误
- [ ] 数据库连接正常
- [ ] API功能正常
- [ ] 运行smoke测试

---

## 🚨 故障排查

### 常见问题

#### 1. 迁移失败
```bash
# 检查db-admin连接
scripts/db/verify-db-admin.sh --env preview

# 检查迁移文件格式
python3 -m json.tool migrations/your_service/your_migration.yaml

# 查看详细错误日志
gcloud run services logs read db-admin-preview --region=asia-northeast1 --limit=20
```

#### 2. 服务启动失败
```bash
# 检查服务日志
gcloud run services logs read your-service-preview --region=asia-northeast1 --limit=50

# 检查表是否存在错误
grep -i "table.*not exist\|required tables missing" <日志输出>

# 验证迁移状态
scripts/db/apply-migration.sh --service your_service --env preview --all --dry-run
```

#### 3. 权限问题
```bash
# 检查secret权限
gcloud secrets get-iam-policy DB_CONNECTION_MODE --project=gen-lang-client-0944935873

# 添加权限
gcloud secrets add-iam-policy-binding DB_CONNECTION_MODE \
    --member="serviceAccount:your-service-account" \
    --role="roles/secretmanager.secretAccessor"
```

### 错误日志关键词
- `"table.*not exist"` - 表缺失，需要运行迁移
- `"required tables missing"` - 表验证失败，检查��移状态
- `"DDL.*failed"` - DDL执行失败（不应该出现）
- `"CREATE TABLE"` - 仍有运行时DDL（需要移除）

---

## 📊 服务状态参考

### 当前配置状态
| 服务 | DB_CONNECTION_MODE | 迁移文件 | 状态 |
|------|-------------------|----------|------|
| useractivity | ✅ dbadmin | ✅ 2个文件 | 🟢 正常 |
| billing | ✅ dbadmin | ✅ 4个文件 | 🟢 正常 |
| adscenter | ✅ dbadmin | ✅ 8个文件 | 🟢 正常 |
| offer | ✅ dbadmin | ✅ 2个文件 | 🟢 正常 |

### 服务URL参考
- **useractivity-preview**: https://useractivity-preview-yt54xvsg5q-an.a.run.app
- **billing-preview**: https://billing-preview-644672509127.asia-northeast1.run.app
- **adscenter-preview**: https://adscenter-preview-644672509127.asia-northeast1.run.app
- **offer-preview**: https://offer-preview-644672509127.asia-northeast1.run.app

---

## 🔄 标准工作流程

### 新功能开发
1. 创建YAML迁移文件
2. 本地dry-run验证
3. preview环境应用迁移
4. 运行smoke测试
5. 功能验证
6. production环境应用迁移

### 紧急修复
1. 使用dry-run验证变更
2. preview环境快速部署
3. 确认修复效果
4. production环境部署

### 定期维护
1. 运行配置验证检查
2. 确认所有服务正常
3. 检查日志健康状态
4. 更新文档

---

## 📚 参考文档

- [完整实施报告](USERACTIVITY_DB_FIX_COMPLETE_REPORT.md)
- [原始问题分析](USERACTIVITY_DB_FIX_REPORT.md)
- [MustKnowV7架构文档](../BasicPrinciples/MustKnowV7.md)
- [Monorepo构建最佳实践](../monorepo-build-best-practices.md)

---

**文档维护**: 如有更新需求，请同步更新此快速指南和相关文档。