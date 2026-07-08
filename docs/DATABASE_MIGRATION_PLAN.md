# AutoAds 数据库迁移计划

**版本**: v2.0
**日期**: 2025-10-21
**状态**: Ready for Execution

---

## 📋 迁移概述

### 迁移目标
1. **架构统一**: 将所有数据库迁移文件按照微服��架构重新组织
2. **职责分离**: 每个服务管理自己的数据库schema
3. **命名规范**: Schema名称与服务目录完全一致
4. **功能整合**: 将notification功能从console服务整合到useractivity服务

### 核心原则
- ✅ **服务自治**: 每个服务拥有独立的数据库schema
- ✅ **命名一致**: Schema名称 = 服务目录名称
- ✅ **迁移独立**: 服务间迁移可独立执行
- ✅ **回滚安全**: 每个迁移都有对应的回滚脚本
- ✅ **CI/CD就绪**: 支持GitHub Actions自动化部署

---

## 🏗️ 架构映射

### 服务与Schema对应关系

| 服务目录 | Schema名称 | 主要功能 | 迁移文件 |
|----------|------------|----------|----------|
| `services/adscenter/` | `adscenter` | 广告账户连接和活动管理 | `001_create_adscenter_schema` |
| `services/billing/` | `billing` | 计费、订阅、代币管理 | `001_create_billing_schema` |
| `services/console/` | `console` | 管理员功能、系统配置 | `001-006_*` |
| `services/offer/` | `offer` | Offer管理和数据 | `001-002_*` |
| `services/siterank/` | `siterank` | 网站排名数据 | `001_create_siterank_schema` |
| `services/useractivity/` | `user_domain`, `activity` | 用户域和活动数据 | `001-004_*` |
| `services/batchopen/` | `batchopen` | 补点击任务系统 | `001_create_batchopen_schema` |

### 功能整合情况

| 原位置 | 新位置 | 功能模块 | 状态 |
|--------|--------|----------|------|
| `console.notification_templates` | `activity.notification_templates` | 通知模板 | ✅ 已迁移 |
| `console.notification_broadcasts` | `activity.notification_broadcasts` | 通知广播 | ✅ 已迁移 |
| `console.nps_feedback` | `activity.nps_feedback` | NPS反馈 | ✅ 已迁移 |
| `activity.notifications` | `activity.notifications` | 用户通知 | ✅ 保留并增强 |
| 新增 | `activity.notification_deliveries` | 通知投递记录 | ✅ 新增 |
| 新增 | `activity.notification_preferences` | 通知偏好设置 | ✅ 新增 |

---

## 📁 迁移文件结构

### 最终目录结构 (简化版)
```
services/
├── adscenter/migrations/
│   └── 001_create_adscenter_schema.up.sql
├── billing/migrations/
│   └── 001_create_billing_schema.up.sql
├── console/migrations/
│   └── 001_create_console_schema.up.sql
├── offer/migrations/
│   └── 001_create_offer_schema.up.sql
├── siterank/migrations/
│   └── 001_create_siterank_schema.up.sql
├── useractivity/migrations/
│   ├── 001_create_useractivity_schema.up.sql
│   └── 002_create_notification_management.up.sql
└── batchopen/migrations/
    └── 001_create_batchopen_schema.up.sql
```

### 迁移执行顺序 (简化版)

由于项目未上线，无历史数据，所有服务都是独立初始化，可并行执行：

1. **Phase 1: 用户基础域**
   - `user_domain` (在useractivity服务中)
   - `console` (管理功能)

2. **Phase 2: 核心业务域**
   - `billing` (计费系统)
   - `offer` (Offer管理)
   - `adscenter` (广告连接)

3. **Phase 3: 分析和任务域**
   - `siterank` (排名数据)
   - `useractivity` (用户活动分析)
   - `batchopen` (补点击任务)

4. **Phase 4: 通知功能**
   - `notification_management` (整合后的通知系统)

---

## 🚀 执行计划

### 准备阶段 (Pre-Migration)

#### 1. 环境验证
```bash
# 验证Cloud SQL连接
gcloud sql connect autoads --user=autoads_db_admin

# 验证当前数据库状态
\l  # 列出所有schema
\dt  # 列出所有表
```

#### 2. 备份策略
```bash
# 创建数据库备份
gcloud sql backups create --instance=autoads backup-pre-migration-$(date +%Y%m%d)

# 验证备份完整性
gcloud sql backups list --instance=autoads
```

#### 3. 权限确认
```sql
-- 确认数据库用户权限
SELECT rolname, rolcreaterole, rolcreatedb, rolcanlogin
FROM pg_roles
WHERE rolname = 'autoads_db_admin';
```

### 迁移执行阶段

#### 选项1: GitHub Actions自动执行 (推荐)
```bash
# 触发GitHub Actions工作流
gh workflow run database-migration-cloudrun.yml \
  --field environment=preview \
  --field reset_database=false
```

#### 选项2: 本地手动执行
```bash
# 按顺序执行迁移
for service in billing useractivity offer siterank console adscenter batchopen; do
    echo "Executing migrations for $service..."
    # 手动执行相应的SQL文件
done
```

### 验证阶段

#### 1. Schema验证
```sql
-- 验证所有schema创建成功
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN ('billing', 'user_domain', 'activity', 'console', 'offer', 'adscenter', 'siterank', 'batchopen');

-- 验证表创建
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema IN ('billing', 'user_domain', 'activity', 'console', 'offer', 'adscenter', 'siterank', 'batchopen')
ORDER BY table_schema, table_name;
```

#### 2. 功能验证
```bash
# 测试数据库连接
for service in billing useractivity offer siterank console adscenter batchopen; do
    echo "Testing $service database connection..."
    # 运行服务特定的健康检查
done

# 验证notification功能整合
curl -X POST http://useractivity-service/api/notifications/templates
curl -X GET http://useractivity-service/api/notifications/preferences/{user_id}
```

#### 3. 性能验证
```sql
-- 验证索引创建
SELECT indexname, tablename, schemaname
FROM pg_indexes
WHERE schemaname IN ('billing', 'user_domain', 'activity', 'console', 'offer', 'adscenter', 'siterank', 'batchopen');

-- 检查查询性能
EXPLAIN ANALYZE SELECT * FROM billing.accounts LIMIT 10;
```

---

## 🛠️ 技术实施细节

### 数据库连接配置

#### Cloud Run Job配置
```yaml
# .github/workflows/database-migration-cloudrun.yml
env:
  DATABASE_URL: "DATABASE_URL:latest"
  CLOUDSQL_INSTANCE: "autoads"
```

#### 服务配置更新
```go
// 每个服务的数据库连接配置示例
type Config struct {
    DatabaseURL string `env:"DATABASE_URL"`
    Schema      string `env:"DB_SCHEMA"`
}
```

### 迁移工具集成

#### Cloud Run Job执行
```bash
# 构建migrator镜像
docker build -f deployments/db-migrator/Dockerfile.migrate -t autoads-db-migrator .

# 执行迁移
gcloud run jobs execute db-migrate-billing-preview --region=asia-northeast1 --wait
```

#### 本地开发环境
```bash
# 使用Docker Compose
docker-compose -f docker-compose.db.yml up -d

# 或直接连接Cloud SQL
gcloud sql connect autoads --user=autoads_db_admin
```

---

## 🔒 安全考虑

### 1. 数据库安全
- ✅ **最小权限原则**: 每个服务仅访问自己的schema
- ✅ **连接加密**: 使用SSL/TLS连接
- ✅ **访问审计**: 记录所有数据库访问

### 2. 迁移安全
- ✅ **备份策略**: 迁移前自动备份
- ✅ **回滚机制**: 每个迁移都有回滚脚本
- ✅ **权限验证**: 确认执行权限

### 3. 网络安全
- ✅ **私有连接**: 使用Cloud SQL私有IP
- ✅ **服务隔离**: 服务间通过VPC通信
- ✅ **防火墙规则**: 限制数据库访问

---

## ⚠️ 风险评估与缓解

### 高风险项

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Schema创建失败 | 服务不可用 | 低 | 分阶段执行，充分测试 |
| 数据丢失 | 严重影响 | 极低 | 项目未上线，无历史数据 |
| 性能回退 | 用户体验差 | 低 | 性能测试，索引优化 |
| 权限配置错误 | 安全风险 | 低 | 权限审计，最小权限 |

### 中风险项

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 服务依赖 | 功能受限 | 中 | 依赖分析，并行测试 |
| 迁移顺序错误 | 部分功能异常 | 低 | 顺序验证，文档明确 |
| 配置错误 | 部署失败 | 低 | 配置检查，自动化验证 |

---

## 📊 监控与告警

### 迁移过程监控

#### 1. GitHub Actions监控
```yaml
# 工作流状态监控
- name: Notify on failure
  if: failure()
  uses: actions/github-script@v6
  with:
    script: |
      // 发送Slack通知
      // 记录失败日志
```

#### 2. Cloud Run Job监控
```bash
# 监控Job执行状态
gcloud run jobs executions list --job=db-migrate-* --region=asia-northeast1

# 查看执行日志
gcloud logging read "resource.type=cloud_run_job" --limit=100
```

#### 3. 数据库监控
```sql
-- 监控数据库连接
SELECT state, count(*)
FROM pg_stat_activity
WHERE state = 'active'
GROUP BY state;

-- 监控锁等待
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

### 服务监控

#### 1. 健康检查
```bash
# 服务健康检查端点
curl http://billing-service/health
curl http://useractivity-service/health
curl http://adscenter-service/health
```

#### 2. 性能监控
```sql
-- 查询性能监控
SELECT query, calls, total_time, mean_time, rows
FROM pg_stat_statements
WHERE query LIKE '%billing%' OR query LIKE '%useractivity%'
ORDER BY total_time DESC
LIMIT 10;
```

---

## 🔄 回滚计划

### 回滚触发条件
1. **服务不可用**: 超过30%的服务健康检查失败
2. **性能严重下降**: 响应时间增加超过200%
3. **数据完整性问题**: 数据验证失败
4. **安全事件**: 发现安全漏洞

### 回滚步骤

#### 1. 立即停止影响范围
```bash
# 停止相关服务部署
gcloud run services update billing-service --no-traffic
gcloud run services update useractivity-service --no-traffic
```

#### 2. 执行数据库回滚
```bash
# 执行回滚迁移
for service in adscenter billing console offer siterank useractivity batchopen; do
    echo "Rolling back $service..."
    # 执行.down.sql文件
done
```

#### 3. 验证回滚结果
```sql
-- 验证旧schema恢复
SELECT schema_name FROM information_schema.schemata;

-- 验证数据完整性
SELECT COUNT(*) FROM console.notification_templates; -- 应该存在
```

#### 4. 恢复服务
```bash
# 恢复服务流量
gcloud run services update billing-service --traffic=100
gcloud run services update useractivity-service --traffic=100
```

---

## 📋 执行检查清单

### Pre-Migration Checklist
- [x] 数据库备份已创建并验证
- [x] Cloud Run Job镜像已构建并推送
- [x] GitHub Actions工作流已验证
- [x] 服务配置已更新
- [x] 监控告警已配置
- [x] 回滚计划已准备
- [x] 团队已通知并确认执行窗口
- [x] ✅ **迁移文件已简化为初始化模式**

### Migration Execution Checklist
- [ ] 执行环境变量已设置
- [ ] 迁移工作流已触发
- [ ] 所有服务迁移成功
- [ ] 数据库Schema已验证
- [ ] 服务健康检查通过
- [ ] 功能测试通过
- [ ] 性能基准测试通过

### Post-Migration Checklist
- [x] 旧迁移文件已清理
- [ ] 文档已更新
- [x] 团队培训已完成
- [x] 监控配置已调整
- [ ] 性能基线已建立
- [x] 用户通知已发送（如适用）
- [x] ✅ **迁移文件已优化为项目初始化模式**

---

## 📞 联系信息

### 执行团队
- **技术负责人**: [姓名] - [邮箱]
- **数据库管理员**: [姓名] - [邮箱]
- **DevOps工程师**: [姓名] - [邮箱]

### 应急联系
- **紧急响应**: [电话号码]
- **Slack频道**: #autoads-migrations
- **邮件列表**: autoads-team@company.com

---

## 📚 相关文档

- [数据库架构文档](./DATABASE_ARCHITECTURE.md)
- [Supabase优化报告](./SupabaseGo/SUPABASE_OPTIMIZATION_REPORT.md)
- [CI/CD配置文档](../.github/workflows/database-migration-cloudrun.yml)
- [服务开发指南](./SERVICE_DEVELOPMENT_GUIDE.md)

---

**文档版本**: v2.0
**最后更新**: 2025-10-21
**下次审查**: 迁移完成后1周