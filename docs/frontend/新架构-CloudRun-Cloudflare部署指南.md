# 前端部署架构：Cloud Run + Cloudflare

## 架构概览

```
用户浏览器
    ↓
Cloudflare CDN (preview.example.com)
    ↓ (代理所有请求)
Cloud Run (Next.js SSR + API)
    ↓
Firebase Services (Firestore, Auth, Storage)
```

### 架构优势

1. **完全兼容 Makerkit**
   - 保持原生 `session` cookie 设计（无 4KB 限制）
   - 使用 `nookies` 库的标准实现
   - 无需修改任何 Makerkit 认证代码

2. **Cloudflare 增强**
   - 全球 CDN 加速（静态资源缓存）
   - DDoS 防护（自动防御攻击）
   - Web Application Firewall (WAF)
   - 灵活的缓存规则配置
   - SSL/TLS 加密（免费证书）

3. **Cloud Run 优势**
   - 自动扩缩容（0 实例到 N 实例）
   - 按请求计费（无流量时不产生费用）
   - 容器化部署（完整控制运行环境）
   - 支持 SSR + API 统一部署

4. **移除 Firebase Hosting**
   - 消除 `__session` cookie 4KB 限制
   - 消除 cookie 转发限制
   - 简化架构（减少一层代理）

## 实施步骤

### 步骤 1：配置 Cloud Run 自定义域名

```bash
# 1. 设置项目和区域
export PROJECT_ID="adsai-test-445804"
export REGION="asia-east1"
export SERVICE_NAME="frontend"

# 2. 为 Cloud Run 服务添加自定义域名映射
gcloud run domain-mappings create \
  --service=${SERVICE_NAME} \
  --domain=preview.example.com \
  --region=${REGION} \
  --project=${PROJECT_ID}

# 3. 获取 Cloud Run 服务的 DNS 记录信息
gcloud run domain-mappings describe \
  --domain=preview.example.com \
  --region=${REGION} \
  --project=${PROJECT_ID}
```

输出示例：
```
resourceRecords:
- name: preview.example.com
  rrdata: ghs.googlehosted.com
  type: CNAME
```

**记录此 CNAME 值**（下一步 Cloudflare 配置需要）

### 步骤 2：配置 Cloudflare DNS

登录 Cloudflare Dashboard → 选择域名 `preview.example.com`

#### 2.1 删除旧的 DNS 记录（如果存在）

删除 `www` 子域名下所有旧的 A/AAAA/CNAME 记录

#### 2.2 添加新的 CNAME 记录

1. 点击 "Add record"
2. 配置如下：
   - **Type**: CNAME
   - **Name**: www
   - **Target**: `ghs.googlehosted.com` （步骤 1 获取的值）
   - **Proxy status**: ✅ Proxied (橙色云朵图标)
   - **TTL**: Auto

3. 点击 "Save"

#### 2.3 验证 DNS 配置

```bash
# 等待 DNS 传播（通常 1-5 分钟）
dig preview.example.com CNAME

# 应看到：
# preview.example.com. 300 IN CNAME ghs.googlehosted.com.
```

### 步骤 3：配置 Cloudflare SSL/TLS

1. 进入 Cloudflare Dashboard → SSL/TLS
2. 选择加密模式：**Full (strict)**
   - Cloudflare ↔ Cloud Run 使用加密连接
   - 验证 Cloud Run 的 SSL 证书有效性

### 步骤 4：配置 Cloudflare 缓存规则

#### 4.1 Page Rules（页面规则）

进入 Cloudflare Dashboard → Rules → Page Rules

**规则 1：API 路由不缓存**
- URL 模式：`preview.example.com/api/*`
- 设置：
  - Cache Level: Bypass
  - Disable Performance

**规则 2：静态资源缓存**
- URL 模式：`preview.example.com/_next/static/*`
- 设置：
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month

**规则 3：Next.js 数据请求不缓存**
- URL 模式：`preview.example.com/_next/data/*`
- 设置：
  - Cache Level: Bypass

#### 4.2 Browser Cache TTL

进入 Cloudflare Dashboard → Caching → Configuration
- Browser Cache TTL: 4 hours（适合 SSR 页面）

### 步骤 5：修改 GitHub Actions 部署流程

编辑 `.github/workflows/deploy-preview-frontend.yml`

#### 5.1 移除 Firebase Hosting 部署步骤

删除以下代码块：

```yaml
# ❌ 删除此部分
- name: Deploy to Firebase Hosting Preview
  uses: FirebaseExtended/action-hosting-deploy@v0
  with:
    repoToken: ${{ secrets.GITHUB_TOKEN }}
    firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_AUTOADS_TEST }}
    projectId: adsai-test-445804
    channelId: preview
```

#### 5.2 确保 Cloud Run 部署步骤配置正确

保留并验证以下配置：

```yaml
- name: Deploy to Cloud Run
  run: |
    gcloud run deploy frontend \
      --image ${{ env.IMAGE_NAME }}:${{ env.SHORT_SHA }} \
      --region asia-east1 \
      --platform managed \
      --allow-unauthenticated \
      --set-env-vars="NEXT_PUBLIC_SITE_URL=https://preview.example.com,NEXT_PUBLIC_EMULATOR=false" \
      --max-instances=10 \
      --min-instances=0
```

#### 5.3 更新输出链接

```yaml
- name: Comment Preview URL
  uses: actions/github-script@v6
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: '✅ Preview deployed to https://preview.example.com'
      })
```

### 步骤 6：修改生产环境部署流程

编辑 `.github/workflows/deploy-prod-frontend.yml`

应用与步骤 5 相同的修改：
1. 移除 Firebase Hosting 部署步骤
2. 保留 Cloud Run 部署步骤
3. 更新输出链接为 `https://preview.example.com`

### 步骤 7：验证部署

#### 7.1 触发部署

```bash
# 提交所有更改
git add .
git commit -m "refactor(deploy): 迁移到 Cloud Run + Cloudflare 架构"
git push origin main
```

#### 7.2 监控部署日志

```bash
# 查看 GitHub Actions 状态
gh run watch

# 查看 Cloud Run 部署状态
gcloud run services describe frontend \
  --region=asia-east1 \
  --format='value(status.url)'
```

#### 7.3 验证 DNS 解析

```bash
# 验证 Cloudflare 代理生效
curl -I https://preview.example.com

# 应看到响应头：
# server: cloudflare
# cf-ray: xxxxx-HKG
```

### 步骤 8：测试 Google OAuth 登录

#### 8.1 运行自动化测试

```bash
PREVIEW_BASE=https://preview.example.com node scripts/tests/test-login.mjs
```

#### 8.2 手动测试

```bash
open "https://preview.example.com/en/auth/sign-in"
```

测试流程：
1. 点击 "使用 Google 继续"
2. 选择 Google 账号
3. 授权后应跳转到 `/dashboard`
4. 检查浏览器 DevTools → Application → Cookies
   - 应存在 `session` cookie（HttpOnly）
   - 应存在 `sessionExpiresAt` cookie
5. 刷新页面，验证登录状态保持
6. 测试退出登录功能

#### 8.3 验证 Session Cookie

```bash
# 查看 Cloud Run 日志（服务端验证）
gcloud run services logs read frontend \
  --region=asia-east1 \
  --limit=50 \
  | grep "getLoggedInUser"
```

应看到日志：
```
[getLoggedInUser] Session cookie exists: true eyJhbGci...
```

## 配置文件变更总结

### 已修改的文件

1. **firebase.json**
   - ❌ 移除 `hosting` 配置
   - ✅ 保留 `firestore` 配置

2. **apps/frontend/src/lib/server/auth/save-session-cookie.ts**
   - ✅ 使用 `session` cookie 名称（Makerkit 原生）
   - ✅ 使用 `nookies` 库
   - ✅ 无 `domain` 参数（绑定到当前主机名）

3. **apps/frontend/src/core/firebase/admin/auth/get-logged-in-user.ts**
   - ✅ 读取 `session` cookie（非 `__session`）

4. **apps/frontend/src/core/session/sign-out-server-session.ts**
   - ✅ 销毁 `session` cookie（非 `__session`）

5. **.github/workflows/deploy-preview-frontend.yml**
   - ❌ 移除 Firebase Hosting 部署步骤
   - ✅ 保留 Cloud Run 部署步骤

6. **.github/workflows/deploy-prod-frontend.yml**
   - ❌ 移除 Firebase Hosting 部署步骤
   - ✅ 保留 Cloud Run 部署步骤

## 架构对比

### 旧架构：Firebase Hosting + Cloud Run

```
用户 → Firebase Hosting → Cloud Run
             ↓
    仅转发 __session cookie（4KB 限制）
    Firebase session JWT > 4KB → ❌ 失败
```

**问题**：
- Firebase Hosting 只转发 `__session` cookie
- `__session` cookie 有 4KB 大小限制
- Firebase session JWT 通常 > 4KB
- 需要修改 Makerkit 原生代码
- 增加架构复杂度

### 新架构：Cloud Run + Cloudflare

```
用户 → Cloudflare CDN → Cloud Run
             ↓
      转发所有 cookies（无限制）
      使用 session cookie（Makerkit 原生）
```

**优势**：
- 无 cookie 大小限制
- 无 cookie 名称限制
- 完全兼容 Makerkit
- 全球 CDN 加速
- DDoS 防护 + WAF
- 简化架构

## 成本分析

### Cloud Run（按请求计费）

- 免费额度：200 万请求/月
- 超额费用：$0.40 / 百万请求
- 内存费用：$0.0000025 / GB-秒
- CPU 费用：$0.00001 / vCPU-秒

**预估成本**（月访问量 10 万）：
- 请求费用：0（免费额度内）
- 内存 + CPU：约 $5-10

### Cloudflare（免费计划）

- ✅ 无限流量
- ✅ 全球 CDN
- ✅ DDoS 防护
- ✅ SSL 证书
- ✅ WAF 基础规则

**总成本**：约 $5-10/月（仅 Cloud Run）

## 回滚方案

如需回滚到 Firebase Hosting：

```bash
# 1. 恢复 firebase.json
git revert <此次提交的 commit hash>

# 2. 恢复 GitHub Actions
git revert <workflow 修改的 commit hash>

# 3. 重新部署 Firebase Hosting
firebase deploy --only hosting:preview

# 4. 修改 Cloudflare DNS
# 将 CNAME 指向 Firebase Hosting 域名
```

## 故障排查

### 问题 1：DNS 未生效

```bash
# 清除本地 DNS 缓存
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# 使用 Cloudflare DNS 测试
dig @1.1.1.1 preview.example.com
```

### 问题 2：Cloudflare 502 Bad Gateway

```bash
# 检查 Cloud Run 服务状态
gcloud run services describe frontend --region=asia-east1

# 查看 Cloud Run 日志
gcloud run services logs read frontend --region=asia-east1 --limit=100
```

可能原因：
- Cloud Run 服务未启动
- 自定义域名未正确配置
- Cloudflare SSL 模式错误（应使用 Full (strict)）

### 问题 3：Cookie 未保存

```bash
# 检查 Set-Cookie 响应头
curl -I -v https://preview.example.com/api/session/sign-in \
  -H "Content-Type: application/json" \
  -d '{"idToken":"test"}'
```

检查点：
- `Set-Cookie` 响应头是否存在
- `Secure` 标志是否启用（HTTPS 必须）
- `SameSite=Lax` 是否设置
- `HttpOnly` 是否启用

### 问题 4：Google OAuth 重定向失败

检查 Firebase Console → Authentication → Settings → Authorized domains

确保包含：
- `preview.example.com`
- `preview.example.com`（根域名）

## 性能优化建议

### 1. Cloudflare 缓存优化

**静态资源激进缓存**：
```
/_next/static/* → Cache Everything, Edge TTL: 1 year
/public/* → Cache Everything, Edge TTL: 1 month
```

**API 路由完全绕过**：
```
/api/* → Bypass cache
/_next/data/* → Bypass cache
```

### 2. Cloud Run 优化

```bash
# 启用 HTTP/2
gcloud run services update frontend \
  --use-http2 \
  --region=asia-east1

# 调整并发数（单实例处理更多请求）
gcloud run services update frontend \
  --concurrency=80 \
  --region=asia-east1

# 设置最小实例（减少冷启动）
gcloud run services update frontend \
  --min-instances=1 \
  --region=asia-east1
```

### 3. Next.js 优化

确保 `next.config.js` 配置：

```javascript
module.exports = {
  compress: true, // Gzip 压缩
  poweredByHeader: false, // 隐藏 X-Powered-By
  generateEtags: true, // 启用 ETag

  images: {
    domains: ['storage.googleapis.com'], // Firebase Storage
  },

  // 预渲染优化
  experimental: {
    optimizeCss: true,
  },
}
```

## 安全加固

### 1. Cloudflare WAF 规则

进入 Cloudflare Dashboard → Security → WAF

推荐启用：
- ✅ OWASP Core Ruleset
- ✅ Cloudflare Managed Ruleset
- ✅ Rate Limiting（API 路由限流）

### 2. Cloud Run 安全配置

```bash
# 启用 VPC 连接器（如需访问内部资源）
gcloud run services update frontend \
  --vpc-connector=projects/${PROJECT_ID}/locations/${REGION}/connectors/vpc-connector \
  --region=asia-east1

# 限制入站流量（仅允许 Cloudflare IP）
gcloud run services update frontend \
  --ingress=internal-and-cloud-load-balancing \
  --region=asia-east1
```

### 3. 环境变量加密

```bash
# 使用 Secret Manager 存储敏感信息
gcloud run services update frontend \
  --update-secrets=FIREBASE_ADMIN_KEY=firebase-admin-key:latest \
  --region=asia-east1
```

## 监控和告警

### 1. Cloud Run 监控

```bash
# 查看服务指标
gcloud run services describe frontend \
  --region=asia-east1 \
  --format='get(status.traffic)'

# 设置告警（高延迟）
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Cloud Run High Latency" \
  --condition-display-name="Request Latency > 1s" \
  --condition-threshold-value=1000 \
  --condition-threshold-duration=60s
```

### 2. Cloudflare Analytics

进入 Cloudflare Dashboard → Analytics

监控指标：
- 请求数和带宽
- 缓存命中率
- 威胁和 Bot 流量
- 响应时间分布

## 总结

### 实施检查清单

- [ ] Cloud Run 自定义域名配置完成
- [ ] Cloudflare DNS CNAME 记录添加完成
- [ ] Cloudflare SSL/TLS 模式设置为 Full (strict)
- [ ] Cloudflare 缓存规则配置完成
- [ ] GitHub Actions workflow 修改完成
- [ ] firebase.json 移除 hosting 配置
- [ ] 代码回退 `__session` 修改完成
- [ ] 部署成功并通过健康检查
- [ ] Google OAuth 登录测试通过
- [ ] Session cookie 验证通过
- [ ] DNS 解析验证通过

### 关键收益

1. ✅ 完全兼容 Makerkit 原生设计
2. ✅ 消除 Firebase Hosting cookie 限制
3. ✅ 获得 Cloudflare 全球 CDN 加速
4. ✅ 获得 DDoS 防护和 WAF
5. ✅ 简化架构（减少一层代理）
6. ✅ 降低成本（Cloudflare 免费计划）

### 下一步行动

1. 执行步骤 1-8 完成部署
2. 监控 Google OAuth 登录成功率
3. 优化 Cloudflare 缓存规则
4. 配置 Cloud Run 性能监控
5. 文档归档到 `docs/frontend/`
