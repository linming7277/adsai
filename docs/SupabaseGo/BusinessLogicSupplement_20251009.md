# 业务逻辑补充说明

本文档总结了 2025-10-09 补充的三个新业务逻辑，已完整集成到 `FrontendDesignComplete_20251009.md` 第 21 章节。

---

## 一、签到奖励机制（简化版）

### 1.1 奖励规则

| 签到类型 | 奖励 Token | 说明 |
|---------|-----------|------|
| **每日签到** | 10 | 每天签到基础奖励 |
| **连续 7 天** | +50 | 额外奖励（累加） |
| **连续 14 天** | +80 | 额外奖励（累加） |
| **连续 30 天** | +120 | 额外奖励（累加） |

**示例**：
- 第 1 天签到：获得 10 Token
- 第 7 天签到：获得 10 + 50 = 60 Token
- 第 14 天签到：获得 10 + 80 = 90 Token
- 第 30 天签到：获得 10 + 120 = 130 Token
- 断签后重新计算连续天数

### 1.2 数据库设计

新增表：`UserCheckin`
- `user_id`：用户 ID（外键）
- `checkin_date`：签到日期（唯一约束：user_id + checkin_date）
- `tokens_earned`：基础 Token（10）
- `bonus_tokens`：额外奖励 Token（0/50/80/120）
- `current_streak`：当前连续签到天数
- `milestone`：达成的里程碑（如 "连续签到 7 天"）

User 表新增字段：
- `current_checkin_streak`：当前连续签到天数
- `last_checkin_date`：上次签到日期
- `total_checkin_days`：累计签到天数

### 1.3 前端实现

**API 端点**：`POST /api/user/checkin`

**Checkin Tab 组件**：
- 显示当前连续签到天数（大字号 + 火焰图标）
- 签到按钮（已签到时禁用并显示"已签到"）
- 签到奖励规则卡片（4 级奖励，已达成的高亮显示）
- 签到日历（标记所有历史签到日期）
- 累计签到天数统计

**交互逻辑**：
1. 用户点击"立即签到"
2. 后端计算连续天数和奖励
3. Toast 提示签到成功 + Token 数量
4. 如果达成里程碑，显示额外庆祝提示
5. 更新本地状态，按钮变为"已签到"

---

## 二、邀请机制

### 2.1 邀请奖励规则

| 角色 | 场景 | 奖励 |
|------|------|------|
| **新用户** | 直接注册（无邀请码） | 14 天 Pro 套餐试用 |
| **被邀请者** | 通过邀请链接注册 | 30 天 Pro 套餐试用（覆盖默认 14 天） |
| **邀请者** | 被邀请者成功注册 | 30 天 Pro 套餐（可无限累加） |

**关键逻辑**：
- 邀请码在用户注册时自动生成（唯一且永久不变）
- 邀请链接格式：`https://autoads.com/auth/sign-up?ref=A1B2C3D4E5F6`
- 被邀请者的 30 天试用**不与**默认 14 天叠加（取最大值）
- 邀请者的 30 天奖励**可以**多次累加（邀请 5 人 = 150 天）

**示例场景**：

**场景 1**：小明直接注册
- 小明获得：14 天 Pro 试用 + 唯一邀请码 `MING12345678`

**场景 2**：小红通过小明的邀请链接注册
- 小红获得：30 天 Pro 试用（覆盖默认 14 天）
- 小明获得：30 天 Pro 套餐（立即到账）

**场景 3**：小明邀请了 10 个人成功注册
- 小明累计获得：10 × 30 = 300 天 Pro 套餐

### 2.2 数据库设计

新增表：

**UserReferralCode** （用户邀请码表）
- `user_id`：用户 ID（唯一）
- `referral_code`：邀请码（12 位大写字母+数字，全局唯一）
- `total_invites`：总邀请数
- `successful_invites`：成功邀请数
- `total_rewards_days`：累计获得天数

**ReferralRecord** （邀请记录表）
- `referrer_id`：邀请者 ID
- `referee_id`：被邀请者 ID（唯一约束，一个用户只能被邀请一次）
- `referral_code`：使用的邀请码
- `referee_reward_days`：被邀请者获得天数（30）
- `referrer_reward_days`：邀请者获得天数（30）
- `status`：状态（pending/completed）
- `completed_at`：完成时间

User 表新增字段：
- `subscription_tier`：订阅套餐（trial/pro/max/elite）
- `subscription_start_date`：订阅开始日期
- `subscription_end_date`：订阅结束日期
- `trial_end_date`：试用结束日期
- `referred_by`：被谁邀请（外键）

### 2.3 邀请码生成算法

```typescript
// 生成 12 位唯一邀请码
function generateReferralCode(userId: string): string {
  // 用户 ID 前 8 位（去掉连字符） + 4 位随机字符
  const userPart = userId.replace(/-/g, '').substring(0, 8).toUpperCase();
  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  
  return `${userPart}${randomPart}`; // 例如：A1B2C3D4E5F6
}
```

### 2.4 注册流程集成

**URL 格式**：`/auth/sign-up?ref=A1B2C3D4E5F6`

**注册流程**：
1. 前端从 URL 提取 `ref` 参数
2. 如果有邀请码，显示"恭喜获得 30 天试用"提示
3. 提交注册时携带邀请码
4. 后端验证邀请码有效性
5. 创建用户 + 生成新用户的邀请码
6. 如果有邀请码：
   - 被邀请者获得 30 天试用
   - 创建邀请记录（status=pending）
   - 标记邀请记录为完成（status=completed）
   - 邀请者立即获得 30 天 Pro 套餐

### 2.5 前端实现

**Referral Tab 组件**包含：

1. **邀请统计卡片**（3 个 KPI）
   - 成功邀请人数
   - 累计获得天数
   - 待确认邀请数

2. **邀请链接卡片**
   - 显示完整邀请链接（只读输入框）
   - 一键复制按钮
   - 分享到社交平台按钮（Twitter/Facebook/LinkedIn/Email）

3. **邀请奖励规则卡片**
   - 3 条规则说明（带序号和图标）
   - 举例说明：邀请 5 人 = 150 天

4. **邀请记录列表**
   - 显示所有历史邀请（成功/待确认）
   - 每条记录显示：被邀请者名称、注册日期、状态、奖励天数
   - 空状态提示：分享邀请链接

**API 端点**：`GET /api/user/referral`

返回数据：
```json
{
  "referralCode": "A1B2C3D4E5F6",
  "successfulInvites": 5,
  "totalRewardsDays": 150,
  "pendingInvites": 1,
  "referralRecords": [
    {
      "id": "uuid",
      "refereeName": "小红",
      "refereeEmail": "xiaohong@example.com",
      "status": "completed",
      "referrerRewardDays": 30,
      "createdAt": "2025-10-01T12:00:00Z",
      "completedAt": "2025-10-01T12:05:00Z"
    }
  ]
}
```

---

## 三、个人中心邀请模块设计

### 3.1 Tab 布局

User Info 页面包含 5 个 Tab：
1. Profile（个人信息）
2. Subscription（订阅管理）
3. Tokens（Token 管理）
4. **Referral（邀请好友）** ← 新增详细设计
5. Checkin（每日签到）

### 3.2 Referral Tab 布局结构

```
┌─────────────────────────────────────────────────┐
│  [统计卡片区域]                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │成功邀请5 │ │获得150天 │ │待确认 1  │        │
│  └──────────┘ └──────────┘ └──────────┘        │
├─────────────────────────────────────────────────┤
│  [邀请链接卡片]                                   │
│  你的专属邀请链接                                 │
│  ┌────────────────────────────────┬──────┐     │
│  │ https://autoads.com/...ref=... │ 复制 │     │
│  └────────────────────────────────┴──────┘     │
│  [Twitter] [Facebook] [LinkedIn] [Email]        │
├─────────────────────────────────────────────────┤
│  [邀请奖励规则卡片]                               │
│  ① 新用户注册：14 天试用                          │
│  ② 通过邀请注册：30 天试用                        │
│  ③ 邀请者奖励：30 天 Pro 套餐（可累加）           │
│  💡 举例：邀请 5 人 = 150 天                     │
├─────────────────────────────────────────────────┤
│  [邀请记录列表]                                   │
│  ┌───────────────────────────────────────┐     │
│  │ ✓ 小红  2025-10-01  已到账 +30 天     │     │
│  │ ⏳ 小明  2025-10-08  待确认            │     │
│  └───────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

### 3.3 核心功能

1. **邀请链接永久不变**
   - 用户注册时生成唯一邀请码
   - 邀请码存储在 `UserReferralCode` 表
   - 永不过期，永不改变

2. **历史邀请记录**
   - 显示所有通过该用户邀请码注册的用户
   - 状态分为：已完成（绿色勾）、待确认（橙色时钟）
   - 按注册时间倒序排列

3. **获取的奖励**
   - 实时统计累计获得天数
   - 每条记录显示具体奖励天数（+30 天）
   - 已到账/待确认状态标识

4. **分享功能**
   - 一键复制邀请链接
   - 分享到社交平台（预填邀请文案）
   - 邮件分享（自动生成邮件主题和正文）

---

## 四、实施优先级

### P0（高优先级）
- [x] 签到奖励数据表设计
- [x] 签到 API 实现
- [x] Checkin Tab 组件
- [x] 邀请机制数据表设计
- [x] 邀请码生成工具
- [x] 注册流程集成邀请码
- [x] Referral Tab 组件

### P1（中优先级）
- [ ] 签到提醒通知
- [ ] 邀请成功推送通知
- [ ] 邀请排行榜（可选）
- [ ] 邀请活动页面（可选）

### P2（低优先级）
- [ ] 签到动画效果优化
- [ ] 邀请海报生成器
- [ ] 社交媒体分享卡片优化

---

## 五、API 端点总结

| 端点 | 方法 | 功能 | 请求体 | 响应体 |
|------|------|------|--------|--------|
| `/api/user/checkin` | POST | 用户签到 | 无 | `{ tokensEarned, currentStreak, milestone }` |
| `/api/user/referral` | GET | 获取邀请数据 | 无 | `{ referralCode, successfulInvites, ... }` |
| `/api/auth/signup` | POST | 用户注册 | `{ email, password, name, referralCode }` | `{ userId, trialDays, referralCode }` |

---

## 六、数据库表总结

### 新增表（3 个）

1. **UserCheckin**（用户签到记录）
   - 记录每日签到
   - 计算连续天数和奖励

2. **UserReferralCode**（用户邀请码）
   - 存储用户唯一邀请码
   - 统计邀请数据

3. **ReferralRecord**（邀请记录）
   - 记录每次邀请关系
   - 跟踪奖励发放状态

### User 表新增字段（10 个）

签到相关：
- `current_checkin_streak`
- `last_checkin_date`
- `total_checkin_days`

订阅相关：
- `subscription_tier`
- `subscription_start_date`
- `subscription_end_date`
- `trial_end_date`

邀请相关：
- `referred_by`

---

## 七、前端组件更新

### 新增组件
- 无（复用现有组件）

### 更新组件
1. `Checkin Tab`（apps/frontend/src/components/userinfo/checkin-tab.tsx）
   - 简化奖励规则显示
   - 添加里程碑达成庆祝动画

2. `Referral Tab`（apps/frontend/src/components/userinfo/referral-tab.tsx）
   - 完全重写
   - 添加邀请链接卡片
   - 添加奖励规则说明
   - 添加邀请记录列表

3. `SignUp Page`（apps/frontend/src/app/auth/sign-up/page.tsx）
   - 集成邀请码参数
   - 显示邀请奖励提示

---

## 八、测试清单

### 签到功能测试
- [ ] 首次签到获得 10 Token
- [ ] 连续 7 天签到获得 60 Token
- [ ] 连续 14 天签到获得 90 Token
- [ ] 连续 30 天签到获得 130 Token
- [ ] 断签后重新计算连续天数
- [ ] 同一天不能重复签到
- [ ] Token 余额正确更新

### 邀请功能测试
- [ ] 新用户注册自动生成唯一邀请码
- [ ] 邀请码全局唯一性验证
- [ ] 新用户默认获得 14 天试用
- [ ] 通过邀请链接注册获得 30 天试用（覆盖 14 天）
- [ ] 邀请者立即获得 30 天 Pro 套餐
- [ ] 多次邀请奖励正确累加
- [ ] 邀请记录状态正确更新
- [ ] 邀请链接复制功能
- [ ] 社交分享功能

---

## 九、成功指标

### 签到指标
| 指标 | 目标值 |
|------|--------|
| 日活跃签到率 | > 30% |
| 7 天连续签到率 | > 15% |
| 30 天连续签到率 | > 5% |
| 平均签到天数 | > 10 天/月 |

### 邀请指标
| 指标 | 目标值 |
|------|--------|
| 邀请链接分享率 | > 20% |
| 邀请转化率 | > 10% |
| 平均每用户邀请数 | > 0.5 |
| 通过邀请注册占比 | > 25% |

---

## 十、文档位置

完整实现代码已集成到：
**`/Users/jason/Documents/Kiro/autoads/docs/SupabaseGo/FrontendDesignComplete_20251009.md`**

**章节位置**：第 21 章 - 补充业务逻辑详细设计
- 21.1 签到奖励机制完整设计
- 21.2 邀请机制完整设计
- 21.3 数据查询 API

**总行数**：8,728 行

---

生成日期：2025-10-09
