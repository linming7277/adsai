# 服务代码更新指南

## 更新时间
2025-10-21

## 目标
更新服务代码以使用新的schema.table格式，移除自定义DDL函数

## 已完成的更新

### 1. Useractivity服务 ✅

#### 移除ensureDDL函数
**文件**: `services/useractivity/cmd/useractivity/main.go`

**变更**:
- ❌ 删除了 `ensureDDL()` 函数（约120行代码）
- ✅ 添加了注释说明schema由迁移文件管理

**原因**:
- ensureDDL函数绕过了迁移系统
- 表定义应该只在迁移文件中维护
- 避免代码和迁移文件不一致

---

## 需要更新的代码

### 2. Useractivity服务 - 表名更新 🔧

#### 问题
代码中使用的表名与迁移文件不一致：

| 代码中的表名 | 迁移文件中的表名 | 状态 |
|-------------|----------------|------|
| `checkins` | `useractivity.checkins` | ⚠️ 需要添加schema前缀 |
| `referrals` | `useractivity.referrals` | ⚠️ 需要添加schema前缀 |
| `user_notifications` | `useractivity.notifications` | ⚠️ 表名不同 |
| `user_notification_state` | `useractivity.user_notification_state` | ⚠️ 需要添加schema前缀 |
| `user_checkin_stats` | `useractivity.user_checkin_stats` | ⚠️ 需要添加schema前缀 |
| `referral_records` | `useractivity.referral_records` | ⚠️ 需要添加schema前缀 |
| `trial_subscriptions` | `billing.trial_subscriptions` | ⚠️ 需要添加schema前缀 |

#### 需要更新的文件

##### services/useractivity/internal/handlers/checkin.go

**当前代码**:
```go
_, err = tx.QueryRowContext(ctx, `
    SELECT 
        last_checkin_at,
        total_checkins,
        current_streak,
        longest_streak,
        tokens_earned
    FROM checkins
    WHERE user_id = $1
    FOR UPDATE
`, userID).Scan(...)
```

**应该改为**:
```go
_, err = tx.QueryRowContext(ctx, `
    SELECT 
        last_checkin_at,
        total_checkins,
        current_streak,
        longest_streak,
        tokens_earned
    FROM useractivity.checkins
    WHERE user_id = $1
    FOR UPDATE
`, userID).Scan(...)
```

**所有需要更新的SQL查询**:
1. `FROM checkins` → `FROM useractivity.checkins`
2. `UPDATE checkins` → `UPDATE useractivity.checkins`
3. `INSERT INTO checkins` → `INSERT INTO useractivity.checkins`
4. `INSERT INTO user_checkin_stats` → `INSERT INTO useractivity.user_checkin_stats`

---

##### services/useractivity/internal/handlers/referral.go

**需要更新的SQL查询**:
1. `FROM referrals` → `FROM useractivity.referrals`
2. `UPDATE referrals` → `UPDATE useractivity.referrals`
3. `INSERT INTO referrals` → `INSERT INTO useractivity.referrals`
4. `FROM referral_records` → `FROM useractivity.referral_records`
5. `INSERT INTO referral_records` → `INSERT INTO useractivity.referral_records`
6. `FROM trial_subscriptions` → `FROM billing.trial_subscriptions`
7. `INSERT INTO trial_subscriptions` → `INSERT INTO billing.trial_subscriptions`

---

##### services/useractivity/internal/events/subscriber.go

**需要更新的SQL查询**:
1. `FROM user_notifications` → `FROM useractivity.notifications`
2. `INSERT INTO user_notifications` → `INSERT INTO useractivity.notifications`

---

##### services/useractivity/cmd/useractivity/main.go

**需要更新的表验证**:
```go
// 当前代码
func verifyRequiredTables(db *sql.DB) error {
    requiredTables := []string{
        "user_notifications",
        "checkins",
        "referrals",
    }
    // ...
}
```

**应该改为**:
```go
func verifyRequiredTables(db *sql.DB) error {
    requiredTables := []string{
        "useractivity.notifications",
        "useractivity.checkins",
        "useractivity.referrals",
        "useractivity.user_notification_state",
        "useractivity.user_checkin_stats",
        "useractivity.referral_records",
        "billing.trial_subscriptions",
    }
    // ...
}
```

---

### 3. Siterank服务 - 测试代码更新 🔧

#### 问题
测试代码使用旧的PascalCase表名

#### 需要更新的文件

##### services/siterank/integration_test.go

**当前代码**:
```go
_, err = db.Exec(`
    INSERT INTO "User" (id, email, created_at, updated_at) 
    VALUES ($1, $2, NOW(), NOW())
`, userID, userID+"@test.com")

_, err = db.Exec(`
    INSERT INTO "SiterankAnalysis" (id, user_id, domain, status, score, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
`, analysisID, userID, "example.com", "pending", 0)
```

**应该改为**:
```go
_, err = db.Exec(`
    INSERT INTO billing.users (id, email, created_at, updated_at) 
    VALUES ($1, $2, NOW(), NOW())
`, userID, userID+"@test.com")

_, err = db.Exec(`
    INSERT INTO siterank.analyses (id, user_id, domain, status, score, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
`, analysisID, userID, "example.com", "pending", 0)
```

**所有需要更新的表名**:
1. `"User"` → `billing.users`
2. `"SiterankAnalysis"` → `siterank.analyses`
3. `domain_cache` → `siterank.domain_cache`

---

## 更新步骤

### Step 1: 批量查找替换

使用以下命令查找所有需要更新的位置：

```bash
# Useractivity服务
cd services/useractivity
grep -r "FROM checkins" --include="*.go"
grep -r "FROM referrals" --include="*.go"
grep -r "FROM user_notifications" --include="*.go"
grep -r "FROM trial_subscriptions" --include="*.go"
grep -r "INSERT INTO checkins" --include="*.go"
grep -r "UPDATE checkins" --include="*.go"

# Siterank服务
cd services/siterank
grep -r '"User"' --include="*.go"
grep -r '"SiterankAnalysis"' --include="*.go"
grep -r 'domain_cache' --include="*.go"
```

### Step 2: 逐个文件更新

对每个文件：
1. 打开文件
2. 查找所有SQL查询
3. 添加schema前缀
4. 更新表名（如果需要）
5. 保存文件

### Step 3: 运行测试

```bash
# Useractivity服务测试
cd services/useractivity
go test ./... -v

# Siterank服务测试
cd services/siterank
go test ./... -v
```

### Step 4: 验证数据库访问

```bash
# 启动服务并检查日志
# 确保没有"table not found"错误
```

---

## 更新模板

### SQL查询更新模板

**Before**:
```go
db.Query("SELECT * FROM table_name WHERE ...")
```

**After**:
```go
db.Query("SELECT * FROM schema.table_name WHERE ...")
```

### 表名映射

| 旧表名 | 新表名 | Schema |
|--------|--------|--------|
| checkins | checkins | useractivity |
| referrals | referrals | useractivity |
| user_notifications | notifications | useractivity |
| user_notification_state | user_notification_state | useractivity |
| user_checkin_stats | user_checkin_stats | useractivity |
| referral_records | referral_records | useractivity |
| trial_subscriptions | trial_subscriptions | billing |
| User | users | billing |
| SiterankAnalysis | analyses | siterank |
| domain_cache | domain_cache | siterank |

---

## 验证清单

更新完成后，验证以下内容：

- [ ] 所有SQL查询都使用schema.table格式
- [ ] 没有使用PascalCase表名
- [ ] 所有测试通过
- [ ] 服务启动无错误
- [ ] 数据库操作正常
- [ ] 日志中没有"table not found"错误

---

## 注意事项

### 1. 字段名保持不变
只更新表名，不要更新字段名。例如：
- ✅ `useractivity.checkins` 表中的字段仍然是 `user_id`, `last_checkin_at` 等
- ❌ 不要改为 `userId`, `lastCheckinAt`（除非迁移文件中也这样定义）

### 2. 事务中的表名
在事务中也要使用完整的schema.table格式：
```go
tx.Exec("UPDATE useractivity.checkins SET ...")
```

### 3. 测试数据清理
测试代码中的清理语句也要更新：
```go
defer db.Exec("DELETE FROM useractivity.checkins WHERE user_id = $1", testUserID)
```

### 4. 错误处理
更新后可能遇到的错误：
- `relation "checkins" does not exist` → 需要添加schema前缀
- `schema "useractivity" does not exist` → 需要先运行迁移

---

## 相关文档

- [迁移文件总结](./MIGRATION_FILES_SUMMARY.md)
- [新增表说明](./MIGRATION_TABLES_ADDED.md)
- [缺失迁移分析](./MISSING_MIGRATIONS_ANALYSIS.md)

---

## 总结

代码更新的核心原则：
1. ✅ 所有表名使用 `schema.table` 格式
2. ✅ 移除自定义DDL函数
3. ✅ 表定义只在迁移文件中维护
4. ✅ 代码只负责业务逻辑，不负责schema管理

完成这些更新后，服务代码将与迁移文件完全一致，便于维护和部署。
