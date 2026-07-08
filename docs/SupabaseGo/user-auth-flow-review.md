# AdsAI 用户注册/登录流程 Review报告

**版本**: V1.0
**日期**: 2025-10-17
**状态**: 代码Review完成

---

## 一、现有流程分析

### 1.1 Google OAuth登录流程

#### ✅ 前端实现（已完成）

**入口**: `/auth` 页面
- 文件: `apps/frontend/src/app/auth/page.tsx`
- 支持referralCode参数（`?ref=xxx` 或 `?referralCode=xxx`）
- 支持returnUrl参数（`?next=/xxx`）

**OAuth组件**: `OAuthProviders.tsx`
- 配置: 仅支持Google OAuth（`configuration.auth.providers.oAuth = ['google']`）
- 回调URL构建逻辑:
  ```typescript
  const redirectTo = `${origin}/auth/callback?next=${returnUrl}&referralCode=${referralCode}`;
  ```

**OAuth回调处理**: `/auth/callback/route.ts`
```typescript
export async function GET(request: NextRequest) {
  // 1. 获取OAuth code
  const authCode = searchParams.get('code');
  const referralCode = searchParams.get('referralCode');
  
  // 2. 交换code为session
  const { data } = await client.auth.exchangeCodeForSession(authCode);
  userId = data.user.id;
  
  // 3. 等待Supabase触发器创建用户数据（最多3秒）
  const userData = await waitForUserCreation(client, userId, 3000);
  
  // 4. 判断是否新用户（创建时间<10秒）
  const isNewUser = (Date.now() - userCreatedAt.getTime()) < 10000;
  
  // 5. 新用户处理
  if (isNewUser) {
    if (referralCode) {
      // 邀请注册：调用 /api/v1/referral/track
      await fetch('/api/v1/referral/track', {
        method: 'POST',
        body: JSON.stringify({ referralCode, newUserId: userId })
      });
    } else {
      // 自注册：调用 /api/v1/trial/create
      await fetch('/api/v1/trial/create', {
        method: 'POST',
        body: JSON.stringify({ userId, days: 7, source: 'self_register' })
      });
    }
  }
  
  // 6. 跳转到Dashboard
  return redirect(nextUrl || '/dashboard');
}
```

---

### 1.2 后端API状态检查

#### ❌ 问题1: 试用订阅API不存在

**前端调用**: `POST /api/v1/trial/create`

**实际状态**: ❌ **API不存在**

**搜索结果**: 在所有后端服务中未找到此端点

**影响**: 
- 自注册用户无法获得7天试用
- 前端会记录错误但不阻塞登录
- 用户可能没有任何订阅，无法使用功能

---

#### ❌ 问题2: 邀请追踪API不存在

**前端调用**: `POST /api/v1/referral/track`

**实际状态**: ❌ **API不存在**

**搜索结果**: 在所有后端服务中未找到此端点

**影响**:
- 邀请注册无法追踪
- 邀请人和被邀请人都无法获得奖励
- 邀请功能完全失效

---

#### ❌ 问题3: Supabase触发器未验证

**前端依赖**: 
```typescript
// 等待触发器创建用户数据
const userData = await waitForUserCreation(client, userId, 3000);
```

**查询**: `SELECT * FROM users WHERE id = $1`

**未验证项**:
- [ ] Supabase是否配置了`on_auth_user_created`触发器
- [ ] 触发器是否创建`users`表记录
- [ ] 触发器是否创建`UserToken`记录
- [ ] 触发器是否创建默认`Subscription`记录

**风险**: 如果触发器不存在或失败，用户数据不完整

---

### 1.3 配置问题

#### ⚠️ 问题4: appHome路径配置错误

**配置**: `configuration.paths.appHome = '/dashboard'`

**实际路由**: 根据`COMPLETE-OPTIMIZATION-PLAN.md`，已经统一为扁平化路由
- `/offers`
- `/tasks`
- `/adscenter`
- `/dashboard` 应该是什么？

**建议**: 
- 如果`/dashboard`是BFF聚合页面，保持不变
- 如果不存在，改为`/offers`或其他实际页面

---

## 二、完整流程图

### 2.1 当前流程（含问题）

```
用户点击"Google登录"
    ↓
Google OAuth授权
    ↓
重定向到 /auth/callback?code=xxx&referralCode=yyy
    ↓
exchangeCodeForSession() → 获取userId
    ↓
等待Supabase触发器创建用户数据（3秒超时）
    ↓ (可能失败❌)
判断是否新用户（<10秒）
    ↓
├─ 有referralCode
│   └─ 调用 /api/v1/referral/track ❌ API不存在
│       └─ 失败但不阻塞
│
└─ 无referralCode
    └─ 调用 /api/v1/trial/create ❌ API不存在
        └─ 失败但不阻塞
    ↓
跳转到 /dashboard ⚠️ 路径可能不存在
```

---

## 三、需要实施的修复

### 修复 1: 实现试用订阅API（P0）

**服务**: billing或useractivity
**工作量**: 1天

#### 方案A: 在billing服务实现（推荐）

```go
// services/billing/internal/handlers/trial.go

// POST /api/v1/trial/create
func (h *Handler) CreateTrial(w http.ResponseWriter, r *http.Request) {
    var req struct {
        UserID string `json:"userId"`
        Days   int    `json:"days"`
        Source string `json:"source"` // "self_register", "referral"
    }
    
    json.NewDecoder(r.Body).Decode(&req)
    
    // 1. 检查用户是否已有订阅
    var existingCount int
    h.DB.QueryRow(r.Context(), `
        SELECT COUNT(*) FROM "Subscription"
        WHERE "userId" = $1
    `, req.UserID).Scan(&existingCount)
    
    if existingCount > 0 {
        http.Error(w, "User already has subscription", http.StatusConflict)
        return
    }
    
    // 2. 创建Pro套餐试用订阅
    trialEnds := time.Now().AddDate(0, 0, req.Days)
    subscriptionID := uuid.New().String()
    
    _, err := h.DB.Exec(r.Context(), `
        INSERT INTO "Subscription" (
            id, "userId", "planId", "planName", status,
            "trialEndsAt", "currentPeriodEnd", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, subscriptionID, req.UserID, "pro-trial", "pro",
       "trialing", trialEnds, trialEnds)
    
    if err != nil {
        http.Error(w, "Failed to create trial", http.StatusInternalServerError)
        return
    }
    
    // 3. 发放Pro套餐试用Token
    // Pro套餐月度配额：1000 tokens
    var tokens int
    if req.Days == 14 {
        // 邀请注册：14天试用，发放1000 tokens
        tokens = 1000
    } else {
        // 自注册：7天试用，发放500 tokens（按比例）
        tokens = 500
    }
    
    _, err = h.DB.Exec(r.Context(), `
        INSERT INTO "UserToken" ("userId", balance, "createdAt", "updatedAt")
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT ("userId") DO UPDATE
        SET balance = "UserToken".balance + $2,
            "updatedAt" = NOW()
    `, req.UserID, tokens)
    
    if err != nil {
        log.Printf("Failed to grant tokens: %v", err)
    }
    
    // 4. 记录Token交易
    _, _ = h.DB.Exec(r.Context(), `
        INSERT INTO "TokenTransaction" (
            id, "userId", type, amount, description, source, "createdAt"
        ) VALUES ($1, $2, 'grant', $3, $4, $5, NOW())
    `, uuid.New().String(), req.UserID, tokens,
       fmt.Sprintf("%d天Pro套餐试用", req.Days), req.Source)
    
    respondWithJSON(w, http.StatusCreated, map[string]interface{}{
        "subscriptionId": subscriptionID,
        "planName":       "pro",
        "trialEndsAt":    trialEnds,
        "trialDays":      req.Days,
        "tokens":         tokens,
    })
}
```

**注册路由**:
```go
// services/billing/main.go
r.Post("/api/v1/trial/create", apiHandler.CreateTrial)
```

---

### 修复 2: 实现邀请追踪API（P0）

**服务**: useractivity（已有referrals表）
**工作量**: 1天

```go
// services/useractivity/internal/handlers/referral.go

// POST /api/v1/referral/track
func (h *Handler) TrackReferral(w http.ResponseWriter, r *http.Request) {
    var req struct {
        ReferralCode string `json:"referralCode"`
        NewUserID    string `json:"newUserId"`
    }
    
    json.NewDecoder(r.Body).Decode(&req)
    
    // 1. 查找邀请人
    var referrerID string
    err := h.DB.QueryRow(r.Context(), `
        SELECT "userId" FROM referrals
        WHERE "referralCode" = $1
    `, req.ReferralCode).Scan(&referrerID)
    
    if err != nil {
        http.Error(w, "Invalid referral code", http.StatusNotFound)
        return
    }
    
    // 2. 记录邀请关系
    _, err = h.DB.Exec(r.Context(), `
        INSERT INTO referral_records (
            id, "referrerId", "referredUserId", "referralCode",
            status, "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, NOW())
    `, uuid.New().String(), referrerID, req.NewUserID,
       req.ReferralCode, "completed")
    
    if err != nil {
        http.Error(w, "Failed to track referral", http.StatusInternalServerError)
        return
    }
    
    // 3. 为被邀请人创建14天Pro套餐试用
    h.billingClient.CreateTrial(r.Context(), &TrialRequest{
        UserID: req.NewUserID,
        Days:   14,
        Source: "referral",
    })
    // 被邀请人将获得：14天Pro试用 + 1000 tokens
    
    // 4. 为邀请人发放奖励（100 tokens）
    h.billingClient.GrantTokens(r.Context(), &GrantRequest{
        UserID:      referrerID,
        Amount:      100,
        Source:      "referral_reward",
        Description: "邀请好友奖励",
    })
    
    // 5. 更新邀请统计
    h.DB.Exec(r.Context(), `
        UPDATE referrals
        SET "totalInvites" = "totalInvites" + 1,
            "successfulInvites" = "successfulInvites" + 1
        WHERE "userId" = $1
    `, referrerID)
    
    respondWithJSON(w, http.StatusOK, map[string]interface{}{
        "referrerId":       referrerID,
        "referredId":       req.NewUserID,
        "referredTrialDays": 14,
        "referredPlan":     "pro",
        "referredTokens":   1000,
        "referrerReward":   100,
    })
}
```

---

### 修复 3: 验证Supabase触发器（P0）

**工作量**: 0.5天

#### 3.1 检查现有触发器

```sql
-- 查询Supabase触发器
SELECT * FROM pg_trigger
WHERE tgname LIKE '%auth%' OR tgname LIKE '%user%';

-- 查询触发器函数
SELECT * FROM pg_proc
WHERE proname LIKE '%handle%user%';
```

#### 3.2 创建缺失的触发器

```sql
-- 创建用户数据初始化函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. 创建users表记录
  INSERT INTO public.users (id, email, display_name, photo_url, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  );
  
  -- 2. 创建UserToken记录（初始0 tokens）
  INSERT INTO public."UserToken" ("userId", balance, "createdAt", "updatedAt")
  VALUES (NEW.id, 0, NOW(), NOW());
  
  -- 3. 创建referrals记录（生成邀请码）
  INSERT INTO public.referrals (
    id, "userId", "referralCode", "totalInvites",
    "successfulInvites", "createdAt"
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    substring(md5(random()::text) from 1 for 8), -- 8位邀请码
    0,
    0,
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

### 修复 4: 修正appHome路径（P1）

**工作量**: 0.5天

#### 4.1 确认Dashboard页面

```bash
# 检查/dashboard路由是否存在
ls apps/frontend/src/app/dashboard/
```

#### 4.2 更新配置

```typescript
// apps/frontend/src/configuration.ts

paths: {
  signIn: '/auth',
  signUp: '/auth',
  appHome: '/dashboard', // 或改为 '/offers'
  authCallback: '/auth/callback',
  // ...
}
```

---

## 四、测试计划

### 4.1 自注册流程测试

**测试步骤**:
1. 访问 `/auth`
2. 点击"Google登录"
3. 完成Google OAuth授权
4. 验证跳转到Dashboard
5. 验证用户数据创建
6. 验证7天试用订阅创建
7. 验证50 tokens发放

**验收标准**:
- [ ] 用户可以成功登录
- [ ] `users`表有记录
- [ ] `UserToken`表有记录（balance=500）
- [ ] `Subscription`表有记录（planName=pro, status=trialing, days=7）
- [ ] `referrals`表有记录（邀请码已生成）
- [ ] `TokenTransaction`表有记录（type=grant, amount=500, source=self_register）

---

### 4.2 邀请注册流程测试

**测试步骤**:
1. 用户A获取邀请码（从`/settings/referral`）
2. 用户B访问 `/auth?ref=XXXXX`
3. 用户B完成Google OAuth授权
4. 验证邀请关系记录
5. 验证用户B获得14天试用
6. 验证用户A获得50 tokens奖励

**验收标准**:
- [ ] `referral_records`表有记录
- [ ] 用户B的`Subscription`（planName=pro, status=trialing, days=14）
- [ ] 用户B的`UserToken`（balance=1000）
- [ ] 用户A的`UserToken`增加100
- [ ] 用户A的`referrals.successfulInvites`+1
- [ ] `TokenTransaction`表有两条记录：
  - 用户B: type=grant, amount=1000, source=referral
  - 用户A: type=grant, amount=100, source=referral_reward

---

### 4.3 边界情况测试

**测试场景**:
1. 用户重复登录（不应重复创建试用）
2. 无效邀请码（应降级为自注册）
3. Supabase触发器超时（应有错误处理）
4. API调用失败（不应阻塞登录）

---

## 五、实施优先级

### P0: 核心功能修复（Week 1）
- [ ] 实现 `/api/v1/trial/create` API
- [ ] 实现 `/api/v1/referral/track` API
- [ ] 验证Supabase触发器
- [ ] 创建缺失的触发器

### P1: 优化和完善（Week 2）
- [ ] 修正appHome路径
- [ ] 完善错误处理
- [ ] 添加日志记录
- [ ] 编写测试用例

### P2: 监控和告警（Week 3）
- [ ] 添加注册成功率监控
- [ ] 添加试用创建失败告警
- [ ] 添加邀请追踪失败告警

---

## 六、风险评估

### 高风险

#### 1. Supabase触发器不存在
**影响**: 用户数据不完整，系统无法正常工作
**缓解**: 立即验证并创建触发器

#### 2. API不存在导致功能失效
**影响**: 用户无试用订阅，无法使用功能
**缓解**: 优先实现这两个API

### 中风险

#### 3. 邀请功能完全失效
**影响**: 用户增长受阻
**缓解**: 实现邀请追踪API

---

## 七、建议

### 立即行动
1. **验证Supabase触发器** - 这是基础，必须先确认
2. **实现试用订阅API** - 让新用户能用起来
3. **实现邀请追踪API** - 激活增长引擎

### 架构优化
1. 考虑将试用订阅逻辑移到Supabase触发器中
2. 统一邀请功能到useractivity服务
3. 添加完整的审计日志

---

**维护人**: Backend + Frontend Team
**最后更新**: 2025-10-17
**优先级**: P0（紧急）


---

## 八、试用套餐规则总结

### 8.1 自注册用户

**试用套餐**: Pro套餐
**试用时长**: 7天
**Token配额**: 500 tokens（Pro月度配额1000的50%）

**权限**:
- ✅ AI智能评估（12维度）
- ✅ 真实补点击
- ✅ 5个并发评估
- ✅ 最多10个广告账号
- ✅ 全球10+地区代理IP
- ✅ 优先邮件支持
- ✅ 高级报表与数据导出

**实现逻辑**:
```typescript
// 前端: /auth/callback/route.ts
if (isNewUser && !referralCode) {
  await fetch('/api/v1/trial/create', {
    body: JSON.stringify({
      userId,
      days: 7,
      source: 'self_register'
    })
  });
}
```

---

### 8.2 邀请注册用户

**试用套餐**: Pro套餐
**试用时长**: 14天
**Token配额**: 1000 tokens（Pro月度配额100%）

**额外奖励**:
- 邀请人获得：100 tokens

**权限**: 与Pro套餐完全相同

**实现逻辑**:
```typescript
// 前端: /auth/callback/route.ts
if (isNewUser && referralCode) {
  await fetch('/api/v1/referral/track', {
    body: JSON.stringify({
      referralCode,
      newUserId: userId
    })
  });
}
```

---

### 8.3 试用到期处理

**试用结束后**:
- 订阅状态变为：`expired`
- 用户需要购买付费套餐才能继续使用
- 剩余Token保留，但无法使用（需要有效订阅）

**降级逻辑**（可选实现）:
```go
// 定时任务：每天检查过期试用
func (h *Handler) CheckExpiredTrials() {
    _, err := h.DB.Exec(context.Background(), `
        UPDATE "Subscription"
        SET status = 'expired'
        WHERE status = 'trialing'
          AND "trialEndsAt" < NOW()
    `)
}
```

---

### 8.4 防止滥用机制

**一人一次试用**:
```go
// 检查用户是否已有订阅（包括过期的）
var existingCount int
h.DB.QueryRow(ctx, `
    SELECT COUNT(*) FROM "Subscription"
    WHERE "userId" = $1
`, userID).Scan(&existingCount)

if existingCount > 0 {
    return errors.New("User already used trial")
}
```

**邀请码验证**:
```go
// 检查邀请码是否有效
var referrerID string
err := h.DB.QueryRow(ctx, `
    SELECT "userId" FROM referrals
    WHERE "referralCode" = $1
      AND "userId" != $2  -- 不能邀请自己
`, referralCode, newUserID).Scan(&referrerID)
```

---

## 九、数据库Schema补充

### 9.1 Subscription表字段

```sql
CREATE TABLE "Subscription" (
    id VARCHAR(255) PRIMARY KEY,
    "userId" VARCHAR(255) NOT NULL,
    "planId" VARCHAR(255) NOT NULL,      -- "pro-trial", "pro-plan-mth"
    "planName" VARCHAR(50) NOT NULL,     -- "pro", "starter", "elite"
    status VARCHAR(50) NOT NULL,         -- "trialing", "active", "expired"
    "trialEndsAt" TIMESTAMP,             -- 试用结束时间
    "currentPeriodEnd" TIMESTAMP NOT NULL,
    "stripeCustomerId" VARCHAR(255),
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_subscription_user_status ON "Subscription"("userId", status);
CREATE INDEX idx_subscription_trial_ends ON "Subscription"("trialEndsAt") WHERE status = 'trialing';
```

### 9.2 TokenTransaction表字段

```sql
CREATE TABLE "TokenTransaction" (
    id VARCHAR(255) PRIMARY KEY,
    "userId" VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,           -- "grant", "deduct", "refund"
    amount INTEGER NOT NULL,
    description TEXT,
    source VARCHAR(100),                 -- "self_register", "referral", "referral_reward"
    service VARCHAR(50),                 -- "siterank", "batchopen"
    metadata JSONB,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_token_tx_user_created ON "TokenTransaction"("userId", "createdAt" DESC);
CREATE INDEX idx_token_tx_source ON "TokenTransaction"(source);
```

---

## 十、监控指标

### 10.1 注册转化漏斗

```
访问/auth页面
    ↓ (点击率)
点击Google登录
    ↓ (授权率)
完成OAuth授权
    ↓ (成功率)
创建用户数据
    ↓ (试用创建率)
获得Pro试用
    ↓ (激活率)
完成首次操作
```

**关键指标**:
- 注册成功率: `成功创建用户 / 点击Google登录`
- 试用创建率: `成功创建试用 / 注册成功`
- 邀请转化率: `邀请注册 / 总注册`
- 试用激活率: `完成首次操作 / 获得试用`

### 10.2 告警规则

```yaml
alerts:
  - name: TrialCreationFailureRate
    condition: trial_creation_failures / total_registrations > 0.05
    severity: critical
    message: "试用创建失败率超过5%"
  
  - name: ReferralTrackingFailureRate
    condition: referral_tracking_failures / referral_registrations > 0.05
    severity: warning
    message: "邀请追踪失败率超过5%"
  
  - name: SupabaseTriggerTimeout
    condition: user_data_creation_timeout > 3s
    severity: critical
    message: "Supabase触发器超时"
```

---

**最后更新**: 2025-10-17
**补充信息**: 试用套餐规则已更新为Pro套餐（7天/14天）
