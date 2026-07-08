# 🛡️ AutoAds 数据库安全操作检查清单

## 概述

本文档提供AutoAds Cloud SQL数据库操作的完整安全检查���单，确保所有数据库操作都遵循最佳安全实践。

**适用场景**：
- 数据库Schema迁移
- 数据结构变更
- 批量数据操作
- 生产环境部署
- 紧急故障恢复

---

## 🔧 环境准备检查清单

### Secret Manager配置
- [ ] **Secret Manager访问权限**
  ```bash
  gcloud secrets list --project=gen-lang-client-0944935873
  ```

- [ ] **数据库连接Secret存在**
  ```bash
  gcloud secrets describe autoads-db-connection --project=gen-lang-client-0944935873
  ```

- [ ] **Secret可正常访问**
  ```bash
  gcloud secrets versions access latest --secret="autoads-db-connection" --project=gen-lang-client-0944935873
  ```

- [ ] **备份专用Secret可访问**（可选）
  ```bash
  gcloud secrets versions access latest --secret="autoads-db-migration" --project=gen-lang-client-0944935873
  ```

### 工具和依赖检查
- [ ] **Google Cloud CLI已安装且版本最新**
  ```bash
  gcloud version
  ```

- [ ] **已登录正确的Google账号**
  ```bash
  gcloud auth list --filter=status:ACTIVE
  ```

- [ ] **PostgreSQL客户端已安装**
  ```bash
  psql --version
  ```

- [ ] **项目权限验证**
  ```bash
  gcloud projects describe gen-lang-client-0944935873
  ```

### 网络连接检查
- [ ] **当前IP已添加到Cloud SQL授权网络**
  ```bash
  curl -s ifconfig.me
  # 然后在GCP Console验证该IP在授权列表中
  ```

- [ ] **数据库实例状态正常**
  ```bash
  gcloud sql instances describe autoads-sql --project=gen-lang-client-0944935873
  ```

- [ ] **数据库连接测试**
  ```bash
  source ./scripts/db/secure-db-connection.sh
  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;"
  ```

---

## 📋 操作前安全检查清单

### 代码和版本检查
- [ ] **工作目录清洁**
  ```bash
  git status --porcelain
  # 确认无未提交的重要代码更改
  ```

- [ ] **当前分支和提交记录**
  ```bash
  git branch
  git log --oneline -5
  ```

- [ ] **迁移文件语法检查**
  ```bash
  # 检查SQL文件语法
  psql --help | head -n 1
  # 使用psql语法检查模式验证SQL文件
  ```

### 时间和环境评估
- [ ] **避开业务高峰期**
  - 当前时间：$(date)
  - 业务高峰期：9:00-18:00 (工作日)
  - 建议：操作时间选择非工作时间

- [ ] **相关服务状态检查**
  ```bash
  # 检查Cloud Run服务状态
  gcloud run services list --region=asia-northeast1
  ```

- [ ] **团队通知确认**
  - [ ] 已通知相关人员
  - [ ] 已确认操作窗口
  - [ ] 准备好回滚联系人

### 备份状态检查
- [ ] **自动备份功能正常**
  ```bash
  ./scripts/db/backup-database.sh --help
  ```

- [ ] **备份目录空间充足**
  ```bash
  df -h ./scripts/db/backups/
  ```

- [ ] **最近的备份可访问**
  ```bash
  ls -la ./scripts/db/backups/*.sql | tail -5
  ```

---

## 🚀 操作执行安全检查清单

### 操作前最终确认
- [ ] **所有安全检查已完成**
- [ ] **备份已创建并验证**
- [ ] **回滚方案已准备**
- [ ] **团队成员已就位**
- [ ] **监控系统已启用**

### 执行过程监控
- [ ] **操作日志实时监控**
  ```bash
  tail -f ./scripts/db/logs/operations_$(date +%Y%m%d).log
  ```

- [ ] **数据库性能监控**
  ```bash
  # 监控数据库连接数和查询性能
  gcloud sql instances describe autoads-sql --format="value(state)"
  ```

- [ ] **错误检测和响应**
  - 监控脚本执行输出
  - 检查数据库错误日志
  - 准备快速回滚触发

---

## ✅ 操作后验证检查清单

### 数据库完整性验证
- [ ] **Schema数量正确**
  ```bash
  source ./scripts/db/secure-db-connection.sh
  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
    -c "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast');"
  # 期望结果: 8 (user, billing, offer, siterank, useractivity, console, adscenter, batchopen)
  ```

- [ ] **表数量正确**
  ```bash
  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
    -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast') AND table_type = 'BASE TABLE';"
  # 期望结果: 47
  ```

- [ ] **外键约束验证**
  ```bash
  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
    -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY';"
  ```

- [ ] **索引状态检查**
  ```bash
  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
    -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname NOT IN ('pg_catalog', 'information_schema');"
  ```

### 应用程序功能验证
- [ ] **用户认证功能正常**
  - 测试Google OAuth登录
  - 验证JWT Token生成
  - 检查用户资料同步

- [ ] **核心业务功能测试**
  - 用户注册和登录流程
  - 数据库CRUD操作
  - API端点响应测试

- [ ] **服务健康检查**
  ```bash
  # 检查各个Cloud Run服务状态
  for service in user-api billing-api offer-api; do
    gcloud run services describe $service --region=asia-northeast1 --format="value(status.url)"
  done
  ```

### 性能和监控检查
- [ ] **数据库查询性能正常**
  ```bash
  # 测试基础查询性能
  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
    -c "SELECT COUNT(*) FROM user.users;" -- 期望 < 100ms
  ```

- [ ] **数据库连接池状态**
  ```bash
  # 检查活跃连接数
  gcloud sql instances describe autoads-sql --format="value(state.databaseVersion)"
  ```

- [ ] **系统资源使用率**
  - CPU使用率 < 70%
  - 内存使用率 < 80%
  - 磁盘使用率 < 85%

---

## 🔄 回滚和恢复检查清单

### 回滚触发条件
- [ ] **数据损坏或丢失**
- [ ] **应用程序功能异常**
- [ ] **性能严重下降**
- [ ] **用户投诉激增**
- [ ] **监控告警触发**

### 回滚执行检查
- [ ] **立即停止相关服务**
  ```bash
  gcloud run services update [affected-service] --no-traffic --region=asia-northeast1
  ```

- [ ] **评估问题严重程度**
  - 轻微：数据修复
  - 中等：备份恢复
  - 严重：快照恢复

- [ ] **选择恢复策略**
  - 备份文件恢复：./scripts/db/restore-database.sh
  - 快照恢复：./scripts/db/restore-database.sh --snapshot

### 恢复后验证
- [ ] **数据库完整性恢复**
- [ ] **应用程序功能恢复**
- [ ] **服务流量恢复**
  ```bash
  gcloud run services update [service-name] --traffic=100 --region=asia-northeast1
  ```
- [ ] **监控指标正常**
- [ ] **用户反馈收集**

---

## 📝 文档和审计检查清单

### 操作记录
- [ ] **操作日志完整**
  ```bash
  ls -la ./scripts/db/logs/
  tail -20 ./scripts/db/logs/operations_$(date +%Y%m%d).log
  ```

- [ ] **操作报告生成**
  ```bash
  ls -la ./scripts/db/logs/*_report_*.md
  ```

- [ ] **变更记录更新**
  - 更新项目文档
  - 记录架构变更
  - 更新API文档

### 团队沟通
- [ ] **操作结果通知**
  - 发送操作摘要邮件
  - 更新项目状态页面
  - 通知相关 stakeholders

- [ ] **经验总结记录**
  - 记录成功经验
  - 分析问题原因
  - 改进操作流程

---

## 🛠️ 工具和脚本使用指南

### 快速命令参考
```bash
# 设置Secret Manager
./scripts/db/setup-secrets.sh

# 创建备份
./scripts/db/backup-database.sh

# 安全执行迁移
./scripts/db/safe-db-operations.sh \
  --type migration \
  --file services/user/migrations/001_example.up.sql \
  --name "example_migration"

# 查看可用备份
./scripts/db/restore-database.sh --list

# 恢复数据库
./scripts/db/restore-database.sh

# 验证Secret设置
./scripts/db/setup-secrets.sh --verify-only
```

### 应急联系方式
- **主要负责人**: [填写负责人姓名和联系方式]
- **技术支持**: [填写技术支持联系方式]
- **业务负责人**: [填写业务负责人联系方式]
- **紧急响应**: [填写紧急响应流程]

---

## 📚 相关文档

- [AutoAds架构设计](../BasicPrinciples/MustKnowV7.md)
- [Google Cloud最佳实践](https://cloud.google.com/docs/best-practices)
- [PostgreSQL安全指南](https://www.postgresql.org/docs/current/security.html)
- [Cloud SQL安全配置](https://cloud.google.com/sql/docs/postgres/security)

---

**版本**: v1.0
**最后更新**: $(date)
**维护者**: AutoAds开发团队

---

⚠️ **重要提醒**:
- 严格遵守本检查清单
- 任何疑问都应停止操作并寻求帮助
- 安全第一，数据无价