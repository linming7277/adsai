# 套餐优先级与Token管理完整设计方案

## 版本信息
- **文档版本**: v1.0
- **创建日期**: 2025-10-18
- **作者**: Claude Code
- **状态**: 设计阶段

---

## 一、需求总结

### 1.1 核心需求
1. **套餐优先级管理**: 高级套餐生效期间，低级套餐进入待激活队列
2. **Token有效期管理**: 套餐token有效期=套餐有效期，签到/邀请token永久有效
3. **Token消耗优先级**: 优先消耗套餐token > 签到token > 邀请token
4. **站内通知**: Token即将过期时发送站内通知
5. **套餐升级处理**: 升级时原套餐token保留到原到期日

### 1.2 正确的套餐信息
- **Starter**: 100 tokens/月 (免费，级别1)
- **Professional**: 1,000 tokens/月 (29.8元/月，级别2)
- **Elite**: 10,000 tokens/月 (299.8元/月，级别3)

---

## 二、数据库设计

### 2.1 增强 token_transactions 表

```sql
-- 迁移文件: 20251018_enhance_token_transactions.sql

ALTER TABLE "TokenTransaction"
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES "Subscription"(id);

-- 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_token_tx_source_expires
ON "TokenTransaction"(user_id, source, expires_at)
WHERE amount > 0;

CREATE INDEX IF NOT EXISTS idx_token_tx_expiring_soon
ON "TokenTransaction"(user_id, expires_at)
WHERE expires_at IS NOT NULL AND expires_at > NOW();

-- 添加注释
COMMENT ON COLUMN "TokenTransaction".source IS 'Token来源: subscription, checkin, referral, manual, admin';
COMMENT ON COLUMN "TokenTransaction".expires_at IS 'Token过期时间（NULL表示永久有效）';
COMMENT ON COLUMN "TokenTransaction".subscription_id IS '关联的订阅ID（仅subscription类型）';

-- 更新现有数据（默认设置为永久有效）
UPDATE "TokenTransaction"
SET source = 'manual', expires_at = NULL
WHERE source IS NULL;
```

**Token来源类型**：
- `subscription`: 套餐赠送（有过期时间）
- `checkin`: 每日签到（永久有效）
- `referral`: 邀请奖励（永久有效）
- `manual`: 手动发放（可选过期时间）
- `admin`: 管理员补偿（可选过期时间）

---

### 2.2 创建 pending_subscriptions 表

```sql
-- 迁移文件: 20251018_create_pending_subscriptions.sql

CREATE TABLE IF NOT EXISTS "PendingSubscription" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL, -- 'starter', 'professional', 'elite'
    plan_name TEXT NOT NULL,
    plan_tier INTEGER NOT NULL, -- 套餐级别: 1=Starter, 2=Professional, 3=Elite
    trial_days INTEGER NOT NULL,
    trial_source TEXT NOT NULL, -- 'referral_inviter', 'referral_invitee', 'self_register'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'activated', 'expired', 'canceled'
    blocking_subscription_id UUID REFERENCES "Subscription"(id), -- 阻塞该订阅的当前活跃订阅
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- 如果未激活，何时失效
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_pending_sub_user_status
ON "PendingSubscription"(user_id, status);

CREATE INDEX IF NOT EXISTS idx_pending_sub_status_created
ON "PendingSubscription"(status, created_at);

CREATE INDEX IF NOT EXISTS idx_pending_sub_blocking
ON "PendingSubscription"(blocking_subscription_id)
WHERE blocking_subscription_id IS NOT NULL;

-- 注释
COMMENT ON TABLE "PendingSubscription" IS '待激活订阅队列表';
COMMENT ON COLUMN "PendingSubscription".plan_tier IS '套餐级别，数字越大越高级';
COMMENT ON COLUMN "PendingSubscription".blocking_subscription_id IS '阻塞本订阅的当前活跃订阅ID';
COMMENT ON COLUMN "PendingSubscription".expires_at IS 'pending状态的有效期（180天）';
```

**待激活订阅生命周期**：
```
pending → activated (成功激活)
pending → expired (180天后自动过期)
pending → canceled (用户手动取消)
```

---

### 2.3 增强 Subscription 表

```sql
-- 迁移文件: 20251018_add_subscription_tier.sql

ALTER TABLE "Subscription"
ADD COLUMN IF NOT EXISTS tier INTEGER;

-- 更新现有数据的tier值
UPDATE "Subscription"
SET tier = CASE
    WHEN "planId" = 'starter' OR "planId" = 'free' THEN 1
    WHEN "planId" = 'professional' OR "planId" = 'pro' THEN 2
    WHEN "planId" = 'elite' OR "planId" = 'max' THEN 3
    ELSE 1
END
WHERE tier IS NULL;

-- 添加注释
COMMENT ON COLUMN "Subscription".tier IS '套餐级别: 1=Starter, 2=Professional, 3=Elite';
```

---

## 三、核心业务逻辑设计

### 3.1 套餐级别判定逻辑

```go
// services/billing/internal/domain/subscription.go

// Subscription tier levels
const (
    TierStarter = 1
    TierProfessional = 2
    TierElite = 3
)

// Plan tier mapping
var PlanTiers = map[string]int{
    "starter": TierStarter,
    "free": TierStarter,  // Legacy support
    "professional": TierProfessional,
    "pro": TierProfessional,  // Legacy support
    "elite": TierElite,
    "max": TierElite,  // Legacy support
}

// GetPlanTier returns the tier level for a plan ID
func GetPlanTier(planID string) int {
    if tier, ok := PlanTiers[planID]; ok {
        return tier
    }
    return TierStarter // Default to lowest tier
}

// CompareTier compares two subscription tiers
// Returns: 1 if s1 > s2, -1 if s1 < s2, 0 if equal
func CompareTier(tier1, tier2 int) int {
    if tier1 > tier2 {
        return 1
    } else if tier1 < tier2 {
        return -1
    }
    return 0
}
```

---

### 3.2 Trial创建逻辑（修改后）

```go
// services/billing/internal/handlers/trial_subscription.go

func (h *TrialSubscriptionHandler) CreateTrial(w http.ResponseWriter, r *http.Request) {
    // ... (参数验证省略)

    // 1. 查询用户当前活跃订阅
    activeSubscription, err := h.getActiveSubscription(ctx, req.UserID)

    // 2. 计算新订阅的tier级别
    newTier := domain.GetPlanTier(domain.ProPlanID) // Trial默认为Professional级别

    // 3. 根据source类型分别处理
    switch req.Source {
    case "referral_inviter":
        // 邀请人：可累积奖励
        if activeSubscription != nil {
            activeTier := activeSubscription.Tier

            if newTier > activeTier {
                // 新订阅级别更高，直接升级
                resp, err := h.upgradeSubscription(ctx, &req, activeSubscription)
            } else if newTier == activeTier {
                // 同级别，延长时间
                resp, err := h.extendOrCreateTrial(ctx, &req)
            } else {
                // 新订阅级别更低，加入待激活队列
                resp, err := h.addToPendingQueue(ctx, &req, activeSubscription)
            }
        } else {
            // 没有活跃订阅，直接创建
            resp, err := h.createTrial(ctx, &req)
        }

    case "referral_invitee":
        // 被邀请人：只能获得一次
        hasInviteeReward, err := h.hasTrialHistoryBySource(ctx, req.UserID, "referral_invitee")
        if hasInviteeReward {
            errors.Write(w, r, http.StatusConflict, "SUB_002", "用户已获得过被邀请奖励", ...)
            return
        }

        // 同样需要检查套餐优先级
        if activeSubscription != nil && newTier <= activeSubscription.Tier {
            resp, err := h.addToPendingQueue(ctx, &req, activeSubscription)
        } else {
            resp, err := h.createTrial(ctx, &req)
        }

    case "self_register":
        // 自注册：只能获得一次
        hasTrialHistory, err := h.hasTrialHistory(ctx, req.UserID)
        if hasTrialHistory {
            errors.Write(w, r, http.StatusConflict, "SUB_001", "用户已有试用订阅记录", ...)
            return
        }
        resp, err := h.createTrial(ctx, &req)
    }
}
```

---

### 3.3 待激活队列逻辑

```go
// services/billing/internal/handlers/pending_subscription.go

type PendingSubscriptionHandler struct {
    db *pgxpool.Pool
}

// addToPendingQueue 将低级订阅加入待激活队列
func (h *TrialSubscriptionHandler) addToPendingQueue(
    ctx context.Context,
    req *CreateTrialRequest,
    activeSubscription *domain.Subscription,
) (*CreateTrialResponse, error) {
    newTier := domain.GetPlanTier(domain.ProPlanID)

    // 创建pending订阅记录
    pendingID := uuid.New().String()
    expiresAt := time.Now().AddDate(0, 6, 0) // 180天有效期

    query := `
        INSERT INTO "PendingSubscription" (
            id, user_id, plan_id, plan_name, plan_tier,
            trial_days, trial_source, status,
            blocking_subscription_id, expires_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, NOW())
        RETURNING id, created_at
    `

    err := h.db.QueryRow(ctx, query,
        pendingID,
        req.UserID,
        domain.ProPlanID,
        "Professional",
        newTier,
        req.Days,
        req.Source,
        activeSubscription.ID,
        expiresAt,
    ).Scan(&pendingID, &createdAt)

    if err != nil {
        return nil, fmt.Errorf("failed to create pending subscription: %w", err)
    }

    // 发送站内通知
    h.notifyPendingSubscription(ctx, req.UserID, pendingID, activeSubscription.TrialEndDate)

    return &CreateTrialResponse{
        SubscriptionID: pendingID,
        Status: "pending",
        Message: fmt.Sprintf("您的Professional试用将在当前%s套餐到期后自动激活", activeSubscription.PlanName),
        TrialDays: req.Days,
        PendingActivationDate: activeSubscription.TrialEndDate,
    }, nil
}

// ActivatePendingSubscriptions 激活所有符合条件的待激活订阅
// 由定时任务调用
func (h *PendingSubscriptionHandler) ActivatePendingSubscriptions(ctx context.Context) error {
    // 查询所有可以激活的pending订阅
    query := `
        SELECT ps.id, ps.user_id, ps.plan_id, ps.plan_name, ps.plan_tier,
               ps.trial_days, ps.trial_source, ps.blocking_subscription_id
        FROM "PendingSubscription" ps
        LEFT JOIN "Subscription" s ON ps.blocking_subscription_id = s.id
        WHERE ps.status = 'pending'
          AND (
              -- 阻塞订阅已过期
              s.id IS NULL
              OR s."trialEndDate" <= NOW()
              OR s.status IN ('expired', 'canceled')
          )
          AND ps.expires_at > NOW() -- pending记录本身未过期
    `

    rows, err := h.db.Query(ctx, query)
    if err != nil {
        return fmt.Errorf("failed to query pending subscriptions: %w", err)
    }
    defer rows.Close()

    for rows.Next() {
        var pending PendingSubscription
        err := rows.Scan(&pending.ID, &pending.UserID, &pending.PlanID, ...)
        if err != nil {
            log.Printf("Error scanning pending subscription: %v", err)
            continue
        }

        // 激活订阅
        err = h.activatePendingSubscription(ctx, &pending)
        if err != nil {
            log.Printf("Failed to activate pending subscription %s: %v", pending.ID, err)
            continue
        }

        log.Printf("Successfully activated pending subscription: %s for user %s", pending.ID, pending.UserID)
    }

    return nil
}

func (h *PendingSubscriptionHandler) activatePendingSubscription(
    ctx context.Context,
    pending *PendingSubscription,
) error {
    tx, err := h.db.Begin(ctx)
    if err != nil {
        return fmt.Errorf("failed to begin transaction: %w", err)
    }
    defer tx.Rollback(ctx)

    // 1. 创建实际的trial订阅
    subscriptionID := uuid.New().String()
    now := time.Now()
    trialEnd := now.AddDate(0, 0, pending.TrialDays)

    _, err = tx.Exec(ctx, `
        INSERT INTO "Subscription" (
            id, "userId", "planId", "planName", tier, status,
            "trialStartDate", "trialEndDate", "trialSource",
            "currentPeriodEnd", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, 'trialing', $6, $7, $8, $7, NOW())
    `, subscriptionID, pending.UserID, pending.PlanID, pending.PlanName,
       pending.PlanTier, now, trialEnd, pending.TrialSource)

    if err != nil {
        return fmt.Errorf("failed to create subscription: %w", err)
    }

    // 2. 发放token
    tokenAmount := 1000 // Professional trial默认1000 tokens
    err = h.grantTokens(ctx, tx, pending.UserID, subscriptionID, tokenAmount, trialEnd)
    if err != nil {
        return fmt.Errorf("failed to grant tokens: %w", err)
    }

    // 3. 更新pending订阅状态
    _, err = tx.Exec(ctx, `
        UPDATE "PendingSubscription"
        SET status = 'activated', activated_at = NOW(), updated_at = NOW()
        WHERE id = $1
    `, pending.ID)

    if err != nil {
        return fmt.Errorf("failed to update pending subscription: %w", err)
    }

    // 4. 发送激活通知
    h.notifySubscriptionActivated(ctx, pending.UserID, subscriptionID, trialEnd)

    return tx.Commit(ctx)
}
```

---

### 3.4 Token有效期管理

```go
// services/billing/internal/handlers/token_handler.go

// grantTokens 发放token（带有效期）
func (h *TrialSubscriptionHandler) grantTokens(
    ctx context.Context,
    tx pgx.Tx,
    userID string,
    subscriptionID string,
    amount int,
    expiresAt time.Time,
) error {
    // 1. 插入token交易记录
    _, err := tx.Exec(ctx, `
        INSERT INTO "TokenTransaction" (
            id, user_id, amount, reason, source,
            expires_at, subscription_id, created_at, metadata
        ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), $7
        )
    `,
        userID,
        amount,
        fmt.Sprintf("Trial subscription token grant: %d tokens", amount),
        "subscription", // Token来源
        expiresAt,      // 过期时间 = 订阅结束时间
        subscriptionID,
        jsonb.Marshal(map[string]interface{}{
            "subscription_id": subscriptionID,
            "token_type": "trial",
        }),
    )

    if err != nil {
        return fmt.Errorf("failed to create token transaction: %w", err)
    }

    // 2. 更新用户token余额
    _, err = tx.Exec(ctx, `
        INSERT INTO "TokenWallet" (user_id, balance, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET balance = "TokenWallet".balance + $2,
            updated_at = NOW()
    `, userID, amount)

    return err
}

// grantPermanentTokens 发放永久token（签到、邀请奖励）
func (h *TokenHandler) grantPermanentTokens(
    ctx context.Context,
    userID string,
    amount int,
    source string, // 'checkin' or 'referral'
    reason string,
) error {
    tx, err := h.db.Begin(ctx)
    if err != nil {
        return err
    }
    defer tx.Rollback(ctx)

    // 插入token记录，expires_at = NULL 表示永久有效
    _, err = tx.Exec(ctx, `
        INSERT INTO "TokenTransaction" (
            id, user_id, amount, reason, source,
            expires_at, subscription_id, created_at
        ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, NULL, NULL, NOW()
        )
    `, userID, amount, reason, source)

    if err != nil {
        return err
    }

    // 更新余额
    _, err = tx.Exec(ctx, `
        INSERT INTO "TokenWallet" (user_id, balance, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET balance = "TokenWallet".balance + $2,
            updated_at = NOW()
    `, userID, amount)

    if err != nil {
        return err
    }

    return tx.Commit(ctx)
}
```

---

### 3.5 Token消耗优先级逻辑

```go
// services/billing/internal/handlers/token_consumption.go

// DeductTokens 按优先级扣减token
func (h *TokenHandler) DeductTokens(
    ctx context.Context,
    userID string,
    amount int,
    reason string,
    service string,
) error {
    tx, err := h.db.Begin(ctx)
    if err != nil {
        return err
    }
    defer tx.Rollback(ctx)

    // 1. 检查总余额是否充足
    var currentBalance int
    err = tx.QueryRow(ctx, `
        SELECT balance FROM "TokenWallet" WHERE user_id = $1
    `, userID).Scan(&currentBalance)

    if err != nil {
        return fmt.Errorf("failed to get token balance: %w", err)
    }

    if currentBalance < amount {
        return fmt.Errorf("insufficient token balance: need %d, have %d", amount, currentBalance)
    }

    // 2. 按优先级查询可用token来源
    // 优先级: subscription (即将过期优先) > checkin > referral
    query := `
        SELECT id, amount, source, expires_at, subscription_id
        FROM "TokenTransaction"
        WHERE user_id = $1
          AND amount > 0  -- 只查收入记录
          AND (expires_at IS NULL OR expires_at > NOW())  -- 未过期
        ORDER BY
          CASE source
            WHEN 'subscription' THEN 1  -- 最高优先级
            WHEN 'checkin' THEN 2
            WHEN 'referral' THEN 3
            WHEN 'manual' THEN 4
            ELSE 5
          END,
          expires_at ASC NULLS LAST,  -- 即将过期的优先
          created_at ASC              -- 同类型按时间FIFO
        FOR UPDATE  -- 锁定行防止并发问题
    `

    rows, err := tx.Query(ctx, query, userID)
    if err != nil {
        return fmt.Errorf("failed to query token sources: %w", err)
    }
    defer rows.Close()

    // 3. 从最高优先级开始扣减
    remainingToDeduct := amount
    deductionRecords := []TokenDeduction{}

    for rows.Next() && remainingToDeduct > 0 {
        var txID string
        var txAmount int
        var source string
        var expiresAt *time.Time
        var subscriptionID *string

        err := rows.Scan(&txID, &txAmount, &source, &expiresAt, &subscriptionID)
        if err != nil {
            return fmt.Errorf("failed to scan token transaction: %w", err)
        }

        // 计算从这条记录扣除多少
        deductAmount := min(txAmount, remainingToDeduct)

        // 记录扣减明细
        deductionRecords = append(deductionRecords, TokenDeduction{
            SourceTransactionID: txID,
            Source: source,
            Amount: deductAmount,
            ExpiresAt: expiresAt,
            SubscriptionID: subscriptionID,
        })

        // 更新原始交易记录的金额（变为负值表示已消耗）
        _, err = tx.Exec(ctx, `
            UPDATE "TokenTransaction"
            SET amount = amount - $1, updated_at = NOW()
            WHERE id = $2
        `, deductAmount, txID)

        if err != nil {
            return fmt.Errorf("failed to update token transaction: %w", err)
        }

        remainingToDeduct -= deductAmount
    }

    if remainingToDeduct > 0 {
        return fmt.Errorf("failed to deduct all tokens, remaining: %d", remainingToDeduct)
    }

    // 4. 创建消耗记录
    metadata := map[string]interface{}{
        "reason": reason,
        "service": service,
        "deduction_details": deductionRecords,
    }

    _, err = tx.Exec(ctx, `
        INSERT INTO "TokenTransaction" (
            id, user_id, amount, reason, source,
            service, created_at, metadata
        ) VALUES (
            gen_random_uuid(), $1, $2, $3, 'consumption', $4, NOW(), $5
        )
    `, userID, -amount, reason, service, metadata)

    if err != nil {
        return fmt.Errorf("failed to create consumption record: %w", err)
    }

    // 5. 更新用户余额
    _, err = tx.Exec(ctx, `
        UPDATE "TokenWallet"
        SET balance = balance - $1, updated_at = NOW()
        WHERE user_id = $2
    `, amount, userID)

    if err != nil {
        return fmt.Errorf("failed to update wallet balance: %w", err)
    }

    return tx.Commit(ctx)
}

type TokenDeduction struct {
    SourceTransactionID string
    Source              string
    Amount              int
    ExpiresAt           *time.Time
    SubscriptionID      *string
}
```

---

### 3.6 Token过期处理

```go
// services/billing/internal/scheduler/token_expiry.go

type TokenExpiryScheduler struct {
    db *pgxpool.Pool
    notificationService *NotificationService
}

// CleanExpiredTokens 清理过期token（每日凌晨2点执行）
func (s *TokenExpiryScheduler) CleanExpiredTokens(ctx context.Context) error {
    log.Println("Starting expired token cleanup...")

    tx, err := s.db.Begin(ctx)
    if err != nil {
        return err
    }
    defer tx.Rollback(ctx)

    // 1. 查询所有过期但未清理的token
    query := `
        SELECT user_id, SUM(amount) as expired_amount
        FROM "TokenTransaction"
        WHERE amount > 0
          AND expires_at IS NOT NULL
          AND expires_at <= NOW()
        GROUP BY user_id
        HAVING SUM(amount) > 0
    `

    rows, err := tx.Query(ctx, query)
    if err != nil {
        return fmt.Errorf("failed to query expired tokens: %w", err)
    }
    defer rows.Close()

    totalUsers := 0
    totalExpiredTokens := 0

    for rows.Next() {
        var userID string
        var expiredAmount int

        err := rows.Scan(&userID, &expiredAmount)
        if err != nil {
            log.Printf("Error scanning expired tokens: %v", err)
            continue
        }

        // 2. 将过期token金额归零
        _, err = tx.Exec(ctx, `
            UPDATE "TokenTransaction"
            SET amount = 0, updated_at = NOW()
            WHERE user_id = $1
              AND amount > 0
              AND expires_at <= NOW()
        `, userID)

        if err != nil {
            log.Printf("Failed to clear expired tokens for user %s: %v", userID, err)
            continue
        }

        // 3. 扣减用户余额
        _, err = tx.Exec(ctx, `
            UPDATE "TokenWallet"
            SET balance = balance - $1, updated_at = NOW()
            WHERE user_id = $2
        `, expiredAmount, userID)

        if err != nil {
            log.Printf("Failed to update wallet for user %s: %v", userID, err)
            continue
        }

        // 4. 记录清理日志
        _, err = tx.Exec(ctx, `
            INSERT INTO "TokenTransaction" (
                id, user_id, amount, reason, source, created_at, metadata
            ) VALUES (
                gen_random_uuid(), $1, $2, 'Token expired', 'system', NOW(), $3
            )
        `, userID, -expiredAmount, map[string]interface{}{
            "cleanup_type": "expiry",
            "expired_at": time.Now(),
        })

        totalUsers++
        totalExpiredTokens += expiredAmount

        log.Printf("Cleaned %d expired tokens for user %s", expiredAmount, userID)
    }

    err = tx.Commit(ctx)
    if err != nil {
        return fmt.Errorf("failed to commit transaction: %w", err)
    }

    log.Printf("Expired token cleanup completed: %d users, %d tokens", totalUsers, totalExpiredTokens)
    return nil
}

// NotifyExpiringTokens 通知即将过期的token（每日执行）
func (s *TokenExpiryScheduler) NotifyExpiringTokens(ctx context.Context) error {
    // 查询7天内即将过期的token
    query := `
        SELECT user_id, SUM(amount) as expiring_amount, MIN(expires_at) as earliest_expiry
        FROM "TokenTransaction"
        WHERE amount > 0
          AND expires_at IS NOT NULL
          AND expires_at > NOW()
          AND expires_at <= NOW() + INTERVAL '7 days'
        GROUP BY user_id
    `

    rows, err := s.db.Query(ctx, query)
    if err != nil {
        return err
    }
    defer rows.Close()

    for rows.Next() {
        var userID string
        var expiringAmount int
        var earliestExpiry time.Time

        err := rows.Scan(&userID, &expiringAmount, &earliestExpiry)
        if err != nil {
            continue
        }

        // 发送站内通知
        daysUntilExpiry := int(earliestExpiry.Sub(time.Now()).Hours() / 24)

        s.notificationService.SendInAppNotification(ctx, &Notification{
            UserID: userID,
            Type: "token_expiring",
            Title: "Token即将过期提醒",
            Body: fmt.Sprintf("您有%d个Token将在%d天后过期，请尽快使用", expiringAmount, daysUntilExpiry),
            Data: map[string]interface{}{
                "expiring_amount": expiringAmount,
                "expires_at": earliestExpiry,
                "days_until_expiry": daysUntilExpiry,
            },
        })

        log.Printf("Sent expiry notification to user %s: %d tokens expiring in %d days",
                   userID, expiringAmount, daysUntilExpiry)
    }

    return nil
}
```

---

## 四、定时任务设计

### 4.1 任务调度配置

```go
// services/billing/internal/scheduler/scheduler.go

type Scheduler struct {
    db *pgxpool.Pool
    pendingSubHandler *PendingSubscriptionHandler
    tokenExpiryHandler *TokenExpiryScheduler
}

func (s *Scheduler) Start(ctx context.Context) {
    // 每小时检查一次待激活订阅
    go s.scheduleTask(ctx, time.Hour, func() {
        err := s.pendingSubHandler.ActivatePendingSubscriptions(ctx)
        if err != nil {
            log.Printf("Error activating pending subscriptions: %v", err)
        }
    })

    // 每天凌晨2点清理过期token
    go s.scheduleDailyTask(ctx, 2, 0, func() {
        err := s.tokenExpiryHandler.CleanExpiredTokens(ctx)
        if err != nil {
            log.Printf("Error cleaning expired tokens: %v", err)
        }
    })

    // 每天早上9点发送token过期提醒
    go s.scheduleDailyTask(ctx, 9, 0, func() {
        err := s.tokenExpiryHandler.NotifyExpiringTokens(ctx)
        if err != nil {
            log.Printf("Error notifying expiring tokens: %v", err)
        }
    })
}
```

---

## 五、通知集成

### 5.1 站内通知服务

```go
// services/billing/internal/notifications/service.go

type NotificationService struct {
    db *pgxpool.Pool
}

// SendInAppNotification 发送站内通知
func (s *NotificationService) SendInAppNotification(
    ctx context.Context,
    notification *Notification,
) error {
    query := `
        INSERT INTO user_notifications (
            id, user_id, type, title, body, data,
            is_read, created_at
        ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, false, NOW()
        )
    `

    _, err := s.db.Exec(ctx, query,
        notification.UserID,
        notification.Type,
        notification.Title,
        notification.Body,
        notification.Data,
    )

    return err
}

type Notification struct {
    UserID string
    Type   string // 'token_expiring', 'subscription_activated', 'subscription_pending'
    Title  string
    Body   string
    Data   map[string]interface{}
}
```

---

## 六、API接口设计

### 6.1 查询待激活订阅

```
GET /api/v1/subscriptions/pending

Response:
{
  "success": true,
  "pending_subscriptions": [
    {
      "id": "uuid",
      "plan_name": "Professional",
      "trial_days": 14,
      "status": "pending",
      "blocking_subscription": {
        "id": "uuid",
        "plan_name": "Elite",
        "expires_at": "2025-11-01T00:00:00Z"
      },
      "will_activate_at": "2025-11-01T00:00:01Z",
      "created_at": "2025-10-18T10:00:00Z"
    }
  ]
}
```

### 6.2 查询Token明细（带过期时间）

```
GET /api/v1/tokens/balance-details

Response:
{
  "success": true,
  "total_balance": 5000,
  "breakdown": [
    {
      "source": "subscription",
      "amount": 800,
      "expires_at": "2025-11-15T00:00:00Z",
      "days_until_expiry": 28
    },
    {
      "source": "checkin",
      "amount": 200,
      "expires_at": null,
      "is_permanent": true
    },
    {
      "source": "referral",
      "amount": 4000,
      "expires_at": null,
      "is_permanent": true
    }
  ]
}
```

---

## 七、测试计划

### 7.1 单元测试

```go
// services/billing/internal/handlers/trial_subscription_test.go

func TestSubscriptionTierLogic(t *testing.T) {
    tests := []struct {
        name           string
        activeTier     int
        newTier        int
        expectedAction string
    }{
        {"升级", 1, 3, "upgrade"},
        {"同级", 2, 2, "extend"},
        {"降级", 3, 1, "pending"},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test logic...
        })
    }
}

func TestTokenConsumptionPriority(t *testing.T) {
    // 测试token消耗优先级
    // 1. 准备3种来源的token
    // 2. 执行消耗
    // 3. 验证优先级顺序
}

func TestTokenExpiry(t *testing.T) {
    // 测试token过期逻辑
}
```

---

## 八、实施步骤

1. ✅ **数据库迁移** (30分钟)
   - 增强 TokenTransaction 表
   - 创建 PendingSubscription 表
   - 添加 Subscription.tier 字段

2. ✅ **Token管理核心逻辑** (2小时)
   - 实现token有效期管理
   - 实现token消耗优先级

3. ✅ **待激活队列逻辑** (3小时)
   - 实现套餐级别判定
   - 实现pending队列创建
   - 实现自动激活逻辑

4. ✅ **定时任务** (1小时)
   - 实现待激活订阅检查
   - 实现过期token清理
   - 实现过期提醒

5. ✅ **通知集成** (1小时)
   - 实现站内通知服务
   - 集成通知发送

6. ✅ **API接口** (1小时)
   - 实现pending订阅查询
   - 实现token明细查询

7. ✅ **测试验证** (2小时)
   - 单元测试
   - 集成测试
   - 端到端测试

**总计**: 约10-11小时

---

## 九、风险与缓解

### 风险1: 并发问题
**问题**: 多个请求同时消耗token可能导致超额扣减

**缓解**:
- 使用数据库事务
- SELECT ... FOR UPDATE 锁定行
- 乐观锁检查余额

### 风险2: Token过期清理失败
**问题**: 定时任务失败导致过期token未清理

**缓解**:
- 实现幂等性清理逻辑
- 添加重试机制
- 记录清理日志用于审计

### 风险3: 待激活队列堆积
**问题**: 用户持续获得邀请奖励但从不降级

**缓解**:
- 设置pending记录180天过期
- 提供用户取消pending订阅的接口
- 监控pending队列长度

---

## 十、监控指标

- Pending订阅数量（按用户、按状态）
- Token过期清理量（每日）
- Token消耗分布（subscription vs permanent）
- 待激活队列激活率
- Token过期通知送达率

---

## 十一、后续优化

1. **用户界面展示**
   - 显示待激活订阅列表
   - 显示token过期倒计时
   - 提供取消pending订阅功能

2. **高级功能**
   - Token转赠功能
   - Token兑换商城
   - 套餐降级时的token保护

3. **性能优化**
   - Token查询缓存
   - 批量通知发送
   - 定时任务分片执行

---

**文档结束**
