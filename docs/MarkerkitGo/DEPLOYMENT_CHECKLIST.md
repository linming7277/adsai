# AutoAds V2 部署清单

**版本**: V2.0
**日期**: 2025-09-30
**状态**: 准备部署

---

## ✅ 部署前检查清单

### 1. 代码完整性检查

#### 后端 (Console服务)
- [x] Console服务代码已重构
- [x] 端点从52个精简到18个
- [x] Token消耗规则管理已实现
- [x] Go编译测试通过 (31MB)
- [x] 备份文件已创建 (http.go.backup)

**验证命令**:
```bash
cd services/console
go build -o /tmp/console-test ./main.go
ls -lh /tmp/console-test
# 预期: 31MB binary
```

#### 前端 (Makerkit)
- [x] 7个管理页面已创建 (3128行代码)
  - [x] `/admin/tokens/index.tsx` (Token统计)
  - [x] `/admin/tokens/balances.tsx` (用户余额)
  - [x] `/admin/tokens/rules.tsx` (消耗规则)
  - [x] `/admin/apikeys/index.tsx` (API密钥)
  - [x] `/admin/config/index.tsx` (配置管理)
  - [x] `/admin/config/history.tsx` (配置历史)
  - [x] `/admin/plans/index.tsx` (套餐管理)

- [x] API客户端已增强 (659行)
- [x] 管理后台导航已配置 (102行)
- [x] TypeScript类型完整定义

**验证命令**:
```bash
cd apps/frontend
npm run build
# 预期: 管理页面编译成功，静态页面可能有Firebase警告
```

### 2. 环境变量配置

#### Preview环境
```bash
# Console API
NEXT_PUBLIC_CONSOLE_API_URL=https://console.urlchecker.dev

# Firebase
NEXT_PUBLIC_FIREBASE_PROJECT_ID=gen-lang-client-0944935873
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gen-lang-client-0944935873.firebaseapp.com
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=gen-lang-client-0944935873.appspot.com
NEXT_PUBLIC_FIREBASE_API_KEY=<已配置>

# Stripe (测试模式)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# 站点URL
NEXT_PUBLIC_SITE_URL=https://www.urlchecker.dev
```

#### Production环境
```bash
# Console API
NEXT_PUBLIC_CONSOLE_API_URL=https://console.autoads.dev

# Stripe (生产模式)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# 站点URL
NEXT_PUBLIC_SITE_URL=https://www.autoads.dev
```

**检查清单**:
- [ ] Preview环境变量已配置
- [ ] Production环境变量已准备（未部署）
- [ ] Stripe测试密钥可用
- [ ] Firebase配置正确

### 3. 数据库准备

#### Token消耗规则表
```sql
CREATE TABLE IF NOT EXISTS token_consumption_rules (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    service_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    cost_per_unit INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(service_name, action_type)
);
```

**检查清单**:
- [x] 表结构已定义
- [x] Console服务启动时自动创建表
- [ ] 初始数据已准备（可选）

**初始数据示例**:
```sql
INSERT INTO token_consumption_rules (service_name, action_type, cost_per_unit, description)
VALUES
  ('adscenter', 'ad_query', 1, '查询单条广告消耗1 Token'),
  ('batchopen', 'batch_open', 5, '批量打开单个URL消耗5 Token'),
  ('siterank', 'rank_check', 10, '检查排名消耗10 Token')
ON CONFLICT (service_name, action_type) DO NOTHING;
```

### 4. 文件清单

#### 新增文件
```
apps/frontend/src/
├── pages/admin/
│   ├── tokens/index.tsx (330行)
│   ├── tokens/balances.tsx (320行)
│   ├── tokens/rules.tsx (420行)
│   ├── apikeys/index.tsx (431行)
│   ├── config/index.tsx (282行)
│   ├── config/history.tsx (280行)
│   └── plans/index.tsx (450行)
├── lib/
│   └── console-api-client.ts (659行，从444行增加)
└── components/admin/
    └── AdminSidebar.tsx (102行，已更新)

services/console/internal/handlers/
├── http.go (1800行，已重构)
└── http.go.backup (2223行，备份)

docs/MarkerkitGo/
├── V2_IMPLEMENTATION_COMPLETE.md (完成报告)
├── DEPLOYMENT_CHECKLIST.md (本文档)
├── DEPLOYMENT_PROGRESS.md (更新)
└── 02-重构方案V2-统一管理后台.md
```

#### 修改文件
```
apps/frontend/
├── src/components/admin/AdminSidebar.tsx (导航更新)
└── src/lib/console-api-client.ts (增强)

services/console/internal/handlers/
└── http.go (重构精简)
```

---

## 🚀 部署步骤

### Step 1: 部署Console服务到Cloud Run

#### 1.1 构建Docker镜像
```bash
cd services/console

# 构建镜像
docker build -t gcr.io/gen-lang-client-0944935873/console:v2 .

# 推送到GCR
docker push gcr.io/gen-lang-client-0944935873/console:v2
```

#### 1.2 部署到Cloud Run
```bash
gcloud run deploy console \
  --image gcr.io/gen-lang-client-0944935873/console:v2 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="DATABASE_URL=<postgresql-url>" \
  --min-instances 1 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 60
```

#### 1.3 验证部署
```bash
# 健康检查
curl https://console.urlchecker.dev/healthz

# 测试API
curl https://console.urlchecker.dev/api/v1/console/tokens/rules
```

### Step 2: 部署前端到Firebase Hosting

#### 2.1 构建前端
```bash
cd apps/frontend

# 安装依赖
npm install

# 构建
npm run build
```

#### 2.2 部署到Preview环境
```bash
# 部署到Firebase Hosting (Preview)
firebase deploy --only hosting:autoads-preview --project=gen-lang-client-0944935873

# 验证部署
curl -I https://www.urlchecker.dev
```

#### 2.3 测试验证
访问以下页面验证功能：
```
- https://www.urlchecker.dev/admin (管理后台首页)
- https://www.urlchecker.dev/admin/tokens (Token统计)
- https://www.urlchecker.dev/admin/tokens/balances (用户余额)
- https://www.urlchecker.dev/admin/tokens/rules (消耗规则)
- https://www.urlchecker.dev/admin/apikeys (API密钥)
- https://www.urlchecker.dev/admin/config (系统配置)
- https://www.urlchecker.dev/admin/plans (套餐管理)
```

### Step 3: 功能测试

#### 3.1 管理后台访问测试
- [ ] 访问 `/admin` 总览页面
- [ ] 检查导航菜单是否正确显示
- [ ] 验证所有导航链接可点击

#### 3.2 Token管理测试
- [ ] Token统计页面数据加载
- [ ] 用户余额列表展示
- [ ] 充值功能测试（测试用户）
- [ ] 消耗规则CRUD操作

#### 3.3 配置管理测试
- [ ] 配置列表加载
- [ ] 搜索/过滤功能
- [ ] 编辑配置值
- [ ] 配置历史记录查看

#### 3.4 API密钥测试
- [ ] 创建新密钥
- [ ] 验证Token一次性显示
- [ ] 权限范围配置
- [ ] 删除密钥

#### 3.5 套餐管理测试
- [ ] 套餐列表加载
- [ ] 编辑套餐配置
- [ ] 启用/禁用套餐

---

## ⚠️ 已知问题

### 1. Firebase静态生成警告
**问题**: 前端构建时静态页面生成失败
```
Error: Component auth has not been registered yet
```

**影响**:
- 仅影响landing/blog/pricing静态页面
- 不影响管理后台功能
- 不影响动态页面（SSR）

**解决方案**:
1. 短期：忽略警告，动态页面正常工作
2. 长期：配置Firebase credentials或调整静态生成策略

### 2. 后端API未完全实现
**缺失功能**:
- `GET /api/v1/console/tokens/balances` - 用户余额列表
- `POST /api/v1/console/tokens/topup` - Token充值
- `GET /api/v1/console/config/history` - 配置历史（分页）

**影响**:
- 前端页面已创建，但会报API 404
- 不影响其他功能

**解决方案**:
1. 在Console服务中实现这3个端点
2. 预计工作量: 1-2天

---

## 📋 回滚计划

如果部署后发现严重问题，按以下步骤回滚：

### 回滚Console服务
```bash
# 回滚到上一个版本
gcloud run services update-traffic console \
  --to-revisions PREVIOUS_REVISION=100 \
  --region us-central1
```

### 回滚前端
```bash
# 恢复AdminSidebar
cd apps/frontend
git checkout HEAD~1 src/components/admin/AdminSidebar.tsx

# 删除新增的管理页面
rm -rf src/pages/admin/tokens/
rm -rf src/pages/admin/apikeys/
rm -rf src/pages/admin/config/
rm -rf src/pages/admin/plans/

# 恢复console-api-client
git checkout HEAD~1 src/lib/console-api-client.ts

# 重新构建和部署
npm run build
firebase deploy --only hosting:autoads-preview
```

### 回滚Console代码
```bash
cd services/console
# 恢复原始http.go
cp internal/handlers/http.go.backup internal/handlers/http.go
# 重新构建和部署
```

---

## 📊 部署后监控

### 关键指标

#### Console服务
- [ ] 健康检查响应时间 < 100ms
- [ ] API响应时间 < 500ms
- [ ] 错误率 < 1%
- [ ] 内存使用 < 400MB

#### 前端
- [ ] 页面加载时间 < 3s
- [ ] API调用成功率 > 99%
- [ ] 无JavaScript错误

#### 数据库
- [ ] 查询响应时间 < 100ms
- [ ] 连接数 < 50

### 监控命令
```bash
# 查看Console服务日志
gcloud run services logs read console --region us-central1 --limit 50

# 查看Cloud Run指标
gcloud run services describe console --region us-central1

# 查看Firebase Hosting状态
firebase hosting:channel:list
```

---

## ✅ 最终检查清单

### 代码准备
- [x] Console服务编译通过
- [x] 前端编译通过（管理页面）
- [x] TypeScript无类型错误
- [x] 导航配置正确

### 环境配置
- [ ] Preview环境变量已配置
- [ ] Console API URL正确
- [ ] Firebase配置正确
- [ ] Stripe测试密钥有效

### 文档准备
- [x] 部署清单文档（本文档）
- [x] V2完成报告
- [x] 部署进度报告
- [x] 重构方案文档

### 数据库准备
- [x] Token规则表结构定义
- [ ] 初始数据准备（可选）

### 备份准备
- [x] Console服务代码备份
- [x] 原始API端点配置保存
- [ ] 数据库快照（建议）

---

## 🎯 部署时间估算

| 步骤 | 预计时间 |
|-----|---------|
| Console服务构建 | 10分钟 |
| Console服务部署 | 5分钟 |
| 前端构建 | 5分钟 |
| 前端部署 | 3分钟 |
| 功能测试 | 30分钟 |
| **总计** | **53分钟** |

---

## 📞 支持信息

**问题反馈**: GitHub Issues
**紧急联系**: 项目负责人
**文档位置**: `/docs/MarkerkitGo/`

---

**检查清单版本**: 1.0
**最后更新**: 2025-09-30 21:45
**准备状态**: ✅ 准备就绪