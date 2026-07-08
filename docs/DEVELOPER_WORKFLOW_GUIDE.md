# 开发者工作流指南

## 📋 目录
1. [开发环境设置](#开发环境设置)
2. [日常开发流程](#日常开发流程)
3. [代码规范](#代码规范)
4. [Git工作流](#git工作流)
5. [测试策略](#测试策略)
6. [调试技巧](#调试技巧)
7. [性能优化](#性能优化)
8. [常见问题](#常见问题)

---

## 开发环境设置

### 1. 必需工具
```bash
# Node.js (推荐使用nvm)
nvm install 18
nvm use 18

# 包管理器
npm install -g pnpm

# 开发工具
npm install -g typescript
npm install -g eslint
npm install -g prettier
```

### 2. IDE配置

#### VSCode推荐插件
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

#### VSCode设置
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### 3. 环境变量
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## 日常开发流程

### 1. 开始新功能

#### Step 1: 创建分支
```bash
# 从main拉取最新代码
git checkout main
git pull origin main

# 创建功能分支
git checkout -b feature/your-feature-name
```

#### Step 2: 开发前检查
```bash
# 安装依赖
npm install

# 运行类型检查
npm run type-check

# 运行测试
npm test

# 启动开发服务器
npm run dev
```

### 2. 开发过程

#### 代码组织
```typescript
// 1. 导入顺序
import React from 'react';                    // React相关
import { useTranslation } from 'react-i18next'; // 第三方库
import { useOffers } from '~/lib/offers';     // 内部hooks
import Button from '~/core/ui/Button';        // UI组件
import type { Offer } from '~/lib/types';     // 类型定义

// 2. 组件结构
export function MyComponent() {
  // Hooks
  const { t } = useTranslation();
  const { data, isLoading } = useOffers();
  
  // State
  const [selected, setSelected] = useState<string[]>([]);
  
  // Computed values
  const filteredData = useMemo(() => {
    return data.filter(item => selected.includes(item.id));
  }, [data, selected]);
  
  // Event handlers
  const handleClick = useCallback(() => {
    // ...
  }, []);
  
  // Effects
  useEffect(() => {
    // ...
  }, []);
  
  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

#### 类型定义
```typescript
// 优先使用interface
interface User {
  id: string;
  name: string;
  email: string;
}

// 联合类型使用type
type Status = 'pending' | 'active' | 'inactive';

// Props定义
interface MyComponentProps {
  user: User;
  status: Status;
  onUpdate?: (user: User) => void;
}

// 导出类型
export type { User, Status, MyComponentProps };
```

### 3. 提交代码

#### Step 1: 代码检查
```bash
# 格式化代码
npm run format

# Lint检查
npm run lint

# 类型检查
npm run type-check

# 运行测试
npm test
```

#### Step 2: 提交
```bash
# 查看变更
git status
git diff

# 添加文件
git add .

# 提交（使用conventional commits）
git commit -m "feat: add user profile page"
git commit -m "fix: resolve login redirect issue"
git commit -m "docs: update API documentation"
```

#### Commit消息规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式（不影响功能）
refactor: 重构
test: 测试相关
chore: 构建/工具相关
perf: 性能优化
```

### 4. 代码审查

#### 提交PR前检查清单
- [ ] 代码通过所有测试
- [ ] 添加了必要的测试
- [ ] 更新了相关文档
- [ ] 遵循代码规范
- [ ] 没有console.log
- [ ] 没有TODO注释
- [ ] 类型定义完整

#### PR描述模板
```markdown
## 变更描述
简要描述这个PR的目的和实现

## 变更类型
- [ ] 新功能
- [ ] Bug修复
- [ ] 重构
- [ ] 文档更新

## 测试
描述如何测试这些变更

## 截图（如适用）
添加相关截图

## 相关Issue
Closes #123
```

---

## 代码规范

### 1. TypeScript规范

#### 类型注解
```typescript
// ✅ 好的实践
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ 避免
function calculateTotal(items: any): any {
  return items.reduce((sum: any, item: any) => sum + item.price, 0);
}
```

#### 空值处理
```typescript
// ✅ 使用可选链和空值合并
const userName = user?.profile?.name ?? 'Anonymous';

// ❌ 避免
const userName = user && user.profile && user.profile.name || 'Anonymous';
```

#### 类型守卫
```typescript
// ✅ 使用类型守卫
function isOffer(item: Offer | Task): item is Offer {
  return 'offerId' in item;
}

if (isOffer(item)) {
  console.log(item.offerId); // TypeScript知道这是Offer
}
```

### 2. React规范

#### Hooks使用
```typescript
// ✅ 正确的依赖数组
useEffect(() => {
  fetchData(userId);
}, [userId]); // 包含所有依赖

// ❌ 避免
useEffect(() => {
  fetchData(userId);
}, []); // 缺少依赖
```

#### 组件拆分
```typescript
// ✅ 小而专注的组件
function UserCard({ user }: { user: User }) {
  return (
    <Card>
      <UserAvatar user={user} />
      <UserInfo user={user} />
      <UserActions user={user} />
    </Card>
  );
}

// ❌ 避免大组件
function UserCard({ user }: { user: User }) {
  return (
    <Card>
      {/* 200行代码 */}
    </Card>
  );
}
```

#### 条件渲染
```typescript
// ✅ 清晰的条件渲染
{isLoading && <Spinner />}
{error && <ErrorMessage error={error} />}
{data && <DataTable data={data} />}

// ❌ 避免复杂的三元运算
{isLoading ? <Spinner /> : error ? <ErrorMessage /> : data ? <DataTable /> : null}
```

### 3. 样式规范

#### Tailwind CSS
```typescript
// ✅ 使用语义化的类名组合
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">

// ✅ 使用条件类名
<div className={cn(
  "base-classes",
  isActive && "active-classes",
  isDisabled && "disabled-classes"
)}>

// ❌ 避免内联样式
<div style={{ padding: '16px', backgroundColor: 'white' }}>
```

---

## Git工作流

### 1. 分支策略

```
main (生产)
  ↓
develop (开发)
  ↓
feature/xxx (功能)
fix/xxx (修复)
```

### 2. 常用命令

```bash
# 查看状态
git status

# 查看差异
git diff
git diff --staged

# 暂存变更
git stash
git stash pop

# 更新分支
git fetch origin
git rebase origin/main

# 合并分支
git merge feature/xxx

# 撤销变更
git reset HEAD~1  # 撤销最后一次commit
git checkout -- file.ts  # 撤销文件变更
```

### 3. 解决冲突

```bash
# 1. 拉取最新代码
git fetch origin
git rebase origin/main

# 2. 解决冲突
# 编辑冲突文件

# 3. 标记为已解决
git add .
git rebase --continue

# 4. 如果需要放弃rebase
git rebase --abort
```

---

## 测试策略

### 1. 单元测试

```typescript
// hooks测试
import { renderHook, waitFor } from '@testing-library/react';
import { useOffers } from '../useOffers';

describe('useOffers', () => {
  it('should fetch offers', async () => {
    const { result } = renderHook(() => useOffers());
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(result.current.items).toHaveLength(10);
  });
});
```

### 2. 组件测试

```typescript
// 组件测试
import { render, screen, fireEvent } from '@testing-library/react';
import { OfferCard } from '../OfferCard';

describe('OfferCard', () => {
  it('should render offer details', () => {
    const offer = { id: '1', name: 'Test Offer' };
    render(<OfferCard offer={offer} />);
    
    expect(screen.getByText('Test Offer')).toBeInTheDocument();
  });
  
  it('should call onDelete when delete button clicked', () => {
    const onDelete = jest.fn();
    render(<OfferCard offer={offer} onDelete={onDelete} />);
    
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(offer.id);
  });
});
```

### 3. E2E测试

```typescript
// Playwright测试
import { test, expect } from '@playwright/test';

test('user can create offer', async ({ page }) => {
  await page.goto('/offers');
  await page.click('button:has-text("Create Offer")');
  await page.fill('input[name="url"]', 'https://example.com');
  await page.click('button:has-text("Submit")');
  
  await expect(page.locator('.toast-success')).toBeVisible();
  await expect(page.locator('text=example.com')).toBeVisible();
});
```

---

## 调试技巧

### 1. React DevTools

```typescript
// 使用displayName便于调试
MyComponent.displayName = 'MyComponent';

// 使用React DevTools Profiler
// 1. 打开React DevTools
// 2. 切换到Profiler标签
// 3. 点击录制按钮
// 4. 执行操作
// 5. 停止录制查看性能
```

### 2. Console技巧

```typescript
// 使用console.table查看数组
console.table(offers);

// 使用console.group组织日志
console.group('User Actions');
console.log('Action 1');
console.log('Action 2');
console.groupEnd();

// 使用console.time测量性能
console.time('fetchOffers');
await fetchOffers();
console.timeEnd('fetchOffers');
```

### 3. 断点调试

```typescript
// 使用debugger语句
function complexFunction() {
  debugger; // 代码会在这里暂停
  // ...
}

// 使用条件断点
// 在Chrome DevTools中右键点击行号
// 选择"Add conditional breakpoint"
// 输入条件，如: userId === '123'
```

---

## 性能优化

### 1. React优化

```typescript
// 使用React.memo避免不必要的re-render
export const OfferCard = React.memo(({ offer }: Props) => {
  return <Card>{/* ... */}</Card>;
});

// 使用useMemo缓存计算结果
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

// 使用useCallback缓存函数
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

### 2. 数据加载优化

```typescript
// 使用SWR的预加载
import { preload } from 'swr';

// 在用户hover时预加载
<Link 
  href="/offers"
  onMouseEnter={() => preload('/api/offers', fetcher)}
>
  Offers
</Link>

// 使用并行加载
const [offers, tasks] = await Promise.all([
  fetchOffers(),
  fetchTasks()
]);
```

### 3. 图片优化

```typescript
// 使用Next.js Image组件
import Image from 'next/image';

<Image
  src="/logo.png"
  alt="Logo"
  width={200}
  height={50}
  priority // 首屏图片
  placeholder="blur" // 模糊占位符
/>
```

---

## 常见问题

### Q1: TypeScript报错"Property does not exist"
```typescript
// 问题
const value = data.someProperty; // Error

// 解决方案1: 添加类型定义
interface Data {
  someProperty: string;
}
const data: Data = ...;

// 解决方案2: 使用可选链
const value = data?.someProperty;
```

### Q2: Hook依赖警告
```typescript
// 问题
useEffect(() => {
  fetchData(userId);
}, []); // Warning: missing dependency

// 解决方案
useEffect(() => {
  fetchData(userId);
}, [userId]); // 添加依赖
```

### Q3: 状态更新不生效
```typescript
// 问题
const [items, setItems] = useState([]);
items.push(newItem); // 不会触发re-render

// 解决方案
setItems([...items, newItem]); // 创建新数组
```

### Q4: SWR数据不更新
```typescript
// 问题
const { data } = useSWR('/api/offers');
// 数据不更新

// 解决方案1: 手动触发更新
const { data, mutate } = useSWR('/api/offers');
mutate(); // 重新获取数据

// 解决方案2: 配置自动刷新
useSWR('/api/offers', fetcher, {
  refreshInterval: 10000 // 每10秒刷新
});
```

---

## 资源链接

### 官方文档
- [Next.js](https://nextjs.org/docs)
- [React](https://react.dev)
- [TypeScript](https://www.typescriptlang.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [SWR](https://swr.vercel.app)

### 工具
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [TypeScript Playground](https://www.typescriptlang.org/play)
- [Can I Use](https://caniuse.com)

### 学习资源
- [React Patterns](https://reactpatterns.com)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript)
- [Web.dev](https://web.dev)

---

**最后更新**: 2025-10-18  
**版本**: 1.0.0  
**维护者**: Development Team
