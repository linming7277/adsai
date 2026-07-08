# UserActivity服务测试报告

## 测试时间
2025-10-18

## 服务部署状态

### ✅ Cloud Run服务状态
- **服务名称**: useractivity-preview
- **服务URL**: https://useractivity-preview-yt54xvsg5q-an.a.run.app
- **部署区域**: asia-northeast1
- **状态**: 运行中

### ❌ 数据库配置问题
从服务日志发现关键错误：
```
2025/10/18 15:15:46.966471Z  Initial trial expiration check failed: pq: column "userId" does not exist
```

**问题分析**:
1. useractivity服务配置使用Cloud SQL PostgreSQL (autoads_db)
2. 服务启动时自动创建表的逻辑存在，但表结构可能不完整
3. trial_subscriptions表中的列名使用了双引号("userId")，但查询时使用未引用的userId

## 数据库架构验证

### Supabase PostgreSQL (用户认证数据库)
- **连接**: postgresql://postgres.jzzvizacfyipzdyiqfzb:*HF#9dFnzV5DBA.@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
- **状态**: ❌ 缺少useractivity相关表
- **缺失表**: user_notifications, checkins, user_checkin_stats, referrals, referral_records, trial_subscriptions, notification_rules, event_store

### Cloud SQL PostgreSQL (应用数据数据库)
- **连接**: postgresql://postgres:***@10.6.0.2:5432/autoads_db (通过VPC Connector)
- **状态**: 🔍 需要验证表结构
- **预期表**: useractivity服务相关表应该在此数据库中

## 服务功能验证

### API端点设计 (基于代码分析)
✅ **已实现的通知API端点**:
- `GET /api/v1/notifications/recent` - 获取最近通知
- `GET /api/v1/notifications/stream` - SSE实时通知流
- `POST /api/v1/notifications/read` - 标记已读
- `GET /api/v1/notifications/unread-count` - 获取未读数量
- `DELETE /api/v1/notifications/{id}` - 删除通知
- `GET /api/v1/notifications/risk/preview` - 风险评估预览
- `POST /api/v1/notifications/risk/evaluate` - 风险评估执行
- `POST /api/v1/notifications/admin/alert` - 管理员告警

### 数据库表结构 (代码中的ensureDDL)
✅ **核心通知表**:
```sql
user_notifications (id, user_id, type, title, message, created_at)
user_notification_state (user_id, last_read_id, updated_at)
```

✅ **签到系统表**:
```sql
checkins (id, "userId", "lastCheckinAt", "totalCheckins", "currentStreak", "longestStreak", "tokensEarned", "createdAt", "updatedAt")
user_checkin_stats (id, "userId", "checkinDate", "tokensEarned", "streakDay", "createdAt")
```

✅ **推荐系统表**:
```sql
referrals (id, "userId", referralCode, totalReferrals, successfulReferrals, totalRewards, "createdAt", "updatedAt")
referral_records (id, "inviterId", "inviteeId", referralCode, status, rewardAmount, rewardGranted, "createdAt", "completedAt")
```

✅ **试用订阅表** (可能已废弃):
```sql
trial_subscriptions (id, "userId", trialType, startDate, endDate, daysGranted, source, referralId, isActive, "createdAt")
```

## 前端集成状态

### ✅ 前端通知组件完整
- **NotificationsPopover.tsx**: 通知弹窗组件
- **useNotifications hook**: SWR数据获取，60秒自动刷新
- **API端点配置**: 已修复endpoints.ts中缺失的通知端点

### ✅ API调用路径
- 前端调用: `/api/v1/notifications/recent?limit=20`
- 后端路由: useractivity服务 → `/api/v1/notifications/recent`
- 数据库: Cloud SQL autoads_db.user_notifications表

## 修复建议

### 1. 立即修复 - 数据库表创建
创建数据库初始化脚本，在Cloud SQL autoads_db中创建所需表：
```sql
-- 已创建 /scripts/fix-useractivity-db.sql
-- 包含所有必需的表结构和索引
-- 添加了测试数据用于验证
```

### 2. 部署修复流程
1. 手动执行SQL脚本创建表结构
2. 重新部署useractivity服务
3. 验证服务健康状态
4. 测试通知API端点
5. 验证前端集成

### 3. 长期优化
- 将数据库DDL移到独立迁移文件
- 实现数据库版本管理
- 添加健康检查端点验证数据库连接
- 实现数据库连接池监控

## 下一步行动

1. **立即**: 执行数据库表创建脚本
2. **短期**: 重新部署并测试useractivity服务
3. **中期**: 验证端到端通知功能
4. **长期**: 优化数据库管理和监控

## 状态总结

- ❌ **useractivity服务**: 运行中但数据库表缺失
- ✅ **前端组件**: 完整且配置正确
- ✅ **API设计**: 功能完整
- ⚠️ **数据库**: 需要创建表结构
- ⚠️ **端到端测试**: 需要数据库修复后进行

**总体评估**: 系统架构设计正确，实现基本完整，主要问题集中在数据库表结构创建，修复后应该能够正常运行。