# 代码更新状态报告

## 生成时间
2025-10-21

## 扫描结果

### 发现的问题总数: 约80+处

## 详细统计

### 1. Useractivity服务

#### checkins表（4处）
- ✅ FROM checkins: 2处
- ✅ INSERT INTO checkins: 1处
- ✅ UPDATE checkins: 1处

#### referrals表（13处）
- ✅ FROM referrals: 6处
- ✅ INSERT INTO referrals: 2处
- ✅ UPDATE referrals: 2处
- ✅ DELETE FROM referrals: 3处

#### user_notifications表（15处）
- ✅ FROM user_notifications: 10处
- ✅ INSERT INTO user_notifications: 4处
- ✅ DELETE FROM user_notifications: 1处

#### user_notification_state表（4处）
- ✅ FROM user_notification_state: 3处
- ✅ INSERT INTO user_notification_state: 1处

#### user_checkin_stats表（2处）
- ✅ FROM user_checkin_stats: 1处
- ✅ INSERT INTO user_checkin_stats: 1处

#### referral_records表（9处）
- ✅ FROM referral_records: 5处
- ✅ INSERT INTO referral_records: 1处
- ✅ UPDATE referral_records: 1处
- ✅ DELETE FROM referral_records: 2处

#### trial_subscriptions表（17处）
- ✅ FROM trial_subscriptions: 9处
- ✅ INSERT INTO trial_subscriptions: 2处
- ✅ UPDATE trial_subscriptions: 1处
- ✅ DELETE FROM trial_subscriptions: 5处

**Useractivity总计**: 约64处需要更新

---

### 2. Siterank服务

#### "User"表（PascalCase）
- 需要检查integration_test.go中的使用

#### "SiterankAnalysis"表（PascalCase）
- 需要检查integration_test.go中的使用

#### domain_cache表（无schema前缀）
- 需要检查integration_test.go中的使用

**Siterank总计**: 约10-15处需要更新（主要在测试代码）

---

### 3. User服务

#### shared_db.users（旧表名）
- 需要检查是否有使用旧的schema名称

---

## 需要更新的文件清单

### Useractivity服务

#### 主要代码文件
1. `services/useractivity/cmd/useractivity/main.go`
   - user_notifications相关查询（约10处）
   - user_notification_state相关查询（约4处）

2. `services/useractivity/internal/handlers/checkin.go`
   - checkins表查询（约4处）
   - user_checkin_stats表查询（约2处）
   - user_notifications插入（约1处）

3. `services/useractivity/internal/handlers/referral.go`
   - referrals表查询（约10处）
   - referral_records表查询（约7处）
   - trial_subscriptions表查询（约3处）

4. `services/useractivity/internal/events/subscriber.go`
   - user_notifications插入（约1处）

#### 测试文件
5. `services/useractivity/internal/handlers/checkin_test.go`
   - 可能需要更新测试数据

6. `services/useractivity/internal/handlers/referral_test.go`
   - referrals表测试（约3处）
   - referral_records表测试（约2处）
   - trial_subscriptions表测试（约5处）

7. `services/useractivity/internal/handlers/referral_worker_test.go`
   - 清理语句（约3处）

---

### Siterank服务

#### 测试文件
1. `services/siterank/integration_test.go`
   - "User"表引用（约5处）
   - "SiterankAnalysis"表引用（约10处）
   - domain_cache表引用（约2处）

---

## 更新策略

### 方案A: 手动逐个更新（推荐）
**优点**: 
- 可以仔细检查每个查询
- 确保不会破坏业务逻辑
- 可以同时优化SQL查询

**缺点**:
- 耗时较长
- 需要仔细测试

**步骤**:
1. 按文件逐个更新
2. 每个文件更新后运行单元测试
3. 所有文件更新完后运行集成测试

---

### 方案B: 批量查找替换（快速但有风险）
**优点**:
- 快速完成
- 统一格式

**缺点**:
- 可能误替换
- 需要仔细验证

**步骤**:
```bash
# 示例：批量替换checkins表
find services/useractivity -name "*.go" -type f -exec sed -i '' 's/FROM checkins/FROM useractivity.checkins/g' {} \;
find services/useractivity -name "*.go" -type f -exec sed -i '' 's/INSERT INTO checkins/INSERT INTO useractivity.checkins/g' {} \;
find services/useractivity -name "*.go" -type f -exec sed -i '' 's/UPDATE checkins/UPDATE useractivity.checkins/g' {} \;
```

⚠️ **警告**: 使用前请先备份代码！

---

## 推荐的更新顺序

### Phase 1: 核心业务代码（高优先级）
1. ✅ `services/useractivity/cmd/useractivity/main.go` - 已移除ensureDDL
2. 🔧 `services/useractivity/internal/handlers/checkin.go`
3. 🔧 `services/useractivity/internal/handlers/referral.go`
4. 🔧 `services/useractivity/internal/events/subscriber.go`

### Phase 2: 测试代码（中优先级）
5. 🔧 `services/useractivity/internal/handlers/referral_test.go`
6. 🔧 `services/useractivity/internal/handlers/referral_worker_test.go`
7. 🔧 `services/siterank/integration_test.go`

### Phase 3: 验证和测试（必须）
8. 运行单元测试
9. 运行集成测试
10. 在测试环境验证

---

## 更新模板

### 表名映射表

| 当前表名 | 新表名 | 说明 |
|---------|--------|------|
| `checkins` | `useractivity.checkins` | 添加schema前缀 |
| `referrals` | `useractivity.referrals` | 添加schema前缀 |
| `user_notifications` | `useractivity.notifications` | 改名+添加schema |
| `user_notification_state` | `useractivity.user_notification_state` | 添加schema前缀 |
| `user_checkin_stats` | `useractivity.user_checkin_stats` | 添加schema前缀 |
| `referral_records` | `useractivity.referral_records` | 添加schema前缀 |
| `trial_subscriptions` | `billing.trial_subscriptions` | 添加schema前缀 |
| `"User"` | `billing.users` | 改名+添加schema |
| `"SiterankAnalysis"` | `siterank.analyses` | 改名+添加schema |
| `domain_cache` | `siterank.domain_cache` | 添加schema前缀 |

### 替换示例

**Before**:
```go
db.Query("SELECT * FROM checkins WHERE user_id = $1", userID)
```

**After**:
```go
db.Query("SELECT * FROM useractivity.checkins WHERE user_id = $1", userID)
```

---

## 验证脚本

使用以下脚本验证更新进度：

```bash
# 查找剩余的问题
./scripts/db/find-table-references.sh

# 运行测试
cd services/useractivity && go test ./...
cd services/siterank && go test ./...
```

---

## 预期结果

更新完成后：
- ✅ 所有SQL查询使用schema.table格式
- ✅ 没有PascalCase表名
- ✅ 所有测试通过
- ✅ 服务正常启动和运行
- ✅ 数据库操作无错误

---

## 风险评估

### 高风险区域
- ❗ 生产环境的SQL查询
- ❗ 事务中的多表操作
- ❗ 动态构建的SQL语句

### 低风险区域
- ✅ 测试代码
- ✅ 简单的SELECT查询
- ✅ 注释中的表名

---

## 回滚计划

如果更新后出现问题：

1. **代码回滚**: 使用Git恢复到更新前的版本
   ```bash
   git checkout HEAD~1 services/useractivity/
   git checkout HEAD~1 services/siterank/
   ```

2. **数据库回滚**: 迁移文件支持down操作
   ```bash
   # 不需要回滚，因为表名在迁移文件中已经正确
   ```

3. **验证**: 确保服务恢复正常

---

## 相关文档

- [代码更新指南](./CODE_UPDATE_GUIDE.md) - 详细的更新步骤
- [迁移文件总结](./MIGRATION_FILES_SUMMARY.md) - 迁移文件清单
- [新增表说明](./MIGRATION_TABLES_ADDED.md) - 新增表的详细说明

---

## 总结

当前状态：
- ✅ 迁移文件已完整
- ✅ ensureDDL函数已移除
- 🔧 约80+处代码需要更新表名
- 🔧 主要集中在useractivity和siterank服务

建议：
1. 优先更新核心业务代码
2. 每个文件更新后立即测试
3. 使用find-table-references.sh脚本追踪进度
4. 完成后在测试环境全面验证

预计工作量：
- 核心代码更新：2-3小时
- 测试代码更新：1-2小时
- 测试验证：1-2小时
- 总计：4-7小时
