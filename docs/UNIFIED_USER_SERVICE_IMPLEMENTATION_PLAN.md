# 统一用户服务实现方案

## 📊 当前数据结构分析

### Supabase数据库结构 (用户认证 + 前端数据)

根据查询结果，Supabase目前有以下表：

#### 1. `users` 表 (核心用户表)
```sql
-- 当前结构
CREATE TABLE public.users (
  id UUID PRIMARY KEY,                    -- 用户唯一标识 (对应 auth.users.id)
  display_name TEXT,                      -- 显示名称
  photo_url TEXT,                         -- 头像URL
  onboarded BOOLEAN DEFAULT false,       -- 是否完成引导
  subscription_tier TEXT DEFAULT 'starter', -- 订阅层级
  monthly_token_allocation INTEGER DEFAULT 0, -- 每月Token分配
  token_balance INTEGER DEFAULT 0,        -- Token余额
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 发现的问题
1. subscription_tier 与代码中的 subscriptionPlan 不一致
2. token_balance 与代码中的复杂Token管理不匹配
3. 缺少组织管理、权限等字段
```

#### 2. `auth.users` 表 (Supabase认证表)
```sql
-- Supabase内置认证表
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  email_confirmed_at TIMESTAMP WITH TIME ZONE,
  phone_confirmed_at TIMESTAMP WITH TIME ZONE,
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  -- 其他认证相关字段
);
```

### GCP Cloud SQL数据库结构 (后端业务数据)

根据迁移文件和配置，有以下数据库：

#### 1. `shared_db.users` 表
```sql
-- 需要的结构（基于代码分析）
CREATE TABLE shared_db.users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  photo_url TEXT,
  role TEXT DEFAULT 'user',  -- 'user' | 'admin'
  organization_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);
```

#### 2. `shared_db.user_permissions` 表
```sql
-- 权限表
CREATE TABLE shared_db.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES shared_db.users(id),
  is_admin BOOLEAN DEFAULT false,
  subscription_plan TEXT DEFAULT 'starter',
  can_use_ai BOOLEAN DEFAULT false,
  can_create_offers BOOLEAN DEFAULT true,
  max_offers_per_month INTEGER DEFAULT 10,
  max_tokens_per_month INTEGER DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3. `billing_db.user_tokens` 表
```sql
-- Token管理表
CREATE TABLE billing_db.user_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES shared_db.users(id),
  balance INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4. `billing_db.subscriptions` 表
```sql
-- 订阅表
CREATE TABLE billing_db.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES shared_db.users(id),
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- 'active' | 'cancelled' | 'expired'
  is_trial BOOLEAN DEFAULT false,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  current_period_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔄 数据结构差异分析

### 关键差异点

#### 1. 用户ID一致性问题
- **Supabase**: 使用 `auth.users.id` 作为主键
- **GCP**: 需要确保使用相同的UUID

#### 2. 字段命名不一致
```typescript
// Supabase
subscription_tier, token_balance, onboarded

// GCP期望
subscription_plan, permissions, user_status
```

#### 3. 数据冗余和缺失
```sql
-- Supabase有但GCP没有
users.onboarded
users.monthly_token_allocation
users.token_balance (简化版)

-- GCP有但Supabase没有
users.organization_id
users.role
user_permissions.max_tokens_per_month
user_tokens.reserved
```

## 🎯 统一用户服务实现方案

### Phase 1: 数据结构统一

#### 1. 更新Supabase Schema

```sql
-- 迁移Supabase users表结构
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
ADD COLUMN IF NOT EXISTS organization_id UUID,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

-- 重命名字段以保持一致性
ALTER TABLE public.users
RENAME COLUMN subscription_tier TO subscription_plan;

-- 创建用户权限表
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT false,
  subscription_plan TEXT DEFAULT 'starter',
  can_use_ai BOOLEAN DEFAULT false,
  can_create_offers BOOLEAN DEFAULT true,
  can_manage_ads BOOLEAN DEFAULT false,
  max_offers_per_month INTEGER DEFAULT 10,
  max_tokens_per_month INTEGER DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建Token余额表
CREATE TABLE IF NOT EXISTS public.user_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建订阅表
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'starter',
  status TEXT DEFAULT 'active',
  is_trial BOOLEAN DEFAULT false,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  current_period_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. 数据迁移脚本

```sql
-- 迁移现有数据
INSERT INTO public.user_permissions (user_id, subscription_plan, can_create_offers)
SELECT
  id as user_id,
  subscription_plan as subscription_plan,
  CASE
    WHEN subscription_plan IN ('professional', 'elite') THEN true
    ELSE true
  END as can_create_offers
FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- 初始化Token余额
INSERT INTO public.user_tokens (user_id, balance)
SELECT
  id as user_id,
  COALESCE(token_balance, 0) as balance
FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- 创建订阅记录
INSERT INTO public.subscriptions (user_id, plan, is_trial)
SELECT
  id as user_id,
  subscription_plan as plan,
  false as is_trial
FROM public.users
ON CONFLICT (user_id) DO NOTHING;
```

### Phase 2: 统一用户服务实现

#### 1. 后端API实现

创建 `services/user` 微服务：

```go
// services/user/cmd/server/main.go
package main

import (
    "github.com/gin-gonic/gin"
    "github.com/xxrenzhe/autoads/services/user/internal/handlers"
    "github.com/xxrenzhe/autoads/services/user/internal/config"
    "github.com/xxrenzhe/autoads/pkg/database"
)

func main() {
    cfg := config.Load()
    db := database.NewConnection(cfg.Database)

    router := gin.Default()

    // API路由
    api := router.Group("/api/v1")
    {
        // 用户档案
        api.GET("/users/:userId/profile", handlers.GetUserProfile(db))
        api.PUT("/users/:userId/profile", handlers.UpdateUserProfile(db))

        // 权限管理
        api.GET("/users/:userId/permissions", handlers.GetUserPermissions(db))
        api.POST("/users/:userId/permissions", handlers.UpdateUserPermissions(db))

        // Token管理
        api.GET("/users/:userId/tokens/balance", handlers.GetTokenBalance(db))
        api.POST("/users/:userId/tokens/reserve", handlers.ReserveTokens(db))
        api.POST("/users/:userId/tokens/confirm", handlers.ConfirmTokenReservation(db))
        api.POST("/users/:userId/tokens/cancel", handlers.CancelTokenReservation(db))

        // 订阅管理
        api.GET("/users/:userId/subscription", handlers.GetUserSubscription(db))
        api.POST("/users/:userId/subscription/upgrade", handlers.UpgradeSubscription(db))

        // 组织管理
        api.GET("/users/:userId/organizations", handlers.GetUserOrganizations(db))
        api.POST("/users/:userId/organizations", handlers.CreateOrganization(db))
    }

    router.Run(":8080")
}
```

#### 2. 数据模型定义

```go
// services/user/internal/models/user.go
package models

import "time"

type User struct {
    ID           string    `json:"id" db:"id"`
    Email        string    `json:"email" db:"email"`
    DisplayName  string    `json:"display_name" db:"display_name"`
    PhotoURL     string    `json:"photo_url" db:"photo_url"`
    Role         string    `json:"role" db:"role"`
    Onboarded    bool      `json:"onboarded" db:"onboarded"`
    IsActive     bool      `json:"is_active" db:"is_active"`
    OrganizationID *string `json:"organization_id" db:"organization_id"`
    CreatedAt    time.Time `json:"created_at" db:"created_at"`
    UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type UserPermissions struct {
    ID                 string `json:"id" db:"id"`
    UserID             string `json:"user_id" db:"user_id"`
    IsAdmin            bool   `json:"is_admin" db:"is_admin"`
    SubscriptionPlan   string `json:"subscription_plan" db:"subscription_plan"`
    CanUseAI           bool   `json:"can_use_ai" db:"can_use_ai"`
    CanCreateOffers    bool   `json:"can_create_offers" db:"can_create_offers"`
    CanManageAds       bool   `json:"can_manage_ads" db:"can_manage_ads"`
    MaxOffersPerMonth  int    `json:"max_offers_per_month" db:"max_offers_per_month"`
    MaxTokensPerMonth  int    `json:"max_tokens_per_month" db:"max_tokens_per_month"`
    CreatedAt          time.Time `json:"created_at" db:"created_at"`
    UpdatedAt          time.Time `json:"updated_at" db:"updated_at"`
}

type TokenBalance struct {
    ID          string    `json:"id" db:"id"`
    UserID      string    `json:"user_id" db:"user_id"`
    Balance     int       `json:"balance" db:"balance"`
    Reserved    int       `json:"reserved" db:"reserved"`
    Available   int       `json:"available" db:"available"`
    LastUpdated time.Time `json:"last_updated" db:"last_updated"`
}

type Subscription struct {
    ID                    string    `json:"id" db:"id"`
    UserID                string    `json:"user_id" db:"user_id"`
    Plan                  string    `json:"plan" db:"plan"`
    Status                string    `json:"status" db:"status"`
    IsTrial               bool      `json:"is_trial" db:"is_trial"`
    TrialEndsAt          *time.Time `json:"trial_ends_at" db:"trial_ends_at"`
    CurrentPeriodEndsAt   *time.Time `json:"current_period_ends_at" db:"current_period_ends_at"`
    CreatedAt             time.Time `json:"created_at" db:"created_at"`
    UpdatedAt             time.Time `json:"updated_at" db:"updated_at"`
}
```

#### 3. 数据处理器

```go
// services/user/internal/handlers/user.go
package handlers

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/xxrenzhe/autoads/services/user/internal/services"
)

type UserHandler struct {
    userService *services.UserService
}

func NewUserHandler(userService *services.UserService) *UserHandler {
    return &UserHandler{userService: userService}
}

func (h *UserHandler) GetUserProfile(c *gin.Context) {
    userID := c.Param("userId")

    profile, err := h.userService.GetUserProfile(userID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"data": profile})
}

func (h *UserHandler) GetUserPermissions(c *gin.Context) {
    userID := c.Param("userId")

    permissions, err := h.userService.GetUserPermissions(userID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"data": permissions})
}

func (h *UserHandler) GetTokenBalance(c *gin.Context) {
    userID := c.Param("userId")

    balance, err := h.userService.GetTokenBalance(userID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"data": balance})
}
```

### Phase 3: 数据同步机制

#### 1. 数据同步服务

```go
// services/user/internal/services/sync.go
package services

import (
    "context"
    "database/sql"
    "time"
    "github.com/supabase-community/supabase-go"
)

type DataSyncService struct {
    supabaseClient *supabase.Client
    gcpDB          *sql.DB
    logger         Logger
}

type SyncDirection int

const (
    SyncToSupabase SyncDirection = iota
    SyncToGCP
    SyncBidirectional
)

func NewDataSyncService(supabaseClient *supabase.Client, gcpDB *sql.DB) *DataSyncService {
    return &DataSyncService{
        supabaseClient: supabaseClient,
        gcpDB:          gcpDB,
        logger:         NewLogger(),
    }
}

// 同步用户基础信息
func (s *DataSyncService) SyncUserProfile(ctx context.Context, userID string, direction SyncDirection) error {
    switch direction {
    case SyncToGCP:
        return s.syncFromSupabaseToGCP(ctx, userID)
    case SyncToSupabase:
        return s.syncFromGCPToSupabase(ctx, userID)
    case SyncBidirectional:
        return s.syncBidirectional(ctx, userID)
    }
    return nil
}

// 从Supabase同步到GCP
func (s *DataSyncService) syncFromSupabaseToGCP(ctx context.Context, userID string) error {
    // 1. 从Supabase获取用户数据
    var supabaseUser struct {
        ID            string    `json:"id"`
        Email         string    `json:"email"`
        DisplayName   string    `json:"display_name"`
        PhotoURL      string    `json:"photo_url"`
        SubscriptionPlan string  `json:"subscription_plan"`
        CreatedAt     time.Time `json:"created_at"`
        UpdatedAt     time.Time `json:"updated_at"`
    }

    _, err := s.supabaseClient.
        From("users").
        Select("*").
        Eq("id", userID).
        Single().
        Execute(&supabaseUser)

    if err != nil {
        return fmt.Errorf("failed to fetch user from Supabase: %w", err)
    }

    // 2. 获取权限信息
    var permissions struct {
        IsAdmin           bool   `json:"is_admin"`
        SubscriptionPlan  string `json:"subscription_plan"`
        CanUseAI          bool   `json:"can_use_ai"`
        CanCreateOffers   bool   `json:"can_create_offers"`
        MaxOffersPerMonth int    `json:"max_offers_per_month"`
    }

    _, err = s.supabaseClient.
        From("user_permissions").
        Select("*").
        Eq("user_id", userID).
        Single().
        Execute(&permissions)

    if err != nil {
        return fmt.Errorf("failed to fetch permissions from Supabase: %w", err)
    }

    // 3. 同步到GCP数据库
    tx, err := s.gcpDB.BeginTx(ctx, nil)
    if err != nil {
        return fmt.Errorf("failed to begin transaction: %w", err)
    }
    defer tx.Rollback()

    // 更新用户基础信息
    _, err = tx.ExecContext(ctx, `
        INSERT INTO shared_db.users (id, email, display_name, photo_url, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            photo_url = EXCLUDED.photo_url,
            updated_at = EXCLUDED.updated_at
    `, supabaseUser.ID, supabaseUser.Email, supabaseUser.DisplayName,
       supabaseUser.PhotoURL, "user", supabaseUser.CreatedAt, supabaseUser.UpdatedAt)

    if err != nil {
        return fmt.Errorf("failed to sync user to GCP: %w", err)
    }

    // 更新权限信息
    _, err = tx.ExecContext(ctx, `
        INSERT INTO shared_db.user_permissions
        (user_id, is_admin, subscription_plan, can_use_ai, can_create_offers, max_offers_per_month, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
            is_admin = EXCLUDED.is_admin,
            subscription_plan = EXCLUDED.subscription_plan,
            can_use_ai = EXCLUDED.can_use_ai,
            can_create_offers = EXCLUDED.can_create_offers,
            max_offers_per_month = EXCLUDED.max_offers_per_month,
            updated_at = EXCLUDED.updated_at
    `, userID, permissions.IsAdmin, permissions.SubscriptionPlan,
       permissions.CanUseAI, permissions.CanCreateOffers, permissions.MaxOffersPerMonth, time.Now())

    if err != nil {
        return fmt.Errorf("failed to sync permissions to GCP: %w", err)
    }

    return tx.Commit()
}

// 从GCP同步到Supabase
func (s *DataSyncService) syncFromGCPToSupabase(ctx context.Context, userID string) error {
    // 1. 从GCP获取用户数据
    var gcpUser struct {
        ID          string    `db:"id"`
        Email       string    `db:"email"`
        DisplayName string    `db:"display_name"`
        PhotoURL    string    `db:"photo_url"`
        Role        string    `db:"role"`
        CreatedAt   time.Time `db:"created_at"`
        UpdatedAt   time.Time `db:"updated_at"`
    }

    err := s.gcpDB.QueryRowContext(ctx, `
        SELECT id, email, display_name, photo_url, role, created_at, updated_at
        FROM shared_db.users WHERE id = $1
    `, userID).Scan(&gcpUser.ID, &gcpUser.Email, &gcpUser.DisplayName,
                  &gcpUser.PhotoURL, &gcpUser.Role, &gcpUser.CreatedAt, &gcpUser.UpdatedAt)

    if err != nil {
        return fmt.Errorf("failed to fetch user from GCP: %w", err)
    }

    // 2. 同步到Supabase
    _, err = s.supabaseClient.
        From("users").
        Upsert(map[string]interface{}{
            "id":           gcpUser.ID,
            "display_name": gcpUser.DisplayName,
            "photo_url":    gcpUser.PhotoURL,
            "updated_at":   time.Now(),
        }).
        Eq("id", userID).
        Execute()

    if err != nil {
        return fmt.Errorf("failed to sync user to Supabase: %w", err)
    }

    return nil
}

// 双向同步（智能冲突解决）
func (s *DataSyncService) syncBidirectional(ctx context.Context, userID string) error {
    // 1. 获取两边的数据最后更新时间
    var supabaseUpdatedAt, gcpUpdatedAt time.Time

    // 从Supabase获取
    _, err := s.supabaseClient.
        From("users").
        Select("updated_at").
        Eq("id", userID).
        Single().
        Execute(&supabaseUpdatedAt)

    if err != nil {
        s.logger.Warn("Failed to get Supabase update time", "userID", userID, "error", err)
    }

    // 从GCP获取
    err = s.gcpDB.QueryRowContext(ctx,
        "SELECT updated_at FROM shared_db.users WHERE id = $1", userID).
        Scan(&gcpUpdatedAt)

    if err != nil {
        s.logger.Warn("Failed to get GCP update time", "userID", userID, "error", err)
    }

    // 2. 根据更新时间决定同步方向
    if supabaseUpdatedAt.After(gcpUpdatedAt) {
        return s.syncFromSupabaseToGCP(ctx, userID)
    } else if gcpUpdatedAt.After(supabaseUpdatedAt) {
        return s.syncFromGCPToSupabase(ctx, userID)
    }

    // 如果时间相同，认为数据已同步
    s.logger.Info("Data already in sync", "userID", userID)
    return nil
}
```

#### 2. 实时同步触发器

```go
// services/user/internal/services/realtime_sync.go
package services

import (
    "context"
    "fmt"
    "github.com/supabase-community/supabase-go"
)

type RealtimeSyncService struct {
    supabaseClient *supabase.Client
    syncService    *DataSyncService
}

func NewRealtimeSyncService(supabaseClient *supabase.Client, syncService *DataSyncService) *RealtimeSyncService {
    return &RealtimeSyncService{
        supabaseClient: supabaseClient,
        syncService:    syncService,
    }
}

// 监听Supabase数据变更
func (s *RealtimeSyncService) StartSupabaseListener(ctx context.Context) error {
    // 监听users表变更
    _, err := s.supabaseClient.
        From("users").
        On("postgres_changes",
            map[string]interface{}{
                "event": "*",
                "schema": "public",
                "table": "users",
                "filter": "id=eq.{{user_id}}",
            }).
            Subscribe(func(payload interface{}) {
                s.handleSupabaseChange(ctx, payload)
            })

    if err != nil {
        return fmt.Errorf("failed to subscribe to users table: %w", err)
    }

    // 监听权限变更
    _, err = s.supabaseClient.
        From("user_permissions").
        On("postgres_changes",
            map[string]interface{}{
                "event": "*",
                "schema": "public",
                "table": "user_permissions",
                "filter": "user_id=eq.{{user_id}}",
            }).
        Subscribe(func(payload interface{}) {
            s.handleSupabaseChange(ctx, payload)
        })

    return err
}

func (s *RealtimeSyncService) handleSupabaseChange(ctx context.Context, payload interface{}) {
    // 解析payload获取用户ID和变更类型
    change := payload.(map[string]interface{})
    eventType := change["event_type"].(string)
    record := change["record"].(map[string]interface{})
    userID := record["id"].(string)

    switch eventType {
    case "INSERT", "UPDATE":
        err := s.syncService.SyncFromSupabaseToGCP(ctx, userID)
        if err != nil {
            s.logger.Error("Failed to sync change to GCP", "userID", userID, "error", err)
        }
    case "DELETE":
        // 处理删除逻辑
        s.logger.Info("User deleted in Supabase", "userID", userID)
    }
}
```

### Phase 4: 统一用户服务前端实现

#### 1. 合并Enhanced和Unified服务

```typescript
// apps/frontend/src/lib/services/UnifiedUserService.ts
class UnifiedUserService {
  private supabaseClient: SupabaseClient;
  private apiClient: ApiClient;
  private syncService: DataSyncService;

  constructor() {
    this.supabaseClient = createSupabaseClient();
    this.apiClient = new ApiClient();
    this.syncService = new DataSyncService();
  }

  // 统一的用户会话获取
  async getUserSession(userId?: string): Promise<UserSession> {
    try {
      // 1. 获取认证用户
      const { data: { user }, error: authError } = await this.supabaseClient.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('Not authenticated');

      // 2. 并行获取所有用户数据
      const [profile, permissions, subscription, tokens] = await Promise.all([
        this.getUserProfile(user.id),
        this.getUserPermissions(user.id),
        this.getUserSubscription(user.id),
        this.getTokenBalance(user.id)
      ]);

      // 3. 触发数据同步（如果需要）
      await this.syncService.ensureDataConsistency(user.id);

      return {
        user,
        profile,
        permissions,
        subscription,
        tokens,
        lastActivityAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[UnifiedUserService] Error getting user session:', error);
      throw error;
    }
  }

  // 统一的权限检查
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    try {
      // 优先从API获取（最新的权限数据）
      const permissions = await this.apiClient.get<UserPermissions>(`/api/v1/users/${userId}/permissions`);

      // 缓存到本地状态
      await this.updateLocalPermissions(userId, permissions);

      return permissions;
    } catch (error) {
      console.warn('[UnifiedUserService] API failed, using local permissions:', error);

      // 回退到Supabase数据
      return this.getLocalPermissions(userId);
    }
  }

  // 统一的Token管理
  async reserveTokens(userId: string, amount: number, reason: string, referenceId?: string): Promise<TokenReservation> {
    try {
      // 1. 先在本地预留
      const localReservation = await this.reserveLocalTokens(userId, amount, reason, referenceId);

      // 2. 同步到后端
      const apiReservation = await this.apiClient.post<TokenReservation>(`/api/v1/users/${userId}/tokens/reserve`, {
        amount,
        reason,
        referenceId
      });

      // 3. 确认本地预留
      await this.confirmLocalReservation(localReservation.id, apiReservation.id);

      return apiReservation;
    } catch (error) {
      // 回滚本地预留
      await this.cancelLocalReservation(userId, localReservation?.id);
      throw error;
    }
  }

  // 数据一致性检查
  async ensureDataConsistency(userId: string): Promise<void> {
    const inconsistencies = await this.syncService.detectInconsistencies(userId);

    if (inconsistencies.length > 0) {
      console.warn('[UnifiedUserService] Data inconsistencies detected:', inconsistencies);
      await this.syncService.resolveInconsistencies(userId, inconsistencies);
    }
  }

  // 私有方法：本地数据操作
  private async getUserProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await this.supabaseClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  private async getLocalPermissions(userId: string): Promise<UserPermissions> {
    const { data, error } = await this.supabaseClient
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  private async getTokenBalance(userId: string): Promise<TokenBalance> {
    const { data, error } = await this.supabaseClient
      .from('user_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return {
      ...data,
      available: data.balance - data.reserved
    };
  }

  private async getUserSubscription(userId: string): Promise<SubscriptionInfo> {
    const { data, error } = await this.supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  private async updateLocalPermissions(userId: string, permissions: UserPermissions): Promise<void> {
    await this.supabaseClient
      .from('user_permissions')
      .upsert({
        user_id: userId,
        ...permissions,
        updated_at: new Date().toISOString()
      });
  }

  private async reserveLocalTokens(userId: string, amount: number, reason: string, referenceId?: string): Promise<TokenReservation> {
    const reservationId = generateUUID();

    // 在本地数据库创建预留记录
    await this.supabaseClient
      .from('token_reservations')
      .insert({
        id: reservationId,
        user_id: userId,
        amount,
        reason,
        reference_id: referenceId,
        status: 'reserved',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30分钟过期
      });

    return {
      id: reservationId,
      amount,
      reason,
      referenceId,
      status: 'reserved',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };
  }
}

// 创建全局单例
export const unifiedUserService = new UnifiedUserService();
```

### Phase 5: Gateway更新和路由配置

#### 1. 更新Gateway路由配置

```yaml
# services/gateway-middleware/config/routes.yaml
backends:
  # 添加新的用户服务
  user: https://user-preview-yt54xvsg5q-an.a.run.app

routes:
  # 用户API路由
  - prefix: /api/v1/users
    backend: user
    methods: [GET, POST, PUT, DELETE]
    tokenCost: 0
    requireAuth: true
    description: "用户管理API"

  - prefix: /api/v1/users/:userId/profile
    backend: user
    methods: [GET, PUT]
    tokenCost: 0
    requireAuth: true
    description: "用户档案API"

  - prefix: /api/v1/users/:userId/permissions
    backend: user
    methods: [GET, POST]
    tokenCost: 0
    requireAuth: true
    description: "用户权限API"

  - prefix: /api/v1/users/:userId/tokens
    backend: user
    methods: [GET, POST, PUT]
    tokenCost: 0
    requireAuth: true
    description: "Token管理API"
```

## 📋 实施计划

### Week 1-2: 数据结构统一
- [ ] 更新Supabase数据库Schema
- [ ] 创建数据迁移脚本
- [ ] 执行数据迁移
- [ ] 验证数据一致性

### Week 3-4: 后端API实现
- [ ] 创建user微服务
- [ ] 实现核心API端点
- [ ] 添加数据库连接和模型
- [ ] 部署到Cloud Run

### Week 5-6: 数据同步机制
- [ ] 实现数据同步服务
- [ ] 添加实时监听器
- [ ] 实现冲突解决机制
- [ ] 添加监控和日志

### Week 7-8: 前端服务整合
- [ ] 合并Enhanced和Unified服务
- [ ] 更新前端Hooks
- [ ] 测试数据一致性
- [ ] 性能优化

### Week 9-10: 集成测试和部署
- [ ] 端到端测试
- [ ] 性能测试
- [ ] 生产环境部署
- [ ] 监控和告警设置

## 🎯 成功指标

### 技术指标
- **API响应时间** < 50ms (P95)
- **数据同步延迟** < 1秒
- **数据一致性** 99.9%
- **服务可用性** > 99.9%

### 业务指标
- **用户登录成功率** > 99.5%
- **权限检查准确率** 100%
- **Token操作成功率** > 99.9%
- **订阅状态同步** 实时

### 开发效率指标
- **API调用复杂度** 减少60%
- **代码重复率** 减少50%
- **维护成本** 降低40%

## 🔧 监控和维护

### 1. 数据同步监控
```typescript
// 监控指标
interface SyncMetrics {
  syncLatency: number;           // 同步延迟
  syncErrors: number;            // 同步错误次数
  dataInconsistencies: number;   // 数据不一致次数
  lastSyncTime: Date;            // 最后同步时间
}
```

### 2. 健康检查
```go
// 服务健康检查
func (s *UserService) HealthCheck(ctx context.Context) error {
    // 检查数据库连接
    if err := s.db.PingContext(ctx); err != nil {
        return err
    }

    // 检查Supabase连接
    if _, err := s.supabaseClient.From("users").Select("count").Execute(); err != nil {
        return err
    }

    return nil
}
```

### 3. 错误处理和恢复
```typescript
class ErrorRecoveryService {
  async handleSyncError(userID: string, error: Error): Promise<void> {
    // 1. 记录错误
    await this.logError(userID, error);

    // 2. 尝试自动恢复
    if (this.isRecoverable(error)) {
      await this.attemptRecovery(userID);
    }

    // 3. 通知管理员
    if (this.isCritical(error)) {
      await this.notifyAdmins(userID, error);
    }
  }
}
```

## 💎 总结

这个统一用户服务实现方案解决了以下关键问题：

1. **数据结构统一** - 统一Supabase和GCP的数据模型
2. **服务整合** - 合并Enhanced和Unified两个服务
3. **数据同步** - 实现双向数据同步和一致性保证
4. **API完整性** - 提供完整的用户管理API
5. **实时性** - 支持实时数据同步和变更通知

通过这个方案，AutoAds将拥有一个统一、高效、可靠的用户服务体系，为后续功能开发和用户体验提升提供坚实基础。