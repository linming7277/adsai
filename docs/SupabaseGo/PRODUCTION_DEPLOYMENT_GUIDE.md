# 生产环境部署指南

**版本**: 1.0
**最后更新**: 2025-01-19
**适用环境**: 预发与生产环境共用数据库
**风险等级**: 🔴 高风险操作

## ⚠️ 重要安全须知

### 环境约束
- **🔴 关键约束**: 预发环境与生产环境共用同一个数据库
- **🚫 禁止操作**: 预发环境禁止所有DDL和写操作
- **✅ 推荐做法**: 直接在生产环境执行，但采用极其谨慎的方式

### 操作前检查清单
- [ ] **备份确认**: 已确认当前备份策略有效
- [ ] **时间窗口**: 已确认业务低峰期时间窗口
- [ ] **团队准备**: 所有必要人员已就位
- [ ] **监控就绪**: 监控系统已配置并测试
- [ ] **回滚方案**: 应急回滚方案已准备并测试

## 📋 部署前准备

### 1. 环境验证

#### 1.1 数据库连接验证
```bash
# 检查数据库连接
export DB_HOST="your-production-db-host"
export DB_PORT="5432"
export DB_NAME="adsai_db"
export DB_USER="postgres"
export DB_PASSWORD="your-secure-password"

# 测试连接
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();"

# 检查当前连接数
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
```

#### 1.2 当前状态检查
```bash
# 检查现有表结构
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt"

# 检查useractivity服务表
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt user_notifications" "\dt checkins" "\dt referrals" "\dt event_store"

# 检查db-admin服务状态
curl -s "https://db-admin-preview-yt54xvsg5q-an.a.run.app/api/v1/health" | jq .
```

### 2. 备份策略确认

#### 2.1 自动备份检查
```bash
# 检查最近的备份
BACKUP_DIR="/tmp/adsai_backup_$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# 创建结构备份
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --schema-only --no-owner --no-privileges > "$BACKUP_DIR/schema_$(date +%H%M%S).sql"

# 验证备份文件
ls -la "$BACKUP_DIR/"
head -10 "$BACKUP_DIR"/schema_*.sql
```

#### 2.2 备份验证清单
- [ ] 备份文件已创建
- [ ] 备份文件大小合理 (>1MB)
- [ ] 备份文件语法正确
- [ ] 备份位置安全
- [ ] 备份恢复流程已测试

### 3. 监控配置

#### 3.1 基础监控设置
```bash
# 创建监控目录
MONITOR_DIR="/tmp/adscenter_monitor_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$MONITOR_DIR"

# 监控脚本
cat > "$MONITOR_DIR/monitor.sh" << 'EOF'
#!/bin/bash
LOG_FILE="/tmp/adscenter_monitor_$(date +%Y%m%d_%H%M%S).log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 数据库连接监控
check_db_connection() {
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        log "✅ 数据库连接正常"
        return 0
    else
        log "❌ 数据库连接失败"
        return 1
    fi
}

# 性能监控
check_performance() {
    # 查询活跃连接数
    active_conn=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null || echo "0")
    log "活跃连接数: $active_conn"

    # 检查慢查询
    slow_queries=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM pg_stat_statements WHERE mean_time > 1000;" 2>/dev/null || echo "0")
    log "慢查询数: $slow_queries"

    # 告警检查
    if [ "$active_conn" -gt 50 ]; then
        log "⚠️ 警告: 活跃连接数过高 ($active_conn)"
    fi

    if [ "$slow_queries" -gt 5 ]; then
        log "⚠️ 警告: 慢查询数过多 ($slow_queries)"
    fi
}

# 主监控循环
while true; do
    log "=== 监控检查 ==="
    check_db_connection
    check_performance
    log "等待30秒..."
    sleep 30
done
EOF

chmod +x "$MONITOR_DIR/monitor.sh"
```

## 🚀 adscenter服务迁移执行

### 1. 执行时间选择

#### 1.1 推荐时间窗口
```bash
# 查看当前系统负载
top -bn1 | head -20

# 查看数据库负载
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT
        state,
        count(*) as connection_count
    FROM pg_stat_activity
    GROUP BY state
    ORDER BY connection_count DESC;
"

# 检查是否有长时间运行的查询
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT
        pid,
        now() - pg_stat_activity.query_start AS duration,
        query
    FROM pg_stat_activity
    WHERE state = 'active'
        AND now() - pg_stat_activity.query_start > interval '5 minutes'
    ORDER BY duration DESC;
"
```

#### 1.2 最佳执行时间
- **推荐时间**: 02:00-04:00 (业务低峰期)
- **避免时间**: 工作时间、数据备份时间、报表生成时间
- **准备时间**: 提前30分钟开始准备和检查

### 2. 迁移执行

#### 2.1 使用安全迁移脚本
```bash
# 确保脚本可执行
chmod +x scripts/safe-adscenter-migration.sh

# 设置环境变量
export DB_HOST="your-production-db-host"
export DB_PORT="5432"
export DB_NAME="adsai_db"
export DB_USER="postgres"
export DB_PASSWORD="your-secure-password"

# 执行迁移
./scripts/safe-adscenter-migration.sh
```

#### 2.2 手动执行步骤 (备选方案)
如果脚本执行失败，可以按以下步骤手动执行：

```bash
# 步骤1: 创建备份
BACKUP_DIR="/tmp/adscenter_manual_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --schema-only > "$BACKUP_DIR/backup_schema.sql"

# 步骤2: 执行DDL语句
echo "开始执行DDL语句..."

# DDL 1: UserAdsConnection表
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c '
    CREATE TABLE IF NOT EXISTS "UserAdsConnection" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" TEXT NOT NULL,
      "loginCustomerId" TEXT NOT NULL,
      "primaryCustomerId" TEXT,
      "refreshToken" TEXT NOT NULL,
      "scopes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
'

# DDL 2: UserAdsConnection索引
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c '
    CREATE INDEX IF NOT EXISTS idx_useradsconnection_user ON "UserAdsConnection"("userId");
'

# DDL 3: BulkActionOperation表
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c '
    CREATE TABLE IF NOT EXISTS "BulkActionOperation" (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      plan JSONB,
      status TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
'

# DDL 4: BulkActionAudit表
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c '
    CREATE TABLE IF NOT EXISTS "BulkActionAudit" (
      id BIGSERIAL PRIMARY KEY,
      op_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      snapshot JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
'

# DDL 5: BulkActionAudit索引
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c '
    CREATE INDEX IF NOT EXISTS ix_bulk_audit_op ON "BulkActionAudit"(op_id, created_at);
'

# DDL 6: AuditEvent表
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c '
    CREATE TABLE IF NOT EXISTS "AuditEvent" (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '\''{}'\''::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
'

# DDL 7: AuditEvent索引
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c '
    CREATE INDEX IF NOT EXISTS ix_audit_event_user_kind_time ON "AuditEvent"(user_id, kind, created_at DESC);
'

echo "所有DDL语句执行完成"
```

### 3. 执行后验证

#### 3.1 表结构验证
```bash
# 验证所有表已创建
echo "验证表创建结果..."

EXPECTED_TABLES=("UserAdsConnection" "BulkActionOperation" "BulkActionAudit" "AuditEvent")

for table in "${EXPECTED_TABLES[@]}"; do
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt \"$table\"" | grep -q "$table"; then
        echo "✅ 表 '$table' 创建成���"
    else
        echo "❌ 表 '$table' 创建失败"
    fi
done

# 验证索引创建
echo "验证索引创建结果..."

EXPECTED_INDEXES=("idx_useradsconnection_user" "ix_bulk_audit_op" "ix_audit_event_user_kind_time")

for index in "${EXPECTED_INDEXES[@]}"; do
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\di \"$index\"" | grep -q "$index"; then
        echo "✅ 索引 '$index' 创建成功"
    else
        echo "❌ 索引 '$index' 创建失败"
    fi
done
```

#### 3.2 功能测试
```bash
# 测试基本CRUD操作
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    -- 测试表插入
    INSERT INTO \"UserAdsConnection\" (\"userId\", \"loginCustomerId\", \"refreshToken\")
    VALUES ('test-user-123', '1234567890', 'test-refresh-token')
    ON CONFLICT (\"userId\") DO NOTHING;

    -- 测试数据查询
    SELECT * FROM \"UserAdsConnection\" WHERE \"userId\" = 'test-user-123';

    -- 测试数据更新
    UPDATE \"UserAdsConnection\"
    SET \"updatedAt\" = NOW()
    WHERE \"userId\" = 'test-user-123';

    -- 测试数据删除
    DELETE FROM \"UserAdsConnection\" WHERE \"userId\" = 'test-user-123';
"

echo "✅ 基本CRUD操作测试通过"
```

## 📊 实时监控配置

### 1. 关键指标监控

#### 1.1 数据库性能指标
```bash
# 创建性能监控脚本
cat > /tmp/performance_monitor.sh << 'EOF'
#!/bin/bash

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-adsai_db}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-password}"

LOG_FILE="/tmp/db_performance_$(date +%Y%m%d_%H%M%S).log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 连接数监控
monitor_connections() {
    local total_conn=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null || echo "0")
    local active_conn=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null || echo "0")
    local idle_conn=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'idle';" 2>/dev/null || echo "0")

    log "连接状态: 总数=$total_conn, 活跃=$active_conn, 空闲=$idle_conn"

    if [ "$active_conn" -gt 50 ]; then
        log "⚠️ 警告: 活跃连接数过高 ($active_conn)"
    fi
}

# 查询性能监控
monitor_query_performance() {
    local slow_queries=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM pg_stat_statements WHERE mean_time > 1000;" 2>/dev/null || echo "0")
    local avg_time=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT ROUND(mean_time::numeric, 2) FROM pg_stat_statements;" 2>/dev/null || echo "0")

    log "查询性能: 慢查询=$slow_queries, 平均时间=${avg_time}ms"

    if [ "$slow_queries" -gt 10 ]; then
        log "⚠️ 警告: 慢查询数过多 ($slow_queries)"
    fi

    if [ "${avg_time%.*}" -gt 500 ]; then
        log "⚠️ 警告: 平均查询时间过长 (${avg_time}ms)"
    fi
}

# 数据库大小监控
monitor_database_size() {
    local db_size=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" 2>/dev/null || echo "unknown")
    log "数据库大小: $db_size"
}

# 主监控循环
while true; do
    log "=== 性能监控检查 ==="
    monitor_connections
    monitor_query_performance
    monitor_database_size
    log "等待60秒..."
    sleep 60
done
EOF

chmod +x /tmp/performance_monitor.sh
```

### 2. 错误监控

#### 2.1 错误日志监控
```bash
# 创建错误监控脚本
cat > /tmp/error_monitor.sh << 'EOF'
#!/bin/bash

LOG_FILE="/tmp/db_error_monitor_$(date +%Y%m%d_%H%M%S).log"
ERROR_THRESHOLD=5

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 检查数据库错误日志
monitor_db_errors() {
    local error_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT count(*)
        FROM pg_stat_activity
        WHERE state = 'active'
        AND wait_event_type IS NOT NULL;
    " 2>/dev/null || echo "0")

    if [ "$error_count" -gt "$ERROR_THRESHOLD" ]; then
        log "🚨 严重警告: 数据库等待事件过多 ($error_count)"
        log "详细信息:"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            SELECT
                pid,
                wait_event_type,
                wait_event,
                query
            FROM pg_stat_activity
            WHERE state = 'active'
                AND wait_event_type IS NOT NULL
            ORDER BY query_start;
        " 2>/dev/null | head -5
    fi
}

# 主监控循环
while true; do
    log "=== 错误监控检查 ==="
    monitor_db_errors
    log "等待30秒..."
    sleep 30
done
EOF

chmod +x /tmp/error_monitor.sh
```

## 🆘 应急响应预案

### 1. 回滚预案

#### 1.1 自动回滚脚本
```bash
# 创建回滚脚本
cat > /tmp/emergency_rollback.sh << 'EOF'
#!/bin/bash

set -euo pipefail

ROLLBACK_ID="rollback_$(date +%Y%m%d_%H%M%S)"
LOG_FILE="/tmp/emergency_rollback_${ROLLBACK_ID}.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "[ERROR] $1" | tee -a "$LOG_FILE" >&2
}

# 停止监控进程
stop_monitors() {
    log "停止所有监控进程..."
    pkill -f performance_monitor.sh || true
    pkill -f error_monitor.sh || true
}

# 数据库连接检查
check_db_connection() {
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        error "无法连接到数据库，回滚无法执行"
        return 1
    fi
    return 0
}

# 删除创建的对象
rollback_created_objects() {
    log "开始回滚创建的对象..."

    # 删除索引（如果创建成功）
    local indexes=("ix_audit_event_user_kind_time" "ix_bulk_audit_op" "idx_useradsconnection_user")
    for index in "${indexes[@]}"; do
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\di \"$index\"" | grep -q "$index"; then
            log "删除索引: $index"
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DROP INDEX IF EXISTS \"$index\";" || true
        fi
    done

    # 删除表（如果创建成功）
    local tables=("AuditEvent" "BulkActionAudit" "BulkActionOperation" "UserAdsConnection")
    for table in "${tables[@]}"; do
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt \"$table\"" | grep -q "$table"; then
            log "删除表: $table"
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DROP TABLE IF EXISTS \"$table\" CASCADE;" || true
        fi
    done

    log "对象回滚完成"
}

# 主回滚流程
main() {
    log "========================================="
    log "应急回滚开始"
    log "回滚ID: $ROLLBACK_ID"
    log "========================================="

    stop_monitors

    if ! check_db_connection; then
        error "数据库连接失败，回滚终止"
        exit 1
    fi

    rollback_created_objects

    log "========================================="
    log "应急回滚完成"
    log "回滚ID: $ROLLBACK_ID"
    log "日志文件: $LOG_FILE"
    log "========================================="
}

main "$@"
EOF

chmod +x /tmp/emergency_rollback.sh
```

### 2. 服务恢复预案

#### 2.1 服务重启流程
```bash
# adscenter服务重启脚本
restart_adscenter_service() {
    log "重启adscenter服务..."

    # 检查服务状态
    gcloud run services describe adscenter-prod --region=us-central1 --format="value(status.url)" || true

    # 重启服务
    gcloud run services update adscenter-prod --region=us-central1

    # 等待服务就绪
    sleep 30

    # 验证服务健康状态
    gcloud run services describe adscenter-prod --region=us-central1 --format="value(status.latestReadyRevisionTime)" || true

    log "adscenter服务重启完成"
}
```

## 📋 部署后检查清单

### 1. 功能验证
- [ ] adscenter服务正常启动
- [ ] 数据库连接正常
- [ ] 所有新创建的表可以正常访问
- [ ] 基本CRUD操作正常
- [ ] 与其他服务的集成正常

### 2. 性能验证
- [ ] 数据库连接数在正常范围内
- [ ] 查询响应时间 < 500ms
- [ ] 错误率 < 0.5%
- [ ] 系统资源使用率 < 70%

### 3. 监控验证
- [ ] 监控脚本正常运行
- [ ] 告警规则配置正确
- [ ] 日志记录完整
- [ ] 错误通知正常

## 📞 紧急联系方式

### 1. 关键联系人
- **数据库管理员**: [姓名] - [电话] - [邮箱]
- **运维团队**: [姓名] - [电话] - [邮箱]
- **开发团队**: [姓名] - [电话] - [邮箱]

### 2. 应急联系方式
- **24/7值班电话**: [电话号码]
- **应急响应邮箱**: [邮箱地址]
- **企业微信群**: [群组链接]

---

**重要提醒**: 本指南针对共享数据库环境特别制定，必须严格遵循所有安全措施。任何修改都可能导致生产服务中断，请务必谨慎操作！