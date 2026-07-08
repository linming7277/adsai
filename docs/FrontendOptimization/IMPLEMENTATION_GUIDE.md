# 前端方案渐进式实施指南

> 基于 `FrontendDesignComplete_20251009.md` 的 100% 落地实施计划

## 实施原则

### ✅ DO（推荐做法）
1. **先读后写**：实施每个任务前，先用 Read 工具查看现有代码
2. **小步快跑**：每次只修改1-2个文件，立即测试
3. **文档先行**：先更新任务包的勾选状态，再编写代码
4. **增量提交**：每完成一个子任务，立即 git commit
5. **自动化测试**：编写测试用例，确保不破坏现有功能

### ❌ DON'T（避免做法）
1. ❌ 不要一次性修改大量文件
2. ❌ 不要跳过测试环节
3. ❌ 不要在没有备份的情况下删除代码
4. ❌ 不要忽略 TypeScript 类型错误
5. ❌ 不要直接在生产环境测试

---

## 实施流程（标准 SOP）

每个子任务的执行流程如下：

### 1️⃣ 需求确认阶段
```bash
# 步骤 1.1: 读取任务包文档
Read: docs/FrontendOptimization/frontend-package-xxx.md

# 步骤 1.2: 确认当前子任务的需求
- 输入：什么数据/状态
- 输出：什么组件/API/文件
- 依赖：需要哪些前置任务完成
```

### 2️⃣ 现状分析阶段
```bash
# 步骤 2.1: 查找现有相关代码
Glob: **/*{关键词}*.{ts,tsx}

# 步骤 2.2: 阅读现有实现
Read: 找到的相关文件

# 步骤 2.3: 评估改动范围
- 需要新建哪些文件？
- 需要修改哪些文件？
- 是否有冲突风险？
```

### 3️⃣ 接口设计阶段
```bash
# 步骤 3.1: 定义 TypeScript 接口
- 数据模型 interface
- API 请求/响应类型
- 组件 Props 类型

# 步骤 3.2: 设计 API 端点（如需要）
- 路由路径
- 请求方法
- 鉴权方式
```

### 4️⃣ 实现阶段
```bash
# 步骤 4.1: 创建新文件（如需要）
Write: 新文件路径

# 步骤 4.2: 修改现有文件（如需要）
Edit: 现有文件，使用 old_string/new_string

# 步骤 4.3: 编译检查
Bash: npm run type-check
```

### 5️⃣ 测试阶段
```bash
# 步骤 5.1: 编写单元测试
Write: __tests__/xxx.test.ts

# 步骤 5.2: 运行测试
Bash: npm run test xxx.test.ts

# 步骤 5.3: 手动测试（如需要）
Bash: npm run dev
# 然后在浏览器中验证
```

### 6️⃣ 文档更新阶段
```bash
# 步骤 6.1: 更新任务包勾选状态
Edit: docs/FrontendOptimization/frontend-package-xxx.md
      将 [ ] 改为 [x]

# 步骤 6.2: 记录实施笔记
Edit: IMPLEMENTATION_LOG.md
      追加完成时间、修改文件列表、测试结果
```

### 7️⃣ Git 提交阶段
```bash
# 步骤 7.1: 暂存修改
Bash: git add <修改的文件>

# 步骤 7.2: 提交
Bash: git commit -m "feat(task-id): 简短描述

- 详细改动1
- 详细改动2

Ref: Package A, A2-1"

# 步骤 7.3: 推送（可选）
Bash: git push origin feature/package-a
```

---

## Package A 实施计划（详细版）

### 当前状态分析

**已完成**：A1 流程与后端支持（6/6 ✅）
- ✅ A1-1: 评估流程时序图确认
- ✅ A1-2: SimilarWeb 缓存读写
- ✅ A1-3: AI 评估分支与 Token 消耗逻辑
- ✅ A1-4: 评估历史写入
- ✅ A1-5: BrowserExec 回写接口
- ✅ A1-6: Token 账本记录

**待完成**：
- ⏳ A2: 前端交互（0/5）
- ⏳ A3: API 与校验（0/5）
- ⏳ A4: 测试与验收（0/4）

---

### A2-1: 前端 Hook `useUserSubscription` 扩展

#### 📋 需求说明
创建一个新的 Hook，提供：
- 当前用户的订阅套餐（Pro/Max/Elite）
- 套餐权益信息（月 Token 额度、是否支持 AI）
- 订阅状态（试用中/已订阅/已过期）

#### 📁 相关文件
- **新建**：`apps/frontend/src/core/hooks/use-user-subscription.ts`
- **参考**：`apps/frontend/src/core/hooks/use-user.ts`

#### 🔧 实现步骤

**Step 1: 定义数据类型**
```typescript
// apps/frontend/src/lib/types/subscription.ts
export type SubscriptionTier = 'trial' | 'pro' | 'max' | 'elite';

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  isActive: boolean;
  isElite: boolean;
  canUseAI: boolean;
  monthlyTokenAllocation: number;
  currentTokenBalance: number;
  subscriptionEndDate: string | null;
  trialEndDate: string | null;
}
```

**Step 2: 创建 Hook**
```typescript
// apps/frontend/src/core/hooks/use-user-subscription.ts
import useSWR from 'swr';
import useSupabase from '~/core/hooks/use-supabase';
import type { SubscriptionInfo } from '~/lib/types/subscription';

function useUserSubscription() {
  const client = useSupabase();
  const key = 'user-subscription';

  return useSWR<SubscriptionInfo>([key], async () => {
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // 查询用户订阅信息
    const { data, error } = await client
      .from('User')
      .select('subscription_tier, subscription_end_date, trial_end_date, token_balance, monthly_token_allocation')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    const now = new Date();
    const trialEnd = data.trial_end_date ? new Date(data.trial_end_date) : null;
    const subEnd = data.subscription_end_date ? new Date(data.subscription_end_date) : null;

    const isActive = (trialEnd && trialEnd > now) || (subEnd && subEnd > now);
    const isElite = data.subscription_tier === 'elite';

    return {
      tier: data.subscription_tier,
      isActive,
      isElite,
      canUseAI: isActive && isElite,
      monthlyTokenAllocation: data.monthly_token_allocation || 1000,
      currentTokenBalance: data.token_balance || 0,
      subscriptionEndDate: data.subscription_end_date,
      trialEndDate: data.trial_end_date,
    };
  });
}

export default useUserSubscription;
```

**Step 3: 编写测试**
```typescript
// apps/frontend/src/core/hooks/__tests__/use-user-subscription.test.ts
import { renderHook } from '@testing-library/react';
import useUserSubscription from '../use-user-subscription';

describe('useUserSubscription', () => {
  it('should return Elite subscription info', async () => {
    // Mock Supabase response
    // ...

    const { result } = renderHook(() => useUserSubscription());

    expect(result.current.data?.tier).toBe('elite');
    expect(result.current.data?.canUseAI).toBe(true);
  });
});
```

#### ✅ 验收标准
- [ ] TypeScript 编译通过
- [ ] 单元测试通过
- [ ] 在浏览器 DevTools 中能看到正确的订阅信息
- [ ] 文档已更新：任务包勾选 ✅

---

### A2-2: 前端 Offers 列表 - 评估按钮交互

#### 📋 需求说明
在 Offers 列表中添加"评估"按钮，根据用户权限显示不同状态：
- **Elite 用户**：直接评估（自动启用 AI）
- **Pro/Max 用户**：评估（仅基础评估） + 升级 AI 提示
- **Token 不足**：禁用按钮 + 充值提示

#### 📁 相关文件
- **新建**：`apps/frontend/src/components/offers/evaluate-button.tsx`
- **修改**：`apps/frontend/src/components/offers/offers-table.tsx`（添加按钮列）

#### 🔧 实现步骤

**Step 1: 创建 EvaluateButton 组件**
```typescript
// apps/frontend/src/components/offers/evaluate-button.tsx
'use client';

import { Button } from '~/core/ui/Button';
import { Play, Zap } from 'lucide-react';
import { useState } from 'react';
import useUserSubscription from '~/core/hooks/use-user-subscription';

interface EvaluateButtonProps {
  offerId: string;
  onSuccess?: () => void;
}

export function EvaluateButton({ offerId, onSuccess }: EvaluateButtonProps) {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const { data: subscription } = useUserSubscription();

  const canAfford = (subscription?.currentTokenBalance || 0) >= (subscription?.isElite ? 3 : 1);
  const tokenCost = subscription?.isElite ? 3 : 1;

  const handleEvaluate = async () => {
    if (!canAfford) {
      // TODO: 打开充值对话框
      return;
    }

    setIsEvaluating(true);

    try {
      const response = await fetch(`/api/offers/${offerId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enableAI: subscription?.isElite || false,
        }),
      });

      if (!response.ok) {
        throw new Error('Evaluation failed');
      }

      const result = await response.json();

      // TODO: 显示成功提示
      onSuccess?.();
    } catch (error) {
      // TODO: 显示错误提示
      console.error(error);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <Button
      size="sm"
      onClick={handleEvaluate}
      disabled={!canAfford || isEvaluating}
    >
      {isEvaluating ? (
        '评估中...'
      ) : (
        <>
          {subscription?.isElite ? (
            <Zap className="w-4 h-4 mr-1" />
          ) : (
            <Play className="w-4 h-4 mr-1" />
          )}
          评估 ({tokenCost} Token)
        </>
      )}
    </Button>
  );
}
```

#### ✅ 验收标准
- [ ] Elite 用户点击评估，消耗 3 Token
- [ ] Pro 用户点击评估，消耗 1 Token
- [ ] Token 不足时按钮禁用
- [ ] 评估中显示 loading 状态
- [ ] 文档已更新：任务包勾选 ✅

---

## 实施建议

### 建议 1：逐个任务执行
**不要**一次性实施所有任务，建议：
1. 完成 A2-1
2. 测试 A2-1
3. 提交 A2-1
4. 再开始 A2-2

### 建议 2：使用分支管理
```bash
# 为每个 Package 创建独立分支
git checkout -b feature/package-a
git checkout -b feature/package-b

# 完成后合并到 dev
git checkout dev
git merge feature/package-a
```

### 建议 3：实施优先级
1. **P0**：Package A（Offer 评估核心功能）
2. **P1**：Package B（Dashboard）、Package C（Offers 列表）
3. **P2**：Package D（Marketing）、Package E（Navigation）
4. **P3**：Package F（i18n）、Package G（优化）

### 建议 4：每日目标
- **Week 1-2**：完成 Package A（14 个子任务）
- **Week 3**：完成 Package B + C（10 个子任务）
- **Week 4**：完成 Package D + E（8 个子任务）
- **Week 5**：完成 Package F + G + 测试（8 个子任务）

---

## 需要我开始实施吗？

请确认：
1. ✅ 是否立即开始实施 **A2-1: useUserSubscription Hook**？
2. ✅ 是否需要我在每个步骤前征求你的同意？
3. ✅ 是否需要我自动提交 Git Commit？

回复 "开始实施 A2-1" 即可开始第一个任务。
