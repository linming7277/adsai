# DATABASE_URL 修复解决方案

## 🎯 问题诊断

你遇到的问题：`DATABASE_URL`环境变量已存在，但**格式不符合Cloud SQL要求**。

### 🔍 当前问题分析

Cloud SQL要求的连接格式：
```bash
postgresql://USER:PASSWORD@/cloudsql:PROJECT:REGION/INSTANCE/DATABASE_NAME
```

你的现有`DATABASE_URL`可能格式不正确，常见问题包括：
- ❌ 使用了`localhost`或`127.0.0.1`直连
- ❌ 缺少`/cloudsql/`前缀
- ❌ 项目ID、区域、实例名、数据库名不匹配
- ❌ 使用了TCP连接而非Cloud SQL连接

## 🚀 快速解决方案

### 方法1：使用自动修复工具（推荐）

#### 步骤1：运��数据库URL修复工具
```bash
cd /path/to/adsai
go run tools/fix-database-url/main.go \
    your-gcp-project-id \
    us-central1 \
    your-cloudsql-instance \
    adsai_db
```

#### 步骤2：更新Secret Manager
工具会输出具体的`gcloud`命令，直接复制运行：

```bash
# 示例输出（请使用你实际的参数）
gcloud secrets versions add DATABASE_URL "postgresql://USER:PASSWORD@/cloudsql:your-gcp-project-id:us-central1/your-cloudsql-instance/adsai_db" --project="your-gcp-project-id"
```

#### 步骤3：重新部署服务
```bash
# Cloud Run部署（会自动注入新的环境变量）
gcloud run services update billing --region=us-central1
gcloud run services update console --region=us-central1
# ... 更新其他服务
```

### 方法2：手动修复

#### 步骤1：获取必要的参数
```bash
# 从Cloud Run服务配置或项目配置中获取：
PROJECT_ID="your-gcp-project-id"
REGION="us-central1"
INSTANCE_NAME="your-cloudsql-instance"
DATABASE_NAME="adsai_db"
```

#### 步骤2：更新Secret Manager
```bash
# 在Google Cloud Console或使用gcloud CLI
gcloud secrets versions add DATABASE_URL \
    "postgresql://USER:PASSWORD@/cloudsql:${PROJECT_ID}:${REGION}/${INSTANCE_NAME}/${DATABASE_NAME}" \
    --project="${PROJECT_ID}"
```

#### 步骤3：验证修复
```bash
# 检查新格式
gcloud secrets versions view DATABASE_URL --project="${PROJECT_ID}" --latest

# 本地测试（如果有权限）
export DATABASE_URL="postgresql://USER:PASSWORD@/cloudsql:${PROJECT_ID}:${REGION}/${INSTANCE_NAME}/${DATABASE_NAME}"
```

## 🔧 验证工具

### 创建验证脚本
```bash
# 文件：verify-cloud-sql-connection.sh
cat > verify-cloud-sql-connection.sh << 'EOF'
#!/bin/bash

echo "🔍 Verifying Cloud SQL connection..."
echo "DATABASE_URL: $DATABASE_URL"

# 检查URL格式
if [[ "$DATABASE_URL" == *"postgresql://"* ]] && [[ "$DATABASE_URL" == *"/cloudsql/"* ]]; then
    echo "✅ DATABASE_URL format is correct for Cloud SQL"
else
    echo "❌ DATABASE_URL format is incorrect for Cloud SQL"
    echo "Expected: postgresql://USER:PASSWORD@/cloudsql:PROJECT:REGION/INSTANCE/DATABASE_NAME"
fi

# 使用psql测试连接（如果安装了）
if command -v psql >/dev/null 2>&1; then
    echo "🧪 Testing with psql..."
    if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ Cloud SQL connection test successful"
    else
        echo "❌ Cloud SQL connection test failed"
    fi
fi
EOF

chmod +x verify-cloud-sql-connection.sh
./verify-cloud-sql-connection.sh
```

## 🎯 实际修复示例

### 示例场景：从本地PostgreSQL迁移到Cloud SQL

**当前URL**（错误格式）：
```bash
postgresql://postgres:password@localhost:5432/adsai_db
```

**修复后的URL**（正确格式）：
```bash
postgresql://USER:PASSWORD@/cloudsql:my-project:us-central1:my-instance/adsai_db
```

## 📋 最佳实践

### 1. 环境变量管理
- ✅ 使用Secret Manager管理敏感配置
- ✅ 不要在代码中硬编码数据库URL
- ✅ 为不同环境（dev/staging/prod）使用不同的Secret版本

### 2. 连接池配置
- ✅ FinalAdapter自动配置优化的连接池参数
- ✅ 支持环境感知的连接池大小
- ✅ 自动健康检查和连接重用

### 3. 部署策略
- ✅ 使用Cloud Run的Secret Manager集成
- ✅ 避免在容器镜像中包含敏感信息
- ✅ 支持无缝的环境变量更新

## 🚨 故障排除

### 常见错误及解决方案

1. **"authentication failed"错误**
   - 检查项目ID和区域是否正确
   - 确认IAM权限配置正确
   - 验证Cloud SQL实例状态

2. **"no such host"错误**
   - 检查实例名称拼写
   - 确认实例在指定区域中存在
   - 等待DNS传播完成

3. **"connection timeout"错误**
   - 检查网络连通性
   - 验证Cloud SQL防火墙规则
   - 调整连接池超时时间

## 🎯 下一步行动

1. **立即执行**：运行自动修复工具获取正确的DATABASE_URL格式
2. **更新配置**：在Secret Manager中更新DATABASE_URL
3. **重新部署**：重新部署Cloud Run服务以获取新环境变量
4. **验证连接**：使用验证工具确保数据库连接正常

这个解决方案将确保你的DATABASE_URL符合Cloud SQL的要求，同时保持与Secret Manager管理的兼容性。