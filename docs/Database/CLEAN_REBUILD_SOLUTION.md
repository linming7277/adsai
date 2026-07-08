# 数据库干净重建方案

**创建日期**: 2025-10-21
**适用场景**: 项目未上线，无历史数据需要保留

## 需求分析

### 实际需求
1. ✅ 根据迁移文件重建干净的数据库结构
2. ✅ 后续开发中的DDL/DML变更通过CI/CD执行

### 现有能力
- ✅ `database-migration-cloudrun.yml` - 已支持增量迁移
- ✅ `migrate.sh` - 执行 `migrate up` 命令
- ✅ Cloud Run Job - 通过Unix Socket访问内网数据库

### 缺少的功能
- ❌ 清空数据库并重建的能力

## 解决方案：添加重置模式

### 方案1：在现有工作流中添加重置选项（推荐）

修改 `database-migration-cloudrun.yml`，添加一个可选的重置步骤：

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: '目标环境'
        required: true
        type: choice
        options:
          - preview
          - production
      reset_database:
        description: '是否先清空数据库（危险操作）'
        required: false
        type: boolean
        default: false
```

### 方案2：创建独立的重置脚本

创建 `deployments/db-migrator/reset-and-migrate.sh`：

```bash
#!/bin/bash
# 清空数据库并重新执行所有迁移

set -euo pipefail

# 1. 删除所有自定义Schema
psql "$DATABASE_URL" << 'EOF'
DROP SCHEMA IF EXISTS billing CASCADE;
DROP SCHEMA IF EXISTS offers CASCADE;
DROP SCHEMA IF EXISTS adscenter CASCADE;
DROP SCHEMA IF EXISTS siterank CASCADE;
DROP SCHEMA IF EXISTS useractivity CASCADE;
DROP SCHEMA IF EXISTS console CASCADE;

-- 重置public schema
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;

-- 重置迁移记录
CREATE TABLE IF NOT EXISTS schema_migrations (
    version bigint NOT NULL PRIMARY KEY,
    dirty boolean NOT NULL
);
EOF

# 2. 执行所有迁移
for service in billing adscenter offer console; do
    echo "执行 $service 迁移..."
    migrate -path /migrations/$service -database "$DATABASE_URL" up
done
```

## 推荐实施方案

### 最简方案：手动重置 + 自动迁移

**步骤**：

1. **手动清空数据库**（仅在需要时）
   ```bash
   # 通过Cloud Run Job执行重置SQL
   gcloud run jobs execute db-reset-preview \
     --region=asia-northeast1 \
     --wait
   ```

2. **自动执行迁移**（已有功能）
   ```bash
   # 推送代码到main分支，自动触发迁移
   git push origin main
   ```

### 需要创建的文件

1. `deployments/db-migrator/reset.sql` - 重置SQL脚本
2. `deployments/db-migrator/reset.sh` - 重置执行脚本（简化版）
3. 更新 `Dockerfile.migrate` - 包含重置脚本

## 实施步骤

### 第一步：创建简化的重置脚本

只需要一个简单的SQL脚本即可：

```sql
-- reset.sql
DROP SCHEMA IF EXISTS billing CASCADE;
DROP SCHEMA IF EXISTS offers CASCADE;
DROP SCHEMA IF EXISTS adscenter CASCADE;
DROP SCHEMA IF EXISTS siterank CASCADE;
DROP SCHEMA IF EXISTS useractivity CASCADE;
DROP SCHEMA IF EXISTS console CASCADE;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;

CREATE TABLE schema_migrations (
    version bigint NOT NULL PRIMARY KEY,
    dirty boolean NOT NULL
);
```

### 第二步：创建重置执行脚本

```bash
#!/bin/bash
# reset.sh - 简化版
set -euo pipefail

echo "⚠️  清空数据库..."
psql "$DATABASE_URL" -f /scripts/reset.sql

echo "✅ 数据库已重置"
```

### 第三步：更新Dockerfile

```dockerfile
# 添加重置脚本
COPY deployments/db-migrator/reset.sql /scripts/reset.sql
COPY deployments/db-migrator/reset.sh /reset.sh
RUN chmod +x /reset.sh
```

### 第四步：使用方式

**场景1：开发过程中需要重建数据库**

```bash
# 1. 手动执行重置
gcloud run jobs create db-reset-preview \
  --region=asia-northeast1 \
  --image=asia-northeast1-docker.pkg.dev/.../db-migrator:latest \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest" \
  --set-cloudsql-instances=gen-lang-client-0944935873:asia-northeast1:autoads \
  --command="/reset.sh"

gcloud run jobs execute db-reset-preview --region=asia-northeast1 --wait

# 2. 触发自动迁移
git push origin main
```

**场景2：日常开发，只需要增量迁移**

```bash
# 直接推送代码，自动执行迁移
git push origin main
```

## 与现有工作流的集成

### 现有工作流保持不变
- `database-migration-cloudrun.yml` 继续处理增量迁移
- 自动触发：推送到main分支
- 手动触发：GitHub Actions UI

### 新增重置能力
- 手动创建并执行 `db-reset-preview` Job
- 仅在需要完全重建时使用
- 不影响日常开发流程

## 总结

### 核心改动
1. ✅ 创建 `reset.sql` - 20行SQL
2. ✅ 创建 `reset.sh` - 10行Bash
3. ✅ 更新 `Dockerfile.migrate` - 3行

### 使用场景
- **日常开发**: 无需改变，继续使用现有工作流
- **需要重建**: 手动执行reset job，然后触发迁移

### 优势
- ✅ 简单：只有30行代码
- ✅ 安全：手动执行，不会意外触发
- ✅ 灵活：不影响现有流程
- ✅ 实用：满足实际需求

---

**下一步**: 创建这3个文件并测试
