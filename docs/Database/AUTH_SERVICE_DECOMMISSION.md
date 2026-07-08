# auth-service 下线决策文档

**日期**: 2025-10-21
**决策**: 下线并移除 auth-service
**状态**: ✅ 已完成

---

## 背景

在架构review过程中，发现 `services/auth/` 目录包含未使用的认证服务代码。经调查确认该服务从未部署到Cloud Run，且所有认证功能已由Supabase托管服务实现。

---

## 调查结果

### 1. 部署状态
```bash
$ gcloud run services list --format="table(name)"
```
**结果**: 仅有 `gateway-middleware-preview` 和 `bff-preview`，**无 auth-service**

### 2. 代码引用检查
```bash
$ grep -r "services/auth" services/
```
**结果**: **0个引用** - 没有任何服务导入或调用 auth-service

```bash
$ grep -r "AUTH_SERVICE_URL" .
```
**结果**: **0个引用** - 没有服务配置auth-service环境变量

### 3. 实际认证架构

**当前生产架构**:
```
Frontend → Supabase SDK → Supabase Auth (托管服务)
                            ↓
                        JWT Token
                            ↓
Gateway Middleware → pkg/auth/supabase.go → Supabase JWKS验证
```

**关键代码**:
```go
// services/gateway-middleware/internal/middleware/jwt.go
type JWTMiddleware struct {
    verifier *SupabaseTokenVerifier  // 直接验证Supabase JWT
}

func (m *JWTMiddleware) validateToken(ctx context.Context, tokenString string) (*AuthContext, error) {
    // 通过Supabase JWKS验证JWT，无需调用auth-service
    claims, err := m.verifier.Verify(ctx, tokenString)
    return &AuthContext{UserID: claims.Subject}, nil
}
```

**pkg/auth 用途**:
- `pkg/auth/supabase.go`: Supabase JWT验证工具库
- `pkg/auth/middleware.go`: 认证中间件辅助函数
- **非独立服务，仅为工具库**

---

## 下线决策

### 下线理由

1. **从未部署**: auth-service从未部署到Cloud Run生产环境
2. **无服务调用**: 没有任何微服务引用或调用auth-service
3. **功能冗余**: Supabase托管服务已完整覆盖认证需求
4. **避免误解**: 保留未使用代码易引起架构理解混淆

### 保留内容

✅ **pkg/auth/** 包 - **保留并继续使用**
- 用途: Supabase JWT验证工具库
- 使用方: gateway-middleware, bff等服务
- 功能: JWT验证、用户信息提取、中间件辅助

---

## 执行步骤

### 1. 验证无依赖
```bash
# 确认无代码引用
grep -r "services/auth" services/  # 结果: 0
grep -r "import.*services/auth" . # 结果: 0

# 确认无部署配置
grep -r "auth-service" deployments/ .github/ # 结果: 仅文档引用
```

### 2. 移除代码
```bash
# 删除服务目录
rm -rf /path/to/adsai/services/auth

# 验证删除
ls -la services/ | grep auth  # 结果: 无输出
```

### 3. 更新测试
```go
// test/adapter_test_new.go (line 111)
// Before:
serviceName: "auth-service",

// After:
serviceName: "test-supabase-service",  // 使用测试用例名称
```

### 4. 更新文档
**DATABASE_ARCHITECTURE_CURRENT.md** (v1.1 → v1.2):
```markdown
认证架构:
  - Supabase Auth (托管服务)
  - Frontend → Supabase SDK → Supabase Auth
  - 无需独立的Go认证服务

⚠️ 架构说明 - auth-service已下线:
  - services/auth/ 代码已于 2025-10-21 移除
  - 原因: 从未部署到Cloud Run，所有服务使用Supabase托管认证
  - JWT验证: gateway-middleware直接使用pkg/auth/supabase.go工具
  - pkg/auth/ 保留: 作为Supabase JWT验证的工具库继续使用
```

---

## 验证结果

### Git变更
```bash
$ git status --short
D  services/auth/cmd/auth-server/main.go    # 删除auth-service
M  test/adapter_test_new.go                 # 更新测试用例
?? docs/Database/AUTH_SERVICE_DECOMMISSION.md  # 新增决策文档
```

### 服务列表
```bash
$ ls services/
adscenter       billing         browser-exec    console
gateway-middleware   offer      projector       siterank
user            useractivity    bff             batchopen
```
✅ **无 auth 目录**

### 导入检查
```bash
$ grep -r "services/auth" services/
```
✅ **0个结果 - 确认无依赖**

---

## 影响评估

### ✅ 无影响项

- **已部署服务**: 无变化，auth-service从未部署
- **认证流程**: 无变化，继续使用Supabase托管服务
- **JWT验证**: 无变化，pkg/auth工具库保留
- **API接口**: 无变化，无服务调用auth-service

### 📝 仅影响项

- **代码库清理**: 移除未使用代码，降低维护成本
- **架构清晰度**: 消除未部署服务带来的混淆
- **文档准确性**: 架构文档与实际部署一致

---

## 结论

✅ **auth-service已成功下线**

**关键要点**:
1. services/auth/ 目录已删除
2. pkg/auth/ 工具库保留并继续使用
3. 所有认证由Supabase托管服务处理
4. gateway-middleware使用pkg/auth进行JWT验证
5. 架构文档已更新反映当前状态

**认证架构**:
- **Frontend**: Supabase SDK → Supabase Auth
- **Backend**: pkg/auth → Supabase JWKS验证
- **无独立认证服务**: 简化架构，降低维护成本

---

## 参考文档

- [DATABASE_ARCHITECTURE_CURRENT.md](./DATABASE_ARCHITECTURE_CURRENT.md) - v1.2
- [pkg/auth/supabase.go](/path/to/adsai/pkg/auth/supabase.go)
- [gateway-middleware JWT中间件](/path/to/adsai/services/gateway-middleware/internal/middleware/jwt.go)
