# 管理后台URL优化方案

> **日期**: 2025-10-09
> **问题**: `https://console.autoads.dev/console/manage/index.html` 路径冗余
> **目标**: 简化为 `https://www.autoads.dev/manage`
> **注意**: 避免使用 `/admin` 路径（易被 Cloudflare WAF 屏蔽）

---

## 🔍 **问题分析**

### **当前URL结构**
```
https://console.autoads.dev/console/manage/index.html
                        ^^^^^^^^ 重复的 console 前缀
```

### **根本原因**
1. Console Service (`console-yt54xvsg5q-an.a.run.app`) 原本服务静态文件
2. 域名 `console.autoads.dev` 直接映射到 Console Service
3. 虽然代码中已注释"静态UI文件服务已删除"，但 `static/` 目录仍存在
4. Admin 页面已迁移到 Next.js (`/app/admin/*`)，但访问路径未更新

---

## ✅ **推荐方案：使用 Frontend 统一入口**

### **方案A：使用主域名子路径（推荐）**

#### **URL结构**
```
生产环境：https://www.autoads.dev/manage
预发环境：https://www.urlchecker.dev/manage
```

#### **优点**
- ✅ 与用户Dashboard (`/dashboard`) 统一域名
- ✅ 共享 Supabase 认证 Session
- ✅ 无需额外域名配置
- ✅ 简化Cookie跨域问题

#### **实施步骤**

1. **确认 Frontend 路由已就绪**
   ```
   ✅ /app/admin/page.tsx - 主仪表盘
   ✅ /app/admin/tokens/page.tsx - Token管理
   ✅ /app/admin/offers/page.tsx - Offer管理
   ✅ /app/admin/subscriptions/page.tsx - 订阅管理
   ✅ /app/admin/security/page.tsx - 安全设置
   ✅ /app/admin/audit/page.tsx - 审计日志
   ```

2. **更新文档和链接**
   - 更新所有文档中的管理后台链接
   - 添加从旧URL的301重定向（见方案C）

3. **测试访问**
   ```bash
   # 预发环境
   curl -I https://www.urlchecker.dev/admin

   # 生产环境（部署后）
   curl -I https://www.autoads.dev/admin
   ```

---

### **方案B：使用独立子域名**

#### **URL结构**
```
生产环境：https://admin.autoads.dev
预发环境：https://admin-preview.autoads.dev
```

#### **优点**
- ✅ 职责分离清晰
- ✅ 可独立配置安全策略
- ✅ SEO友好（robots.txt 可单独配置）

#### **缺点**
- ❌ 需要额外域名验证和SSL证书
- ❌ Cookie跨域需要特殊处理
- ❌ 维护成本增加

#### **实施步骤**

1. **配置DNS记录**
   ```bash
   # 在域名提供商添加 CNAME 记录
   admin.autoads.dev -> ghs.googlehosted.com
   admin-preview.autoads.dev -> ghs.googlehosted.com
   ```

2. **创建 Cloud Run 域名映射**
   ```bash
   # 生产环境
   gcloud run domain-mappings create \
     --service=frontend \
     --domain=admin.autoads.dev \
     --region=asia-northeast1

   # 预发环境
   gcloud run domain-mappings create \
     --service=frontend-preview \
     --domain=admin-preview.autoads.dev \
     --region=asia-northeast1
   ```

3. **配置 Next.js 路径重写**

   在 `next.config.js` 添加：
   ```javascript
   async rewrites() {
     return [
       {
         source: '/',
         destination: '/admin',
         has: [
           {
             type: 'host',
             value: 'admin.autoads.dev'
           }
         ]
       }
     ];
   }
   ```

---

### **方案C：Console Service 重定向（过渡方案）**

#### **目的**
确保旧链接不失效，平滑迁移

#### **实施步骤**

1. **在 Console Service 添加重定向中间件**

   修改 `/Users/jason/Documents/Kiro/autoads/services/console/main.go`:

   ```go
   // 在 main() 函数中添加
   mux.HandleFunc("/console/", func(w http.ResponseWriter, r *http.Request) {
       // 重定向到 Next.js Admin
       newPath := strings.TrimPrefix(r.URL.Path, "/console")
       targetURL := "https://www.autoads.dev/admin" + newPath
       http.Redirect(w, r, targetURL, http.StatusMovedPermanently)
   })

   mux.HandleFunc("/manage/", func(w http.ResponseWriter, r *http.Request) {
       newPath := strings.TrimPrefix(r.URL.Path, "/manage")
       targetURL := "https://www.autoads.dev/admin" + newPath
       http.Redirect(w, r, targetURL, http.StatusMovedPermanently)
   })
   ```

2. **添加根路径重定向**
   ```go
   mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
       if r.URL.Path == "/" || r.URL.Path == "/index.html" {
           http.Redirect(w, r, "https://www.autoads.dev/admin", http.StatusMovedPermanently)
           return
       }
       // 其他请求继续处理
       h.ServeHTTP(w, r)
   })
   ```

3. **重新部署 Console Service**
   ```bash
   cd /Users/jason/Documents/Kiro/autoads
   gcloud builds submit --config=deployments/cloudbuild/build-console.yaml
   ```

---

## 🎯 **推荐实施路径**

### **阶段1：立即实施（今天）**
- ✅ 采用**方案A**：使用 `https://www.autoads.dev/admin`
- ✅ 在 Console Service 添加**方案C**的重定向（平滑过渡）
- ✅ 更新所有内部文档链接

### **阶段2：1周内**
- 验证所有重定向正常工作
- 监控访问日志，确认无404错误
- 更新外部文档（如有）

### **阶段3：1个月后（可选）**
- 考虑是否实施**方案B**（独立子域名）
- 删除 Console Service 的静态文件目录
- 清理重定向代码

---

## 📝 **配置检查清单**

### **Frontend (Next.js)**
- [ ] `/app/admin/*` 路由可访问
- [ ] AdminGuard 权限验证正常
- [ ] AdminSidebar 导航正常
- [ ] API Client 配置正确

### **Console Service**
- [ ] 添加重定向规则
- [ ] 测试旧URL重定向
- [ ] 部署到生产环境

### **域名和DNS**
- [ ] `www.autoads.dev` 正常解析
- [ ] SSL证书有效
- [ ] （可选）配置 `admin.autoads.dev`

---

## 🧪 **测试脚本**

```bash
#!/bin/bash

echo "Testing URL redirects..."

# 测试1：旧Console URL应重定向
echo "1. Testing old console URL..."
curl -I https://console.autoads.dev/console/manage/index.html 2>&1 | grep -E "HTTP|Location"

# 测试2：新Admin URL应可访问
echo "2. Testing new admin URL..."
curl -I https://www.autoads.dev/admin 2>&1 | grep -E "HTTP"

# 测试3：API端点仍可访问
echo "3. Testing Console API..."
curl -I https://console-yt54xvsg5q-an.a.run.app/healthz 2>&1 | grep HTTP

echo "Done!"
```

---

## 📊 **URL映射对照表**

| 旧URL | 新URL | 状态码 |
|-------|-------|--------|
| `console.autoads.dev/console/manage/index.html` | `www.autoads.dev/admin` | 301 |
| `console.autoads.dev/manage/tokens.html` | `www.autoads.dev/admin/tokens` | 301 |
| `console.autoads.dev/manage/offers.html` | `www.autoads.dev/admin/offers` | 301 |
| `console.autoads.dev/manage/subscriptions.html` | `www.autoads.dev/admin/subscriptions` | 301 |
| `console.autoads.dev/manage/security.html` | `www.autoads.dev/admin/security` | 301 |
| `console.autoads.dev/manage/audit-logs.html` | `www.autoads.dev/admin/audit` | 301 |

---

## 🔒 **安全考虑**

1. **AdminGuard 中间件** - 确保只有管理员可访问 `/admin` 路由
2. **CORS配置** - Console API需允许来自 `www.autoads.dev` 的请求
3. **Session共享** - Frontend和API使用同一个Supabase Project
4. **审计日志** - 所有管理操作记录到 `admin_audit_log` 表

---

## 💡 **最终建议**

**立即采用方案A + 方案C的组合：**

1. ✅ 主入口：`https://www.autoads.dev/admin`
2. ✅ Console Service 添加重定向（向下兼容）
3. ✅ 保留 `console.autoads.dev` 域名用于API访问
4. ✅ 6个月后评估是否需要 `admin.autoads.dev` 独立域名

**优先级**: 🔴 高（影响用户体验）

**预计工作量**: 2小时（重定向代码 + 测试 + 部署）
