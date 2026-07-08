# 数据库迁移文件优化方案

## 当前状态分析

### 1. Billing服务
**问题**：
- 存在3个迁移文件，但只有000003是完整的简化schema
- 000001和000002是旧的增量迁移，会导致表名冲突（PascalCase vs lowercase）
- internal/migrations目录有17个旧迁移文件

**优化方案**：
- ✅ 保留：`000003_create_simplified_schema.up/down.sql`（完整schema）
- ❌ 删除：`000001_initial_schema.up/down.sql`
- ❌ 删除：`000002_add_user_sync_fields.up/down.sql`
- 📁 保留internal目录作为历史参考（不参与迁移）

### 2. Adscenter服务
**问题**：
- 000001已整合所有功能，但缺少updated_at触发器
- internal/migrations目录有7个旧迁移文件

**优化方案**：
- ✅ 保留并优化：`000001_initial_schema.up/down.sql`
- 需要添加：updated_at触发器函数和触发器
- 📁 保留internal目录作为历史参考

### 3. Console服务
**问题**：
- 迁移文件引用了旧的PascalCase表名（User, Subscription, Offer等）
- 这些表现在在billing.users, billing.subscriptions, offers.offers中
- 视图需要更新以匹配新的schema结构

**优化方案**：
- ✅ 保留：000001-000004（功能独立的console表）
- ⚠️ 需要重写：000005（视图需要更新表引用）

### 4. Offer服务
**问题**：
- migrations目录为空
- offers schema已在billing/000003中定义

**优化方案**：
- ✅ 创建：`000001_initial_schema.up/down.sql`（从billing/000003提取）
- 原因：每个服务应该管理自己的schema

## 优化执行计划

### Phase 1: 清理冗余文件
```bash
# Billing服务 - 删除旧迁移
rm services/billing/migrations/000001_initial_schema.*
rm services/billing/migrations/000002_add_user_sync_fields.*

# 保留internal目录但添加README说明
```

### Phase 2: 优化Adscenter迁移
- 添加updated_at触发器函数
- 确保所有表都有触发器
- 完善down迁移

### Phase 3: 修复Console视图
- 更新000005视图以使用新的schema.table格式
- 移除对不存在表的引用
- 添加适当的schema前缀

### Phase 4: 创建Offer迁移
- 从billing/000003提取offers schema
- 创建独立的offer服务迁移文件
- 更新billing/000003移除offers部分

### Phase 5: 创建System迁移
- 从billing/000003提取system schema
- 创建独立的system迁移（可能放在console或独立服务）

## 最终迁移文件结构

```
services/
├── billing/
│   ├── migrations/
│   │   ├── 000001_create_simplified_schema.up.sql    # 重命名自000003
│   │   └── 000001_create_simplified_schema.down.sql
│   └── internal/migrations/                          # 历史参考
│       └── README.md                                 # 说明这些是历史文件
│
├── adscenter/
│   ├── migrations/
│   │   ├── 000001_initial_schema.up.sql             # 优化版本
│   │   └── 000001_initial_schema.down.sql
│   └── internal/migrations/                          # 历史参考
│       └── README.md
│
├── console/
│   └── migrations/
│       ├── 000001_create_audit_log_table.up.sql
│       ├── 000001_create_audit_log_table.down.sql
│       ├── 000002_create_token_rules_table.up.sql
│       ├── 000002_create_token_rules_table.down.sql
│       ├── 000003_create_recovery_codes_table.up.sql
│       ├── 000003_create_recovery_codes_table.down.sql
│       ├── 000004_create_export_and_feature_flags_tables.up.sql
│       ├── 000004_create_export_and_feature_flags_tables.down.sql
│       ├── 000005_create_read_only_views.up.sql     # 需要重写
│       ├── 000005_create_read_only_views.down.sql
│       └── 000006_create_system_metadata.up.sql     # 新增
│
└── offer/
    └── migrations/
        ├── 000001_initial_schema.up.sql             # 新建
        └── 000001_initial_schema.down.sql

```

## Schema所有权分配

| Schema | 所属服务 | 说明 |
|--------|---------|------|
| billing | billing | 用户、订阅、代币 |
| offers | offer | Offer管理和性能 |
| siterank | billing | 网站评估（暂时在billing，未来可独立） |
| adscenter | adscenter | Google Ads集成 |
| useractivity | billing | 用户活动（签到、推荐） |
| system | console | 系统元数据和配置 |
| public | console | Console专用表（audit_log等） |

## 迁移依赖关系

```
1. billing (000001) - 基础用户和订阅表
   ↓
2. adscenter (000001) - 依赖billing.users
   ↓
3. offer (000001) - 依赖billing.users
   ↓
4. console (000001-000006) - 独立表 + 视图（依赖其他服务）
```

## 验证清单

- [ ] 所有迁移文件都有对应的down文件
- [ ] 没有重复的表定义
- [ ] 外键引用正确（schema.table格式）
- [ ] 索引命名一致（idx_tablename_column）
- [ ] 触发器完整（updated_at）
- [ ] 约束合理（CHECK, UNIQUE, NOT NULL）
- [ ] 注释完整（COMMENT ON）
- [ ] 迁移顺序正确（依赖关系）

## 执行建议

1. **先在测试环境验证**
2. **使用complete-database-reset.sh清空数据库**
3. **按顺序执行新的迁移文件**
4. **验证所有表和索引创建成功**
5. **运行应用测试确保功能正常**
