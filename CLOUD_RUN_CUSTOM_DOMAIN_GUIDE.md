# 🌐 Cloud Run自定义域名配置指南

## 📋 概述

Cloud Run支持两种方式配置自定义域名：
1. **Cloud Run域名映射**（推荐，简单）
2. **Cloud Load Balancer + Cloud CDN**（高级，全功能）

---

## 方案1: Cloud Run域名映射（推荐）

### 特点

- ✅ 最简单的方式
- ✅ 自动SSL证书
- ✅ 全球anycast IP
- ✅ 免费
- ⚠️ 不支持自定义CDN配置

### 步骤

#### 1. 验证域名所有权

```bash
# 在Cloud Console中添加域名验证
# 或使用gcloud命令
gcloud domains verify www.urlchecker.dev
```

**验证方式**:
- TXT记录验证
- HTML文件验证
- Google Search Console验证

#### 2. 映射域名到Cloud Run服务

```bash
# 映射域名
gcloud run domain-mappings create \
  --service=frontend-preview \
  --domain=www.urlchecker.dev \
  --region=asia-northeast1
```

#### 3. 配置DNS记录

命令执行后会返回需要配置的DNS记录：

```
Please add the following DNS records to your domain:

NAME                    TYPE    DATA
www.urlchecker.dev      A       216.239.32.21
www.urlchecker.dev      A       216.239.34.21
www.urlchecker.dev      A       216.239.36.21
www.urlchecker.dev      A       216.239.38.21
www.urlchecker.dev      AAAA    2001:4860:4802:32::15
www.urlchecker.dev      AAAA    2001:4860:4802:34::15
www.urlchecker.dev      AAAA    2001:4860:4802:36::15
www.urlchecker.dev      AAAA    2001:4860:4802:38::15
```

**在你的DNS提供商（Cloudflare）配置**:

```
类型    名称    内容                        代理状态
A       www     216.239.32.21              DNS only (灰色云)
A       www     216.239.34.21              DNS only
A       www     216.239.36.21              DNS only
A       www     216.239.38.21              DNS only
AAAA    www     2001:4860:4802:32::15      DNS only
AAAA    www     2001:4860:4802:34::15      DNS only
AAAA    www     2001:4860:4802:36::15      DNS only
AAAA    www     2001:4860:4802:38::15      DNS only
```

**重要**: 必须设置为"DNS only"（灰色云），不能用Cloudflare代理！

#### 4. 等待SSL证书生成

```bash
# 检查状态
gcloud run domain-mappings describe \
  --domain=www.urlchecker.dev \
  --region=asia-northeast1
```

**状态**:
- `PENDING`: 正在生成证书
- `ACTIVE`: 已完成，可以使用

**时间**: 通常5-15分钟

#### 5. 验证

```bash
# 测试域名
curl -I https://www.urlchecker.dev

# 应该返回200 OK
```

---

## 方案2: Cloud Load Balancer（高级）

### 特点

- ✅ 支持多个后端
- ✅ 支持Cloud CDN
- ✅ 更多配置选项
- ✅ 支持URL重写
- ⚠️ 更复杂
- ⚠️ 有成本（~$18/月起）

### 架构

```
用户
  ↓
Cloud Load Balancer (全球anycast IP)
  ↓
Cloud CDN (可选)
  ↓
Serverless NEG (Network Endpoint Group)
  ↓
Cloud Run服务
```

### 步骤

#### 1. 创建Serverless NEG

```bash
gcloud compute network-endpoint-groups create frontend-neg \
  --region=asia-northeast1 \
  --network-endpoint-type=serverless \
  --cloud-run-service=frontend-preview
```

#### 2. 创建Backend Service

```bash
gcloud compute backend-services create frontend-backend \
  --global \
  --enable-cdn \
  --cache-mode=CACHE_ALL_STATIC
```

#### 3. 添加NEG到Backend

```bash
gcloud compute backend-services add-backend frontend-backend \
  --global \
  --network-endpoint-group=frontend-neg \
  --network-endpoint-group-region=asia-northeast1
```

#### 4. 创建URL Map

```bash
gcloud compute url-maps create frontend-lb \
  --default-service=frontend-backend
```

#### 5. 创建SSL证书

```bash
gcloud compute ssl-certificates create frontend-cert \
  --domains=www.urlchecker.dev
```

#### 6. 创建HTTPS代理

```bash
gcloud compute target-https-proxies create frontend-https-proxy \
  --url-map=frontend-lb \
  --ssl-certificates=frontend-cert
```

#### 7. 创建转发规则

```bash
gcloud compute forwarding-rules create frontend-https-rule \
  --global \
  --target-https-proxy=frontend-https-proxy \
  --ports=443
```

#### 8. 获取IP地址

```bash
gcloud compute forwarding-rules describe frontend-https-rule \
  --global \
  --format="get(IPAddress)"
```

#### 9. 配置DNS

```
类型    名称    内容                代理状态
A       www     [Load Balancer IP]  DNS only
```

---

## 🔄 从Cloudflare迁移到Cloud Run

### 当前架构

```
用户 → Cloudflare CDN → Cloud Run
```

### 目标架构（方案1）

```
用户 → Cloud Run (直接)
```

### 目标架构（方案2）

```
用户 → Cloud Load Balancer + Cloud CDN → Cloud Run
```

---

## 📋 迁移步骤（方案1 - 推荐）

### 步骤1: 准备（不影响现有服务）

```bash
# 1. 验证域名
gcloud domains verify www.urlchecker.dev

# 2. 创建域名映射
gcloud run domain-mappings create \
  --service=frontend-preview \
  --domain=www.urlchecker.dev \
  --region=asia-northeast1

# 3. 记录返回的DNS记录
```

### 步骤2: 测试（使用hosts文件）

```bash
# 在本地hosts文件中添加
# /etc/hosts (Mac/Linux) 或 C:\Windows\System32\drivers\etc\hosts (Windows)
216.239.32.21 www.urlchecker.dev

# 测试
curl -I https://www.urlchecker.dev
```

### 步骤3: 切换DNS（生产环境）

**在Cloudflare中**:

1. 找到 `www.urlchecker.dev` 的A记录
2. 点击橙色云图标，变成灰色（DNS only）
3. 或者直接修改A记录指向Cloud Run的IP

**配置**:
```
类型    名称    内容                        代理状态    TTL
A       www     216.239.32.21              DNS only    Auto
A       www     216.239.34.21              DNS only    Auto
A       www     216.239.36.21              DNS only    Auto
A       www     216.239.38.21              DNS only    Auto
```

### 步骤4: 等待DNS传播

```bash
# 检查DNS
dig www.urlchecker.dev

# 或
nslookup www.urlchecker.dev
```

**时间**: 5分钟 - 48小时（取决于TTL）

### 步骤5: 验证

```bash
# 测试HTTPS
curl -I https://www.urlchecker.dev

# 测试从不同地区
curl -I https://www.urlchecker.dev --resolve www.urlchecker.dev:443:216.239.32.21
```

### 步骤6: 清理Cloudflare（可选）

如果一切正常，可以：
1. 移除Cloudflare的代理
2. 或完全移除域名从Cloudflare

---

## 🔍 当前状态检查

### 检查当前DNS配置

```bash
# 查看当前DNS记录
dig www.urlchecker.dev

# 查看是否经过Cloudflare
curl -I https://www.urlchecker.dev | grep -i cloudflare
```

### 检查Cloud Run服务

```bash
# 查看服务URL
gcloud run services describe frontend-preview \
  --region=asia-northeast1 \
  --format='value(status.url)'

# 查看域名映射
gcloud run domain-mappings list \
  --region=asia-northeast1
```

---

## 💡 方案对比

### 方案1: Cloud Run域名映射

**优点**:
- ✅ 最简单
- ✅ 免费
- ✅ 自动SSL
- ✅ 全球分布

**缺点**:
- ⚠️ 无CDN缓存控制
- ⚠️ 无URL重写

**适合**:
- 大多数应用
- 动态内容为主
- 不需要复杂CDN配置

**成本**: $0

---

### 方案2: Cloud Load Balancer

**优点**:
- ✅ 完整的CDN功能
- ✅ 更多配置选项
- ✅ 支持多后端

**缺点**:
- ⚠️ 更复杂
- ⚠️ 有成本

**适合**:
- 静态资源多
- 需要CDN缓存
- 需要高级配置

**成本**: ~$18/月 + 流量费

---

### 方案3: 保持Cloudflare（当前）

**优点**:
- ✅ 已经配置好
- ✅ 熟悉的界面

**缺点**:
- ❌ 增加复杂性
- ❌ 可能缓存问题
- ❌ 调试困难

**成本**: $0-20/月

---

## 🎯 推荐方案

### 对于你的应用（AutoAds）

**推荐**: 方案1 - Cloud Run域名映射

**原因**:
1. ✅ 最简单
2. ✅ 免费
3. ✅ 足够用（动态内容为主）
4. ✅ 减少复杂性
5. ✅ Cloud Run已经有全球分布

**何时用方案2**:
- 如果有大量静态资源
- 如果需要精细的缓存控制
- 如果需要URL重写

---

## 📝 实施清单

### 预发环境 (www.urlchecker.dev)

- [ ] 验证域名所有权
- [ ] 创建域名映射
- [ ] 记录DNS配置
- [ ] 在Cloudflare中配置DNS（DNS only）
- [ ] 等待SSL证书生成
- [ ] 测试HTTPS访问
- [ ] 验证功能正常
- [ ] 监控一周
- [ ] 移除Cloudflare代理（可选）

### 生产环境 (www.autoads.dev)

- [ ] 验证域名所有权
- [ ] 创建域名映射
- [ ] 记录DNS配置
- [ ] 在Cloudflare中配置DNS（DNS only）
- [ ] 等待SSL证书生成
- [ ] 测试HTTPS访问
- [ ] 验证功能正常
- [ ] 监控一周
- [ ] 移除Cloudflare代理（可选）

---

## 🚀 快速开始

### 一键配置脚本

```bash
#!/bin/bash
# configure-custom-domain.sh

DOMAIN="www.urlchecker.dev"
SERVICE="frontend-preview"
REGION="asia-northeast1"

echo "🌐 配置自定义域名: $DOMAIN"

# 1. 创建域名映射
echo "📝 创建域名映射..."
gcloud run domain-mappings create \
  --service=$SERVICE \
  --domain=$DOMAIN \
  --region=$REGION

# 2. 获取DNS记录
echo "📋 DNS配置信息:"
gcloud run domain-mappings describe \
  --domain=$DOMAIN \
  --region=$REGION \
  --format="value(status.resourceRecords)"

echo ""
echo "✅ 完成！请在DNS提供商配置上述记录"
echo "⏰ 等待5-15分钟后，SSL证书将自动生成"
```

---

## 🔍 故障排查

### 问题1: SSL证书一直PENDING

**原因**: DNS记录未正确配置

**解决**:
```bash
# 检查DNS
dig www.urlchecker.dev

# 应该返回Cloud Run的IP
```

### 问题2: 403 Forbidden

**原因**: Cloud Run服务未设置为公开访问

**解决**:
```bash
gcloud run services add-iam-policy-binding frontend-preview \
  --region=asia-northeast1 \
  --member="allUsers" \
  --role="roles/run.invoker"
```

### 问题3: 域名无法访问

**原因**: DNS传播未完成

**解决**: 等待或清除DNS缓存

```bash
# Mac
sudo dscacheutil -flushcache

# Windows
ipconfig /flushdns

# Linux
sudo systemd-resolve --flush-caches
```

---

## 📊 性能对比

### Cloudflare CDN vs Cloud Run直接

| 指标 | Cloudflare | Cloud Run直接 |
|------|-----------|--------------|
| 首字节时间 | ~50ms | ~100ms |
| 静态资源 | 快（缓存） | 慢（无缓存） |
| 动态内容 | 慢（多一跳） | 快（直接） |
| SSL握手 | 快 | 快 |
| 全球分布 | ✅ | ✅ |
| 配置复杂度 | 高 | 低 |

**结论**: 对于动态内容为主的应用，Cloud Run直接访问更好。

---

**要我帮你配置吗？** 🚀
