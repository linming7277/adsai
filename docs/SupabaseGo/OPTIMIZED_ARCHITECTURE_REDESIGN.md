# AutoAds 架构重新设计方案

**版本**: v2.2
**日期**: 2025-10-21
**基于**: 对Gateway-Middleware和Supabase管理域的深入分析

---

## 🚨 关键发现：架构冲突

### 问题1: 管理域保留在Supabase的架构缺陷

**当前设计问题**：
- ❌ **双重权限管理**：Supabase feature_flags + Gateway权限系统
- ❌ **数据一致性风险**：权限配置分散，容易不一致
- ❌ **架构复杂化**：违反KISS原则，维护成本高
- ❌ **性能开销**：需要同时查询Supabase和Gateway权限

**根本原因**：
Gateway Middleware已经实现了完整的基于订阅套餐的权限控制系统，包括：
- 订阅套餐检查 (SubscriptionMiddleware)
- 功能权限验证 (PermissionMiddleware)
- 请求路由权限配置
- Redis缓存优化

### 问题2: feature_flags功能重复

**Gateway现有权限机制**：
```go
// 1. 订阅套餐检查
userTier := "premium" // 从billing service获取
planID := "premium_monthly" // 订阅计划

// 2. 权限检查
routes:
  - prefix: /api/v1/ai-scoring
    RequireTier: ["premium", "enterprise"]
    RequirePermission: "ai_scoring_enabled"

  - prefix: /api/v1/bulk-operations
    RequireTier: ["enterprise"]
    RequirePermission: "bulk_operations_enabled"
```

**冲突分析**：
- **功能开关重复**：两套系统管理相同的功能
- **优先级混乱**：哪个系统的规则优先执行？
- **缓存不一致**：Supabase和Gateway缓存不同步
- **运维困难**：需要在两个地方配置功能开关

---

## ✅ 优化架构方案

### 核心原则：统一化 + 简化

**新的架构原则**：
1. **Supabase仅用于认证**：严格遵循DATABASE_ARCHITECTURE_CURRENT.md
2. **Gateway统一权限管理**：所有权限检查集中在Gateway
3. **Cloud SQL统一数据存储**：包括管理域数据
4. **配置驱动功能开关**：通过Gateway配置管理

### 优化后的架构图

```
Frontend (Next.js)
  ↓ OAuth登录
Supabase Auth (仅认证)
  ↓ JWT Token
Gateway Middleware (统一权限控制)
  ├─ JWT验证
  ├─ 订阅套餐查询 (Redis缓存)
  ├─ 权限检查 (配置驱动)
  ├─ 功能开关 (配置文件)
  └─ 反向代理
  ↓
Cloud SQL (统一数据存储)
  ├─ billing schema (订阅、代币)
  ├─ console schema (管理数据)
  ├─ offers schema (业务数据)
  └─ 其他业务schema
```

---

## 🛠️ 具体实现方案

### 1. Supabase架构简化

**仅保留认证功能**：
```sql
-- Supabase只需要
auth.users                    -- 用户认证 (Supabase自动管理)
-- 移除所有业务表和管理表
```

**移除的管理域表**（迁移到Cloud SQL）：
- ❌ `public.feature_flags` → 迁移到 `console.feature_flags`
- ❌ `public.admin_recovery_codes` → 迁移到 `console.admin_recovery_codes`
- ❌ `public.critical_admin_actions` → 迁移到 `console.critical_admin_actions`
- ❌ 其他所有admin_*表

### 2. Gateway功能开关配置

**基于配置文件的功能开关**：
```yaml
# config/routes.yaml
environment: production

# 功能开关配置
features:
  ai_scoring_enabled:
    enabled: true
    required_tiers: ["premium", "enterprise"]
    description: "AI评分功能"

  bulk_operations_enabled:
    enabled: false
    required_tiers: ["enterprise"]
    description: "批量操作功能"

  export_enabled:
    enabled: true
    required_tiers: ["starter", "premium", "enterprise"]
    description: "数据导出功能"

# 路由权限配置
routes:
  - prefix: /api/v1/offers/ai-score
    backend: siterank
    methods: [POST]
    requireAuth: true
    RequireTier: ["premium", "enterprise"]
    RequirePermission: "ai_scoring_enabled"
    tokenCost: 10

  - prefix: /api/v1/offers/bulk-operation
    backend: offer
    methods: [POST]
    requireAuth: true
    RequireTier: ["enterprise"]
    RequirePermission: "bulk_operations_enabled"
    tokenCost: 0
```

### 3. Cloud SQL Console Schema设计

**统一的管理域数据**：
```sql
-- console schema (Cloud SQL)
CREATE TABLE console.feature_flags (
    key TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT FALSE,
    required_tiers TEXT[] DEFAULT ARRAY['premium'],
    description TEXT,
    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE console.admin_recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE TABLE console.critical_admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 其他管理表...
```

### 4. Gateway权限检查优化

**集成功能开关的权限中间件**：
```go
// 优化后的PermissionMiddleware
func (m *PermissionMiddleware) Handler() gin.HandlerFunc {
    return func(c *gin.Context) {
        route := m.config.FindRoute(c.Request.URL.Path, c.Request.Method)
        if route == nil {
            c.Next()
            return
        }

        userTier, err := GetUserTier(c)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "User tier not found"})
            c.Abort()
            return
        }

        // 1. 检查套餐要求
        if len(route.RequireTier) > 0 && !containsTier(route.RequireTier, userTier) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": fmt.Sprintf("This feature requires tier: %s", strings.Join(route.RequireTier, ", ")),
                "code": "INSUFFICIENT_TIER",
            })
            c.Abort()
            return
        }

        // 2. 检查功能权限
        if route.RequirePermission != "" {
            hasPermission := m.checkFeaturePermission(c, route.RequirePermission, userTier)
            if !hasPermission {
                c.JSON(http.StatusForbidden, gin.H{
                    "error": fmt.Sprintf("Feature not enabled: %s", route.RequirePermission),
                    "code": "FEATURE_DISABLED",
                })
                c.Abort()
                return
            }
        }

        c.Next()
    }
}

// 检查功能权限
func (m *PermissionMiddleware) checkFeaturePermission(c *gin.Context, permission string, userTier string) bool {
    // 从配置中检查功能是否启用
    feature, exists := m.config.Features[permission]
    if !exists || !feature.Enabled {
        return false
    }

    // 检查用户套餐是否符合要求
    for _, tier := range feature.RequiredTiers {
        if tier == userTier {
            return true
        }
    }

    return false
}
```

---

## 📊 迁移计划

### 阶段1: 架构重构 (1-2周)

#### 1.1 Gateway权限系统增强
- [ ] 扩展配置文件支持功能开关
- [ ] 优化PermissionMiddleware集成功能检查
- [ ] 实现配置热更新机制
- [ ] 添加权限变更的监控和日志

#### 1.2 Cloud SQL Console Schema创建
- [ ] 设计console schema表结构
- [ ] 创建管理域迁移脚本
- [ ] 实现RLS策略和索引
- [ ] 创建管理API接口

### 阶段2: 数据迁移 (1周)

#### 2.1 Supabase数据导出
- [ ] 备份现有Supabase管理域数据
- [ ] 导出feature_flags数据
- [ ] 导出admin_recovery_codes数据
- [ ] 导出critical_admin_actions数据

#### 2.2 Cloud SQL数据导入
- [ ] 创建console schema迁移
- [ ] 导入管理域数据
- [ ] 数据一致性验证
- [ ] 性能测试和优化

### 阶段3: 应用代码更新 (1周)

#### 3.1 管理后台API重构
- [ ] 更新管理API指向Cloud SQL
- [ ] 实现新的权限检查逻辑
- [ ] 更新前端权限配置
- [ ] 测试管理功能完整性

#### 3.2 Supabase清理
- [ ] 删除Supabase中的管理域表
- [ ] 优化Supabase配置
- [ ] 更新文档和说明
- [ ] 清理冗余代码

### 阶段4: 验证和部署 (1周)

#### 4.1 集成测试
- [ ] 端到端功能测试
- [ ] 权限系统验证
- [ ] 性能基准测试
- [ ] 安全审查

#### 4.2 生产部署
- [ ] 灰度发布
- [ ] 监控和告警
- [ ] 回滚预案
- [ ] 文档更新

---

## 🎯 预期收益

### 1. 架构简化
- **统一权限管理**：Gateway集中控制，消除重复
- **数据存储统一**：所有业务数据在Cloud SQL
- **Supabase职责单一**：仅负责认证，简化架构

### 2. 性能优化
- **减少数据库查询**：Gateway配置缓存，减少实时查询
- **权限检查优化**：内存中的配置检查，响应更快
- **缓存一致性**：单一缓存源，避免不一致

### 3. 运维效率
- **配置集中管理**：功能开关通过配置文件管理
- **权限变更简单**：修改配置即可，无需数据库操作
- **监控简化**：单一权限系统，监控和告警更简单

### 4. 开发效率
- **逻辑清晰**：权限逻辑集中，易于理解和维护
- **测试简单**：单一权限系统，测试覆盖更全面
- **部署灵活**：配置驱动，不同环境灵活配置

---

## 🔒 安全考虑

### 1. 权限安全
- **配置加密**：敏感配置加密存储
- **配置签名**：防止配置被篡改
- **权限审计**：记录所有权限检查日志

### 2. 数据安全
- **访问控制**：Console schema严格的RLS策略
- **审计日志**：完整的管理操作审计
- **备份加密**：管理数据备份加密

### 3. 网络安全
- **HTTPS传输**：所有配置传输加密
- **访问限制**：管理API IP白名单
- **权限隔离**：不同角色权限严格隔离

---

## ⚠️ 风险评估

### 高风险
1. **权限系统重构风险**
   - 影响：所有用户权限检查
   - 缓解：分阶段重构，保持向后兼容

2. **数据迁移风险**
   - 影响：管理数据丢失或损坏
   - 缓解：完整备份，分步迁移，回滚方案

### 中风险
1. **配置管理复杂性**
   - 影响：配置错误导致权限问题
   - 缓解：配置验证，版本控制，灰度发布

2. **性能回退风险**
   - 影响：新架构性能不如预期
   - 缓解：性能测试，优化缓存，监控告警

---

## 📈 成功指标

### 技术指标
- **权限检查延迟**：< 10ms (当前: ~50ms)
- **配置更新时间**：< 30秒 (热更新)
- **数据一致性**：100% (无权限冲突)
- **系统可用性**：99.9% (重构期间)

### 业务指标
- **功能开关变更效率**：提升80% (配置vs数据库)
- **权限问题处理时间**：减少60% (统一系统)
- **管理功能完整性**：100% (无功能缺失)
- **用户权限准确性**：100% (消除冲突)

---

**结论**：通过统一Gateway权限管理，简化Supabase职责，可以实现更清晰、高效、安全的架构设计。建议按照此方案进行架构重构。