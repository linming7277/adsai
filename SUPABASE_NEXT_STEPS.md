# 🎯 Supabase迁移 - 下一步行动

## ✅ 当前完成状态（90%）

### 已完成的工作

1. **✅ Supabase项目配置**
   - 项目创建完成
   - Google OAuth配置完成
   - API访问配置完成
   - 连接测试通过

2. **✅ 代码实现**
   - Supabase客户端
   - Google登录组件
   - Auth回调页面
   - Auth Context
   - 登录页面集成

3. **✅ 环境配置**
   - .env.local已更新
   - Secret Manager已配置
   - Cloud Run服务已更新
   - 服务命名已统一

4. **✅ 文档更新**
   - MustKnowV4.md已更新
   - CI/CD流程文档已添加
   - 测试脚本已创建

---

## 🚀 立即可以测试

### 测试1: 生产环境测试（推荐）

访问以下URL测试Google OAuth登录：

**Preview环境**:
```
https://www.urlchecker.dev/auth/sign-in
```

**Production环境**:
```
https://www.autoads.dev/auth/sign-in
```

**预期流程**:
1. 点击"使用Google登录"按钮
2. 跳转到Google授权页面
3. 选择Google账号并授权
4. 返回应用，看到"正在完成登录..."
5. 自动跳转到dashboard
6. ✅ 登录成功！

---

### 测试2: 本地开发测试

```bash
cd apps/frontend
npm run dev
```

访问: http://localhost:3000/auth/sign-in

---

## 📋 剩余工作（10%）

### 阶段3: 数据迁移（可选）

如果需要从Firestore迁移数据到Supabase PostgreSQL：

1. **审计当前Firestore使用**
   ```bash
   # 检查哪些数据存储在Firestore
   grep -r "firestore" apps/frontend/src
   ```

2. **设计PostgreSQL Schema**
   - 在Supabase SQL Editor中创建表
   - 设置Row Level Security (RLS)策略

3. **创建迁移脚本**
   - 从Firestore读取数据
   - 转换格式
   - 写入Supabase PostgreSQL

**注意**: 如果当前没有重要的Firestore数据，可以跳过此步骤。

---

### 阶段4: 移除Cloudflare（可选）

如果要完全移除Cloudflare CDN，直接使用Cloud Run：

1. **配置Cloud Run自定义域名**
   ```bash
   # Preview环境
   gcloud run domain-mappings create \
     --service=frontend-preview \
     --domain=www.urlchecker.dev \
     --region=asia-northeast1

   # Production环境
   gcloud run domain-mappings create \
     --service=frontend \
     --domain=www.autoads.dev \
     --region=asia-northeast1
   ```

2. **更新DNS记录**
   - 在域名提供商处更新DNS
   - 指向Cloud Run提供的IP地址

3. **等待SSL证书生成**
   - 通常需要15-30分钟

**注意**: 如果当前Cloudflare工作正常，可以保留。

---

### 阶段5: 清理Firebase（可选）

如果确认Supabase工作正常，可以清理Firebase：

1. **移除Firebase依赖**
   ```bash
   cd apps/frontend
   npm uninstall firebase reactfire firebase-admin
   ```

2. **删除Firebase相关文件**
   ```bash
   # 备份后删除
   rm -rf src/core/firebase
   ```

3. **移除Firebase环境变量**
   - 从.env.local删除NEXT_PUBLIC_FIREBASE_*变量

**注意**: 建议先在Preview环境测试1-2周，确认无问题后再清理。

---

### 阶段6: 后端集成（重要）

Go微服务需要验证Supabase JWT：

1. **安装JWT验证库**
   ```bash
   cd services/[service-name]
   go get github.com/golang-jwt/jwt/v5
   ```

2. **实现JWT验证**
   ```go
   // pkg/auth/supabase.go
   package auth

   import (
       "crypto/rsa"
       "encoding/json"
       "fmt"
       "net/http"
       "github.com/golang-jwt/jwt/v5"
   )

   // 从Supabase获取JWKS
   func GetSupabaseJWKS(projectURL string) (*rsa.PublicKey, error) {
       resp, err := http.Get(projectURL + "/auth/v1/jwks")
       if err != nil {
           return nil, err
       }
       defer resp.Body.Close()

       var jwks struct {
           Keys []struct {
               Kid string `json:"kid"`
               N   string `json:"n"`
               E   string `json:"e"`
           } `json:"keys"`
       }

       if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
           return nil, err
       }

       // 解析公钥
       // ...
       return publicKey, nil
   }

   // 验证Supabase JWT
   func VerifySupabaseToken(tokenString string, publicKey *rsa.PublicKey) (*jwt.Token, error) {
       token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
           if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
               return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
           }
           return publicKey, nil
       })

       return token, err
   }
   ```

3. **更新中间件**
   ```go
   // middleware/auth.go
   func AuthMiddleware() gin.HandlerFunc {
       return func(c *gin.Context) {
           authHeader := c.GetHeader("Authorization")
           if authHeader == "" {
               c.JSON(401, gin.H{"error": "Missing authorization header"})
               c.Abort()
               return
           }

           // 移除 "Bearer " 前缀
           tokenString := strings.TrimPrefix(authHeader, "Bearer ")

           // 验证Supabase JWT
           token, err := auth.VerifySupabaseToken(tokenString, publicKey)
           if err != nil {
               c.JSON(401, gin.H{"error": "Invalid token"})
               c.Abort()
               return
           }

           // 提取用户ID
           claims := token.Claims.(jwt.MapClaims)
           userID := claims["sub"].(string)

           c.Set("user_id", userID)
           c.Next()
       }
   }
   ```

**优先级**: 高 - 需要尽快实现以确保API安全

---

## 🎯 推荐的执行顺序

### 第一优先级（立即执行）

1. **✅ 测试登录功能**
   - 访问 https://www.urlchecker.dev/auth/sign-in
   - 测试Google OAuth登录
   - 验证用户数据

2. **🔄 实现后端JWT验证**
   - 更新Go微服务
   - 验证Supabase JWT
   - 测试API调用

### 第二优先级（1-2周内）

3. **数据迁移**（如果需要）
   - 审计Firestore使用
   - 迁移重要数据

4. **监控和优化**
   - 设置错误监控
   - 优化性能
   - 收集用户反馈

### 第三优先级（1个月内）

5. **清理Firebase**（确认无问题后）
   - 移除Firebase依赖
   - 删除相关代码
   - 更新文档

6. **移除Cloudflare**（可选）
   - 配置Cloud Run域名
   - 更新DNS
   - 测试性能

---

## 📊 成功指标

### 功能指标
- [ ] Google登录成功率 > 99%
- [ ] 登录速度 < 2秒
- [ ] API响应时间 < 200ms
- [ ] 零数据丢失

### 用户体验
- [ ] 登录流程顺畅
- [ ] 无明显延迟
- [ ] 错误提示清晰
- [ ] 用户数据正确

### 技术指标
- [ ] JWT验证正常
- [ ] RLS策略生效
- [ ] 日志完整
- [ ] 监控正常

---

## 🆘 故障排查

### 登录失败

1. **检查Supabase Dashboard**
   - Authentication > Users
   - 查看是否有新用户创建

2. **检查浏览器Console**
   - 查看JavaScript错误
   - 检查网络请求

3. **检查Cloud Run日志**
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=frontend-preview" \
     --project=gen-lang-client-0944935873 \
     --limit=50
   ```

### JWT验证失败

1. **检查Token格式**
   - 确保包含 "Bearer " 前缀
   - 验证Token未过期

2. **检查JWKS**
   - 访问 https://jzzvizacfyipzdyiqfzb.supabase.co/auth/v1/jwks
   - 确认公钥可访问

3. **检查Go服务日志**
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=[service-name]" \
     --project=gen-lang-client-0944935873 \
     --limit=50
   ```

---

## 📚 相关文档

- **SUPABASE_MIGRATION_STATUS.md** - 迁移状态
- **MIGRATION_TO_SUPABASE_PLAN.md** - 完整迁移计划
- **SUPABASE_SETUP_INSTRUCTIONS.md** - 设置说明
- **docs/MarkerkitGo/MustKnowV4.md** - 架构文档
- **docs/MarkerkitGo/SupabaseMigrationComplete.md** - 完成总结

---

## 🎉 总结

**当前状态**: 90% 完成

**已完成**:
- ✅ Supabase项目配置
- ✅ 前端代码实现
- ✅ 环境变量配置
- ✅ Cloud Run服务更新
- ✅ 文档更新

**待完成**:
- ⏳ 登录功能测试
- ⏳ 后端JWT验证实现

**下一步**: 
1. 测试登录功能
2. 实现后端JWT验证

**预计完成时间**: 1-2天

---

**准备好测试了吗？** 🚀

访问: https://www.urlchecker.dev/auth/sign-in
