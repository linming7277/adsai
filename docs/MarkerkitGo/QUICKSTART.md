# AutoAds V2 快速启动指南

**版本**: V2.0
**更新日期**: 2025-09-30

---

## 🚀 5分钟快速上手

### 前提条件
- Node.js 18+ 已安装
- Go 1.21+ 已安装
- Docker 已安装
- Firebase CLI 已安装
- Google Cloud SDK 已安装

---

## 📦 本地开发环境

### 1. 启动Console服务

```bash
# 进入Console目录
cd services/console

# 设置环境变量
export DATABASE_URL="postgresql://user:pass@localhost:5432/autoads"
export PORT=8080

# 运行服务
go run main.go
```

**验证**:
```bash
curl http://localhost:8080/healthz
# 预期: {"status":"ok"}
```

### 2. 启动前端开发服务器

```bash
# 进入前端目录
cd apps/frontend

# 安装依赖（首次运行）
npm install

# 设置环境变量
export NEXT_PUBLIC_CONSOLE_API_URL=http://localhost:8080
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=gen-lang-client-0944935873
# ... 其他Firebase环境变量

# 启动开发服务器
npm run dev
```

**访问**:
- 用户端: http://localhost:3000
- 管理后台: http://localhost:3000/admin

---

## 🎯 管理后台功能导航

访问 `http://localhost:3000/admin` 后，您将看到以下功能：

### 📊 总览 (`/admin`)
- 用户统计
- 订阅统计
- 收入概览
- 快速操作链接

### 👥 SaaS管理
- **用户管理** (`/admin/users`)
  - 查看所有用户
  - 用户详情
  - 禁用/启用用户

- **组织管理** (`/admin/organizations`)
  - 查看所有组织
  - 组织成员管理
  - 订阅状态

### 💰 Token管理
- **Token统计** (`/admin/tokens`)
  - 总余额/消耗统计
  - Top 10用户排行
  - 快速操作入口

- **用户余额** (`/admin/tokens/balances`)
  - 余额列表（分页+搜索）
  - 充值功能
  - 消耗记录

- **消耗规则** (`/admin/tokens/rules`)
  - 规则列表
  - 创建/编辑/删除规则
  - 服务+操作类型配置

### 💳 套餐与API
- **套餐管理** (`/admin/plans`)
  - Free/Pro/Enterprise套餐
  - 价格/Token配置
  - 功能特性管理

- **API密钥** (`/admin/apikeys`)
  - 创建密钥
  - 权限范围（read/write/admin）
  - RPM限流配置

### ⚙️ 系统配置
- **系统配置** (`/admin/config`)
  - 配置列表（搜索）
  - 编辑配置（JSON/文本）
  - 配置历史链接

---

## 📝 常用操作示例

### 创建Token消耗规则

1. 访问 `/admin/tokens/rules`
2. 点击"创建规则"
3. 填写表单：
   ```
   服务名称: adscenter
   操作类型: ad_query
   消耗量: 1
   描述: 查询单条广告消耗1 Token
   ```
4. 点击"创建规则"

### 充值用户Token

1. 访问 `/admin/tokens/balances`
2. 找到目标用户
3. 点击"充值"按钮
4. 填写表单：
   ```
   充值金额: 1000
   充值原因: 系统故障补偿
   ```
5. 点击"确认充值"

### 创建API密钥

1. 访问 `/admin/apikeys`
2. 点击"创建密钥"
3. 填写表单：
   ```
   密钥名称: Production API Key
   权限范围: ☑ read ☑ write
   限流: 60 请求/分钟
   ```
4. 点击"创建密钥"
5. **立即复制Token**（仅显示一次）

### 编辑套餐配置

1. 访问 `/admin/plans`
2. 找到目标套餐卡片
3. 点击"编辑套餐"
4. 修改配置：
   ```
   显示名称: 专业版
   价格: 29.99
   Token额度: 50000
   功能特性:
     无限API调用
     优先技术支持
     自定义域名
   ```
5. 勾选"启用此套餐"
6. 点击"保存配置"

### 修改系统配置

1. 访问 `/admin/config`
2. 搜索配置Key（如 `rate_limit`）
3. 点击配置卡片上的"编辑"
4. 修改配置值（支持JSON）：
   ```json
   {
     "requests_per_minute": 100,
     "burst_size": 10
   }
   ```
5. 点击"保存配置"
6. ✅ 配置将在1分钟内自动生效

---

## 🔧 API客户端使用

### 在前端代码中调用Console API

```typescript
import { consoleApi } from '~/lib/console-api-client';

// 获取Token统计
const stats = await consoleApi.tokens.getStats();

// 获取Token规则列表
const rules = await consoleApi.tokens.getRules();

// 创建新规则
const newRule = await consoleApi.tokens.createRule({
  serviceName: 'adscenter',
  actionType: 'ad_query',
  costPerUnit: 1,
  description: '查询单条广告消耗1 Token'
});

// 更新规则
await consoleApi.tokens.updateRule(ruleId, {
  costPerUnit: 2,
  description: '更新后的描述'
});

// 删除规则
await consoleApi.tokens.deleteRule(ruleId);

// 获取用户余额列表
const balances = await consoleApi.tokens.getBalances({
  page: 1,
  pageSize: 20,
  search: 'user@example.com'
});

// 充值Token
await consoleApi.tokens.topUp(userId, {
  amount: 1000,
  reason: '系统补偿'
});

// 获取配置列表
const configs = await consoleApi.config.list({
  key: 'rate_' // 前缀搜索
});

// 更新配置
await consoleApi.config.update('rate_limit', {
  requests_per_minute: 100
});

// 获取配置历史
const history = await consoleApi.config.getHistory({
  key: 'rate_limit',
  page: 1,
  pageSize: 50
});

// 创建API密钥
const apiKey = await consoleApi.apiKeys.create({
  name: 'Test Key',
  scopes: ['read', 'write'],
  rpm: 60
});
// ⚠️ apiKey.token 仅在创建时返回一次

// 删除API密钥
await consoleApi.apiKeys.delete(keyId);
```

### 错误处理

```typescript
import { APIError } from '~/lib/console-api-client';

try {
  const stats = await consoleApi.tokens.getStats();
} catch (error) {
  if (error instanceof APIError) {
    // API错误
    console.error(`API错误 [${error.code}]: ${error.message}`);

    if (error.isAuthError()) {
      // 认证失败，跳转登录
      router.push('/auth/sign-in');
    } else if (error.isRetryable()) {
      // 已自动重试，仍然失败
      alert('服务暂时不可用，请稍后重试');
    }
  } else {
    // 其他错误（网络等）
    console.error('未知错误:', error);
  }
}
```

---

## 🐛 常见问题

### Q1: 管理页面无法加载数据，显示404错误

**原因**: 后端API未完全实现
**解决方案**:
1. 检查Console服务是否正常运行
2. 确认环境变量 `NEXT_PUBLIC_CONSOLE_API_URL` 配置正确
3. 部分端点需要在Console服务中实现（参考DEPLOYMENT_CHECKLIST.md）

### Q2: 前端构建时出现Firebase Auth错误

**原因**: 静态页面生成时Firebase未初始化
**解决方案**:
- 这是已知问题，不影响管理后台功能
- 仅影响landing/blog/pricing静态页面
- 可以忽略警告继续部署

### Q3: 创建API密钥后Token没有显示

**原因**: 浏览器阻止了弹窗或Modal未正确打开
**解决方案**:
- Token仅在创建时显示一次
- 如果错过，需要删除并重新创建
- 建议在创建时立即复制到安全位置

### Q4: 充值后余额没有更新

**原因**:
1. 后端API未实现 `POST /api/v1/console/tokens/topup`
2. 或前端缓存未刷新

**解决方案**:
1. 实现后端API（参考DEPLOYMENT_CHECKLIST.md）
2. 刷新页面查看最新余额

### Q5: 配置修改后没有生效

**原因**: 其他服务可能未实现配置热更新
**解决方案**:
- Console的配置会立即更新数据库
- 其他服务需要实现定时轮询读取配置（建议1分钟）
- 或重启服务强制读取新配置

---

## 📚 相关文档

- [V2重构完成报告](./V2_IMPLEMENTATION_COMPLETE.md) - 详细的重构成果
- [部署清单](./DEPLOYMENT_CHECKLIST.md) - 完整的部署步骤
- [部署进度](./DEPLOYMENT_PROGRESS.md) - 持续更新的进度追踪
- [重构方案V2](./02-重构方案V2-统一管理后台.md) - 原始设计方案

---

## 🎯 下一步

1. **本地开发**: 按照上述步骤启动本地环境
2. **功能测试**: 在本地测试所有管理页面功能
3. **API实现**: 实现缺失的后端API端点
4. **部署Preview**: 部署到Preview环境验证
5. **生产部署**: 验证无误后部署到生产环境

---

## 💡 最佳实践

### 开发管理页面

1. **使用现有组件**: 优先使用Makerkit UI组件库
2. **错误处理**: 始终使用try-catch包装API调用
3. **Loading状态**: 所有异步操作显示Loading
4. **用户反馈**: 操作成功/失败显示Toast通知
5. **表单验证**: 提交前验证所有必填字段

### API调用

1. **类型安全**: 使用console-api-client导出的类型
2. **错误分类**: 使用APIError的isAuthError()等方法
3. **自动重试**: 网络错误会自动重试3次（指数退避）
4. **超时控制**: 默认30秒超时，可配置

### 配置管理

1. **JSON格式**: 复杂配置使用JSON格式存储
2. **描述清晰**: 在description字段说明配置用途
3. **版本控制**: 通过config history追踪变更
4. **谨慎操作**: 生产环境配置修改需要审批

---

**文档版本**: 1.0
**最后更新**: 2025-09-30 22:00
**维护者**: AutoAds Team