# API数据格式不匹配全面Review

## Review时间
2025-10-18

## Review范围
检查所有前后端API调用，识别数据格式不匹配的问题

## 已发现的问题

### 1. ✅ 权限检查API - 已修复

**端点**: `/api/v1/billing/permissions/check`

**问题**:
- 前端期望: 批量获取所有权限
  ```typescript
  {
    canUseAI: boolean,
    canCreateOffers: boolean,
    canManageAds: boolean,
    restrictions: string[]
  }
  ```
- 后端实际: 单个权限检查
  ```go
  Request: { userId: string, feature: string }
  Response: { allowed: boolean, ... }
  ```

**修复方案**: 前端使用fallback逻辑，基于订阅tier判断权限

**状态**: ✅ 已修复（临时方案）

**后续**: 需要实现后端批量权限检查API

---

### 2. ✅ Dashboard统计API - 已修复

**端点**: `/api/v1/console/dashboard/stats`

**问题**:
- 前端调用但后端未实现
- 返回501 Not Implemented

**修复方案**: 
- 实现了后端Handler (`dashboard_handlers.go`)
- 注册了路由

**状态**: ✅ 已修复

---

## 需要检查的API端点

### Billing Service APIs

#### 1. 获取订阅信息
**端点**: `/api/v1/billing/subscriptions/me`

**前端期望**:
```typescript
interface SubscriptionInfo {
  tier: string;
  isActive: boolean;
  isElite: boolean;
  canUseAI: boolean;
  monthlyTokenAllocation: number;
  currentTokenBalance: number;
  subscriptionEndDate: string | null;
  trialEndDate: string | null;
  isOnTrial: boolean;
  daysRemaining: number | null;
}
```

**后端返回**: 需要验证

**检查项**:
- [ ] 字段名称是否匹配
- [ ] 数据类型是否一致
- [ ] 可选字段处理

#### 2. Token余额
**端点**: `/api/v1/billing/tokens/balance`

**前端期望**:
```typescript
{
  currentBalance: number;
  totalConsumed: number;
  totalGranted: number;
  lastUpdated: string;
}
```

**检查项**:
- [ ] 字段名称匹配
- [ ] 数值类型正确

#### 3. Token使用记录
**端点**: `/api/v1/billing/tokens/usage`

**前端期望**:
```typescript
interface TokenUsageSummary {
  totalConsumed: number;
  byAction: Record<string, number>;
  byDate: Array<{ date: string; amount: number }>;
}
```

**检查项**:
- [ ] 数据结构匹配
- [ ] 日期格式统一

### Console Service APIs

#### 4. 任务统计
**端点**: `/api/v1/console/tasks/stats`

**前端期望**:
```typescript
interface TaskStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
}
```

**检查项**:
- [ ] 字段完整性
- [ ] 数值类型

#### 5. Offer统计
**端点**: `/api/v1/console/stats/offers`

**前端期望**:
```typescript
interface OfferStats {
  total: number;
  evaluated: number;
  pending: number;
  failed: number;
}
```

**检查项**:
- [ ] 字段匹配
- [ ] 统计准确性

### Offer Service APIs

#### 6. 创建Offer
**端点**: `/api/v1/offers`

**前端发送**:
```typescript
{
  brandName: string;
  domain: string;
  description?: string;
}
```

**后端期望**: 需要验证

**检查项**:
- [ ] 必填字段
- [ ] 字段名称
- [ ] 数据验证

#### 7. Offer评估
**端点**: `/api/v1/offers/{id}/evaluate`

**前端发送**:
```typescript
{
  enableAI: boolean;
  options?: {
    depth?: string;
    focus?: string[];
  };
}
```

**检查项**:
- [ ] 参数格式
- [ ] 可选参数处理

### AdsCenter Service APIs

#### 8. 广告账号列表
**端点**: `/api/v1/adscenter/accounts`

**前端期望**:
```typescript
interface AdsAccount {
  id: string;
  provider: string;
  accountId: string;
  status: string;
  lastSync: string;
}
```

**检查项**:
- [ ] 字段匹配
- [ ] 枚举值统一

#### 9. OAuth授权
**端点**: `/api/v1/adscenter/oauth/url`

**前端期望**:
```typescript
{
  url: string;
  state: string;
}
```

**检查项**:
- [ ] 返回格式
- [ ] URL有效性

## 检查方法

### 1. 静态分析

检查TypeScript类型定义和Go结构体：

```bash
# 前端类型定义
find apps/frontend/src -name "*.ts" -exec grep -l "interface.*Response\|type.*Response" {} \;

# 后端结构体定义
find services -name "*.go" -exec grep -l "type.*Response struct" {} \;
```

### 2. 运行时验证

在浏览器Console中测试：

```javascript
// 测试API调用
const testAPI = async (endpoint, method = 'GET', body = null) => {
  const token = (await supabase.auth.getSession()).data.session.access_token;
  const response = await fetch(endpoint, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  });
  const data = await response.json();
  console.log(`${endpoint}:`, data);
  return data;
};

// 测试各个端点
await testAPI('/api/v1/billing/subscriptions/me');
await testAPI('/api/v1/billing/tokens/balance');
await testAPI('/api/v1/console/dashboard/stats');
```

### 3. 集成测试

创建自动化测试脚本：

```typescript
// tests/api-format-validation.test.ts
describe('API Format Validation', () => {
  it('should match subscription response format', async () => {
    const response = await fetch('/api/v1/billing/subscriptions/me');
    const data = await response.json();
    
    expect(data).toHaveProperty('tier');
    expect(data).toHaveProperty('isActive');
    expect(typeof data.tier).toBe('string');
    expect(typeof data.isActive).toBe('boolean');
  });
  
  // 更多测试...
});
```

## 常见不匹配模式

### 1. 命名约定不一致

**问题**: 前端使用camelCase，后端使用snake_case

```typescript
// 前端期望
{ currentBalance: 100 }

// 后端返回
{ current_balance: 100 }
```

**解决方案**: 
- 统一使用camelCase
- 或在前端添加mapper函数

### 2. 日期格式不统一

**问题**: 不同的日期格式

```typescript
// 前端期望
{ createdAt: "2025-10-18T10:30:00Z" }

// 后端返回
{ created_at: "2025-10-18 10:30:00" }
```

**解决方案**:
- 统一使用ISO 8601格式
- 后端使用 `time.RFC3339`

### 3. 可选字段处理

**问题**: 可选字段返回null vs undefined vs 不返回

```typescript
// 前端期望
{ description?: string }

// 后端可能返回
{ description: null }  // 或
{ description: "" }    // 或
{}                     // 不包含字段
```

**解决方案**:
- 明确定义可选字段的行为
- 前端使用 `??` 操作符处理

### 4. 数组vs对象

**问题**: 数据结构不一致

```typescript
// 前端期望
{ items: [...], total: 10 }

// 后端返回
[...]  // 直接返回数组
```

**解决方案**:
- 统一使用包装对象
- 包含元数据（total, page等）

### 5. 错误响应格式

**问题**: 错误格式不统一

```typescript
// 前端期望
{ error: string, code: string }

// 后端可能返回
{ message: string }  // 或
{ error: { message: string, details: any } }
```

**解决方案**:
- 定义统一的错误响应格式
- 使用错误处理中间件

## 修复优先级

### P0 - 立即修复（影响核心功能）
1. ✅ 权限检查API - 已修复
2. ✅ Dashboard统计API - 已修复

### P1 - 短期修复（影响用户体验）
3. [ ] 订阅信息API - 需要验证
4. [ ] Token余额API - 需要验证
5. [ ] Offer创建API - 需要验证

### P2 - 中期优化（改善开发体验）
6. [ ] 统一命名约定
7. [ ] 统一日期格式
8. [ ] 统一错误响应

### P3 - 长期改进（系统性优化）
9. [ ] 自动化类型生成
10. [ ] API契约测试
11. [ ] 文档自动生成

## 预防措施

### 1. 使用OpenAPI规范

```yaml
# specs/openapi/billing.yaml
paths:
  /api/v1/billing/subscriptions/me:
    get:
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SubscriptionInfo'

components:
  schemas:
    SubscriptionInfo:
      type: object
      required:
        - tier
        - isActive
      properties:
        tier:
          type: string
        isActive:
          type: boolean
```

### 2. 自动生成类型

```bash
# 从OpenAPI生成TypeScript类型
npx openapi-typescript specs/openapi/billing.yaml -o apps/frontend/src/lib/api/types/billing.ts

# 从OpenAPI生成Go类型
oapi-codegen -package api specs/openapi/billing.yaml > services/billing/internal/api/types.go
```

### 3. 契约测试

```typescript
// tests/contract/billing.test.ts
import { validateAgainstSchema } from 'openapi-validator';

test('subscription response matches schema', async () => {
  const response = await fetch('/api/v1/billing/subscriptions/me');
  const data = await response.json();
  
  const validation = validateAgainstSchema(data, 'SubscriptionInfo');
  expect(validation.valid).toBe(true);
});
```

### 4. 代码Review清单

- [ ] API端点是否在OpenAPI规范中定义
- [ ] 前端类型是否与规范匹配
- [ ] 后端结构体是否与规范匹配
- [ ] 是否添加了集成测试
- [ ] 是否更新了API文档

## 工具和脚本

### API格式验证脚本

```bash
#!/bin/bash
# scripts/validate-api-formats.sh

echo "Validating API formats..."

# 检查所有API端点
endpoints=(
  "/api/v1/billing/subscriptions/me"
  "/api/v1/billing/tokens/balance"
  "/api/v1/console/dashboard/stats"
)

for endpoint in "${endpoints[@]}"; do
  echo "Testing $endpoint..."
  curl -s "$endpoint" | jq . || echo "❌ Invalid JSON"
done
```

### 类型一致性检查

```typescript
// scripts/check-type-consistency.ts
import * as ts from 'typescript';
import * as fs from 'fs';

// 读取前端类型定义
const frontendTypes = parseFrontendTypes();

// 读取后端类型定义（从OpenAPI）
const backendTypes = parseBackendTypes();

// 比较差异
const differences = compareTypes(frontendTypes, backendTypes);

if (differences.length > 0) {
  console.error('Type mismatches found:');
  differences.forEach(diff => console.error(diff));
  process.exit(1);
}
```

## 总结

### 当前状态
- ✅ 已修复2个关键问题
- ⚠️ 需要验证多个API端点
- 📋 需要建立预防机制

### 下一步行动
1. 运行时验证所有API端点
2. 创建OpenAPI规范
3. 实现自动化测试
4. 建立代码Review流程

### 长期目标
- 100% API端点有OpenAPI定义
- 自动生成前后端类型
- 契约测试覆盖率 > 80%
- 零数据格式不匹配问题

## 相关文档
- [权限API不匹配修复](./PERMISSION_API_MISMATCH_FIX.md)
- [Dashboard架构说明](./DASHBOARD_ARCHITECTURE_CLARIFICATION.md)
- [API端点定义](../apps/frontend/src/lib/api/endpoints.ts)
