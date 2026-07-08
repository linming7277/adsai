# 使用 Cloud SQL 进行集成测试

## 概述

直接使用 GCP Cloud SQL 进行测试的优势：
- ✅ 无需本地 Docker
- ✅ 真实的生产环境配置
- ✅ 与部署环境一致
- ✅ 简化开发环境设置

---

## 配置方法

### 1. 设置 GCP 认证

```bash
# 设置 GCP 服务账号密钥
export GOOGLE_APPLICATION_CREDENTIALS="secrets/gcp_codex_dev.json"

# 验证认证
gcloud auth application-default login
```

### 2. 配置测试数据库连接

创建 `.env.test` 文件：

```bash
# Cloud SQL 连接（通过 Cloud SQL Proxy）
TEST_DATABASE_URL="postgresql://user:password@localhost:5432/autoads_db"

# 或直接通过 Unix Socket
TEST_DATABASE_URL="postgresql://user:password@/autoads_db?host=/cloudsql/project-id:asia-northeast1:autoads"

# GCP 认证
GOOGLE_APPLICATION_CREDENTIALS="secrets/gcp_codex_dev.json"
```

### 3. 启动 Cloud SQL Proxy（推荐）

```bash
# 下载 Cloud SQL Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64
chmod +x cloud-sql-proxy

# 启动 Proxy
./cloud-sql-proxy project-id:asia-northeast1:autoads --port 5432
```

---

## 快速启动脚本

创建 `scripts/start-cloud-sql-proxy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting Cloud SQL Proxy..."

# 检查 GCP 认证
if [ ! -f "secrets/gcp_codex_dev.json" ]; then
    echo "❌ Error: GCP credentials not found"
    exit 1
fi

export GOOGLE_APPLICATION_CREDENTIALS="secrets/gcp_codex_dev.json"

# 启动 Cloud SQL Proxy
./cloud-sql-proxy project-id:asia-northeast1:autoads --port 5432 &

echo "✅ Cloud SQL Proxy started"
echo "📊 Database: postgresql://localhost:5432/autoads_db"
```

---

## 运行测试

```bash
# 1. 启动 Cloud SQL Proxy
./scripts/start-cloud-sql-proxy.sh

# 2. 设置环境变量
export TEST_DATABASE_URL="postgresql://user:password@localhost:5432/autoads_db"

# 3. 运行测试
go test ./services/offer/... -v

# 4. 停止 Proxy
pkill cloud-sql-proxy
```

---

## 最佳实践

### 1. 使用测试专用数据库
- 在 Cloud SQL 中创建 `autoads_test` 数据库
- 与生产数据隔离

### 2. 测试数据清理
- 所有测试 ID 以 `test-` 开头
- 测试后自动清理

### 3. 并发控制
- 使用事务隔离
- 避免测试数据冲突

---

**优势**: 无需 Docker，直接使用真实环境  
**推荐**: 适合团队协作和 CI/CD
