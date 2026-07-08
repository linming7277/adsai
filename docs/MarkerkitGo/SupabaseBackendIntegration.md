# Go微服务Supabase认证集成指南

## 概述

本文档说明如何在Go微服务中集成Supabase JWT验证，替换原有的Firebase认证。

## 已完成的工作

### 1. 核心Auth包

已创建 `pkg/auth/supabase.go`，提供：
- ✅ Supabase JWT验证
- ✅ JWKS自动获取和缓存
- ✅ 用户ID和email提取
- ✅ 线程安全实现

### 2. 中间件

已创建 `pkg/middleware/supabase.go`，提供：
- ✅ `SupabaseAuth()` - 强制认证中间件
- ✅ `SupabaseAuthOptional()` - 可选认证中间件
- ✅ `GetUserIDFromContext()` - 从context提取用户ID

## 集成步骤

### 步骤1: 安装依赖

```bash
cd pkg/auth
go get github.com/golang-jwt/jwt/v5@v5.2.1
go mod tidy
```

### 步骤2: 更新环境变量

在服务的环境变量中添加：

```bash
# Cloud Run服务配置
NEXT_PUBLIC_SUPABASE_URL=https://jzzvizacfyipzdyiqfzb.supabase.co
# 或
SUPABASE_URL=https://jzzvizacfyipzdyiqfzb.supabase.co
```

### 步骤3: 更新服务代码

#### 方案A: 使用标准库 (net/http)

```go
// services/[service]/main.go
package main

import (
    "net/http"
    "github.com/xxrenzhe/autoads/pkg/middleware"
)

func main() {
    mux := http.NewServeMux()
    
    // 受保护的API
    mux.Handle("/api/v1/protected", middleware.SupabaseAuth()(
        http.HandlerFunc(protectedHandler),
    ))
    
    http.ListenAndServe(":8080", mux)
}

func protectedHandler(w http.ResponseWriter, r *http.Request) {
    userID, _ := middleware.GetUserIDFromContext(r.Context())
    // 使用userID处理业务逻辑
}
```

#### 方案B: 使用Gin框架

```go
// services/[service]/main.go
package main

import (
    "strings"
    "github.com/gin-gonic/gin"
    "github.com/xxrenzhe/autoads/pkg/auth"
)

func SupabaseAuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.JSON(401, gin.H{"error": "Missing authorization header"})
            c.Abort()
            return
        }
        
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        verifier := auth.GetSupabaseVerifier()
        
        userID, err := verifier.ExtractSupabaseUserID(c.Request.Context(), tokenString)
        if err != nil {
            c.JSON(401, gin.H{"error": "Invalid or expired token"})
            c.Abort()
            return
        }
        
        c.Set("user_id", userID)
        c.Next()
    }
}

func main() {
    r := gin.Default()
    
    // 受保护的路由组
    api := r.Group("/api/v1")
    api.Use(SupabaseAuthMiddleware())
    {
        api.GET("/profile", profileHandler)
        api.POST("/data", dataHandler)
    }
    
    r.Run(":8080")
}

func profileHandler(c *gin.Context) {
    userID := c.GetString("user_id")
    c.JSON(200, gin.H{"user_id": userID})
}
```

#### 方案C: 使用Echo框架

```go
// services/[service]/main.go
package main

import (
    "strings"
    "github.com/labstack/echo/v4"
    "github.com/xxrenzhe/autoads/pkg/auth"
)

func SupabaseAuthMiddleware() echo.MiddlewareFunc {
    return func(next echo.HandlerFunc) echo.HandlerFunc {
        return func(c echo.Context) error {
            authHeader := c.Request().Header.Get("Authorization")
            if authHeader == "" {
                return echo.NewHTTPError(401, "Missing authorization header")
            }
            
            tokenString := strings.TrimPrefix(authHeader, "Bearer ")
            verifier := auth.GetSupabaseVerifier()
            
            userID, err := verifier.ExtractSupabaseUserID(c.Request().Context(), tokenString)
            if err != nil {
                return echo.NewHTTPError(401, "Invalid or expired token")
            }
            
            c.Set("user_id", userID)
            return next(c)
        }
    }
}

func main() {
    e := echo.New()
    
    // 受保护的路由组
    api := e.Group("/api/v1")
    api.Use(SupabaseAuthMiddleware())
    api.GET("/profile", profileHandler)
    
    e.Start(":8080")
}

func profileHandler(c echo.Context) error {
    userID := c.Get("user_id").(string)
    return c.JSON(200, map[string]string{"user_id": userID})
}
```

### 步骤4: 更新现有认证逻辑

#### 替换Firebase认证

**之前 (Firebase)**:
```go
import "github.com/xxrenzhe/autoads/pkg/auth"

func handler(w http.ResponseWriter, r *http.Request) {
    userID, err := auth.ExtractUserID(r)
    if err != nil {
        http.Error(w, "Unauthorized", 401)
        return
    }
    // ...
}
```

**之后 (Supabase)**:
```go
import "github.com/xxrenzhe/autoads/pkg/auth"

func handler(w http.ResponseWriter, r *http.Request) {
    userID, err := auth.ExtractSupabaseUserID(r.Context(), r)
    if err != nil {
        http.Error(w, "Unauthorized", 401)
        return
    }
    // ...
}
```

#### 兼容模式（同时支持Firebase和Supabase）

```go
func handler(w http.ResponseWriter, r *http.Request) {
    var userID string
    var err error
    
    // 先尝试Supabase
    userID, err = auth.ExtractSupabaseUserID(r.Context(), r)
    if err != nil {
        // 回退到Firebase
        userID, err = auth.ExtractUserID(r)
        if err != nil {
            http.Error(w, "Unauthorized", 401)
            return
        }
    }
    
    // 使用userID
}
```

### 步骤5: 更新Cloud Run配置

#### 添加环境变量

```bash
# 使用gcloud命令
gcloud run services update [SERVICE_NAME] \
  --project=gen-lang-client-0944935873 \
  --region=asia-northeast1 \
  --set-env-vars="NEXT_PUBLIC_SUPABASE_URL=https://jzzvizacfyipzdyiqfzb.supabase.co"

# 或使用Secret Manager
gcloud run services update [SERVICE_NAME] \
  --project=gen-lang-client-0944935873 \
  --region=asia-northeast1 \
  --update-secrets=NEXT_PUBLIC_SUPABASE_URL=NEXT_PUBLIC_SUPABASE_URL:latest
```

#### 更新Cloud Build配置

```yaml
# deployments/cloudbuild/build-[service].yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - '${_IMAGE}'
      - '--build-arg'
      - 'SUPABASE_URL=${_SUPABASE_URL}'
      - '.'

substitutions:
  _SUPABASE_URL: 'https://jzzvizacfyipzdyiqfzb.supabase.co'
```

## 服务迁移优先级

### 高优先级（立即迁移）

1. **billing** - 计费服务
   - 处理用户订阅和支付
   - 需要准确的用户身份验证

2. **offer** - 报价服务
   - 用户相关的报价数据
   - 需要用户认证

3. **adscenter** - 广告中心
   - 用户的Google Ads连接
   - 需要用户认证

### 中优先级（1周内迁移）

4. **console** - 控制台服务
   - 用户管理和配置
   - 需要用户认证

5. **notifications** - 通知服务
   - 用户通知
   - 需要用户认证

### 低优先级（可选）

6. **browser-exec** - 浏览器自动化
   - 可能不需要用户认证
   - 可以使用API Key

7. **siterank** - 网站评分
   - 可能不需要用户认证
   - 可以使用API Key

## 测试

### 单元测试

```go
// services/[service]/internal/handlers/handler_test.go
package handlers_test

import (
    "context"
    "net/http"
    "net/http/httptest"
    "testing"
    
    "github.com/xxrenzhe/autoads/pkg/auth"
)

func TestProtectedEndpoint(t *testing.T) {
    // 创建测试请求
    req := httptest.NewRequest("GET", "/api/v1/protected", nil)
    
    // 添加有效的Supabase token
    validToken := "eyJhbGci..." // 从测试环境获取
    req.Header.Set("Authorization", "Bearer "+validToken)
    
    // 创建响应记录器
    w := httptest.NewRecorder()
    
    // 调用handler
    handler(w, req)
    
    // 验证响应
    if w.Code != http.StatusOK {
        t.Errorf("Expected status 200, got %d", w.Code)
    }
}
```

### 集成测试

```bash
# 1. 获取测试token
TOKEN=$(curl -X POST 'https://jzzvizacfyipzdyiqfzb.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' | jq -r '.access_token')

# 2. 测试API
curl -X GET 'https://[service]-preview-644672509127.asia-northeast1.run.app/api/v1/protected' \
  -H "Authorization: Bearer $TOKEN"
```

## 监控和日志

### 添加日志

```go
import "log"

func SupabaseAuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            log.Printf("Missing authorization header from %s", c.ClientIP())
            c.JSON(401, gin.H{"error": "Missing authorization header"})
            c.Abort()
            return
        }
        
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        verifier := auth.GetSupabaseVerifier()
        
        userID, err := verifier.ExtractSupabaseUserID(c.Request.Context(), tokenString)
        if err != nil {
            log.Printf("Invalid token from %s: %v", c.ClientIP(), err)
            c.JSON(401, gin.H{"error": "Invalid or expired token"})
            c.Abort()
            return
        }
        
        log.Printf("Authenticated user: %s from %s", userID, c.ClientIP())
        c.Set("user_id", userID)
        c.Next()
    }
}
```

### Cloud Monitoring

```bash
# 查看认证失败的日志
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=[SERVICE_NAME] \
  AND textPayload=~'Invalid token'" \
  --project=gen-lang-client-0944935873 \
  --limit=50
```

## 故障排查

### 问题1: "failed to fetch supabase jwks"

**症状**: 服务无法启动或认证失败

**解决**:
```bash
# 检查环境变量
gcloud run services describe [SERVICE_NAME] \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env)"

# 测试JWKS端点
curl https://jzzvizacfyipzdyiqfzb.supabase.co/auth/v1/jwks
```

### 问题2: "invalid supabase token"

**症状**: 前端登录成功，但API调用失败

**解决**:
```bash
# 检查token格式
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq

# 验证token未过期
# exp字段应该大于当前时间戳
```

### 问题3: 性能问题

**症状**: 认证响应慢

**解决**:
```go
// 在服务启动时预加载JWKS
func main() {
    verifier := auth.GetSupabaseVerifier()
    if err := verifier.FetchJWKS(context.Background()); err != nil {
        log.Printf("Warning: Failed to preload JWKS: %v", err)
    }
    
    // 启动服务
    // ...
}
```

## 回滚计划

如果Supabase认证出现问题，可以快速回滚到Firebase：

1. **保留Firebase代码**（暂时不删除）
2. **使用兼容模式**（同时支持两种认证）
3. **通过环境变量切换**：
   ```bash
   USE_SUPABASE_AUTH=false  # 回滚到Firebase
   USE_SUPABASE_AUTH=true   # 使用Supabase
   ```

## 下一步

1. ✅ 完成auth包实现
2. ✅ 创建中间件
3. ⏳ 更新billing服务
4. ⏳ 更新offer服务
5. ⏳ 更新adscenter服务
6. ⏳ 测试和验证
7. ⏳ 部署到生产环境

## 相关文档

- `pkg/auth/SUPABASE_USAGE.md` - 详细使用指南
- `SUPABASE_NEXT_STEPS.md` - 下一步行动计划
- `docs/MarkerkitGo/MustKnowV4.md` - 架构文档
