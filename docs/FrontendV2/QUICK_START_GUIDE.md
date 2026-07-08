# AutoAds 前端优化快速上手指南

## 🚀 技术栈概览（已升级）

### 核心技术
```
框架: Next.js 15 + React 19
UI库: shadcn/ui (基于Radix UI)
样式: Tailwind CSS v4
状态: TanStack Query v5 + Zustand v5
动画: Motion (轻量版)
图表: Tremor
类型: TypeScript 5.5
```

### 快速开始

```bash
# 克隆项目
git clone <repo-url>
cd apps/frontend

# 安装依赖
npm install

# 启动开发服务器（使用Turbopack）
npm run dev

# 构建生产版本
npm run build

# 查看组件库
npm run storybook
```

---

## 🎯 核心设计原则

### 1. Glassmorphism（毛玻璃效果）
所有卡片和容器都应使用毛玻璃效果：
```tsx
import { GlassCard, GlassCardContent } from '~/components/ui/GlassCard';

<GlassCard variant="default" hover>
  <GlassCardContent>
    {/* 内容 */}
  </GlassCardContent>
</GlassCard>
```

**变体选择**：
- `default` - 白色毛玻璃（最常用）
- `gradient` - 渐变毛玻璃
- `primary` - 蓝紫色调
- `success` - 绿色调
- `warning` - 橙色调
- `error` - 红色调

---

### 2. 渐变色系统
使用统一的蓝→紫→粉渐变：

```tsx
// 文字渐变
<h1 className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
  标题文字
</h1>

// 背景渐变
<div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-900/20 dark:to-pink-900/20">
  {/* 内容 */}
</div>

// 按钮渐变
<GradientButton variant="primary">
  点击按钮
</GradientButton>
```

---

### 3. 深色模式支持
所有组件都必须支持深色模式：

```tsx
// 使用Tailwind的dark:前缀
<div className="bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100">
  {/* 内容 */}
</div>

// GlassCard自动支持深色模式
<GlassCard variant="default">
  {/* 自动适配深色模式 */}
</GlassCard>
```

---

## 🧩 核心组件使用

### shadcn/ui 组件（推荐使用）

#### Button - 按钮
```tsx
import { Button } from '~/components/ui/button';

// 基础用法
<Button>Click me</Button>

// 变体
<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// 尺寸
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>

// 加载状态
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Loading...
</Button>
```

#### Card - 卡片
```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card Description</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card Content</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

#### Dialog - 对话框
```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>
        Dialog description goes here.
      </DialogDescription>
    </DialogHeader>
    {/* Dialog content */}
  </DialogContent>
</Dialog>
```

#### Select - 选择器
```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

<Select>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
    <SelectItem value="option3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

---

### GlassCard - 毛玻璃卡片（自定义组件）
```tsx
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '~/components/ui/GlassCard';

<GlassCard variant="gradient" hover>
  <GlassCardHeader>
    <GlassCardTitle>卡片标题</GlassCardTitle>
  </GlassCardHeader>
  <GlassCardContent>
    <p>卡片内容</p>
  </GlassCardContent>
</GlassCard>
```

**注意**：GlassCard是基于shadcn/ui Card的增强版本，添加了毛玻璃效果。

---

### MetricCard - 指标卡片
```tsx
import { MetricCard } from '~/components/ui/MetricCard';
import { TrendingUp } from 'lucide-react';

<MetricCard
  title="总收入"
  value={12345}
  trend="up"
  trendValue="+12.5%"
  icon={<TrendingUp className="h-6 w-6" />}
  variant="success"
  loading={false}
/>
```

**Props说明**：
- `title`: 指标名称
- `value`: 数值（支持number或string）
- `trend`: 趋势方向（'up' | 'down' | 'stable'）
- `trendValue`: 趋势值（如 "+12.5%"）
- `icon`: 图标组件
- `variant`: 颜色变体
- `loading`: 加载状态

---

### GradientButton - 渐变按钮
```tsx
import { GradientButton } from '~/components/ui/GradientButton';

<GradientButton
  variant="primary"
  size="lg"
  loading={isLoading}
  onClick={handleClick}
>
  开始评估
</GradientButton>
```

**变体**：
- `primary` - 蓝紫渐变
- `success` - 绿色渐变
- `warning` - 橙色渐变
- `error` - 红色渐变
- `outline` - 边框样式
- `ghost` - 透明样式

---

### ProgressRing - 圆环进度条
```tsx
import { ProgressRing } from '~/components/ui/ProgressRing';

<ProgressRing
  value={85}
  size="lg"
  showValue={true}
  color="primary"
/>
```

**尺寸**：
- `sm` - 小（48px）
- `md` - 中（64px）
- `lg` - 大（80px）
- `xl` - 超大（96px）

---

## 🎬 动画使用

### Motion（轻量版）

```tsx
import { motion } from 'motion/react';

// 基础动画
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  {/* 内容 */}
</motion.div>

// 悬停动画
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
  Click me
</motion.button>

// 列表动画
<motion.ul>
  {items.map((item, index) => (
    <motion.li
      key={item.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      {item.name}
    </motion.li>
  ))}
</motion.ul>
```

### CSS动画（最佳性能）

```tsx
// 使用Tailwind动画类
<div className="animate-fade-in animate-slide-up">
  {/* 内容 */}
</div>

// 自定义CSS动画
/* globals.css */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { transform: translateY(20px); }
  to { transform: translateY(0); }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
```

---

### 列表交错动画
```tsx
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';

<FadeInStagger className="grid grid-cols-3 gap-4">
  {items.map((item) => (
    <FadeInStaggerItem key={item.id}>
      <GlassCard>{/* 卡片内容 */}</GlassCard>
    </FadeInStaggerItem>
  ))}
</FadeInStagger>
```

---

### 悬停效果
```tsx
// 使用预定义的CSS类
<div className="hover-lift">
  {/* 悬停时上浮 */}
</div>

<div className="hover-glow">
  {/* 悬停时发光 */}
</div>

// 或使用Framer Motion
<motion.div
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
  {/* 内容 */}
</motion.div>
```

---

## 📱 响应式设计

### 断点系统
```tsx
// Tailwind断点
sm: 640px   // 小屏幕
md: 768px   // 平板
lg: 1024px  // 笔记本
xl: 1280px  // 桌面
2xl: 1536px // 大屏

// 使用示例
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 移动端1列，平板2列，桌面3列 */}
</div>
```

---

### 移动端专用组件
```tsx
// 移动端显示，桌面端隐藏
<div className="md:hidden">
  <MobileOfferCard offer={offer} />
</div>

// 桌面端显示，移动端隐藏
<div className="hidden md:block">
  <OffersTable offers={offers} />
</div>
```

---

## 🎨 颜色系统

### 主色调
```css
/* 浅色模式 */
--primary: #3b82f6 (蓝色)
--secondary: #8b5cf6 (紫色)
--accent: #ec4899 (粉色)

/* 深色模式 */
--primary: #60a5fa (浅蓝)
--secondary: #a78bfa (浅紫)
--accent: #f472b6 (浅粉)
```

### 语义化颜色
```tsx
// Success - 绿色
<Badge variant="success">成功</Badge>

// Warning - 橙色
<Badge variant="warning">警告</Badge>

// Error - 红色
<Badge variant="error">错误</Badge>

// Info - 蓝色
<Badge variant="info">信息</Badge>
```

---

## 🔄 数据获取和状态管理

### TanStack Query v5（推荐）

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// 基础查询
const { data, isLoading, error } = useQuery({
  queryKey: ['offers'],
  queryFn: async () => {
    const res = await fetch('/api/offers');
    return res.json();
  },
  staleTime: 5 * 60 * 1000, // 5分钟
  gcTime: 10 * 60 * 1000, // 10分钟（v5新特性）
});

// 带参数的查询
const { data } = useQuery({
  queryKey: ['offer', offerId],
  queryFn: () => fetchOffer(offerId),
  enabled: !!offerId, // 仅在offerId存在时执行
});

// 变更操作
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: createOffer,
  onSuccess: () => {
    // 使缓存失效
    queryClient.invalidateQueries({ queryKey: ['offers'] });
  },
  // 乐观更新
  onMutate: async (newOffer) => {
    await queryClient.cancelQueries({ queryKey: ['offers'] });
    const previousOffers = queryClient.getQueryData(['offers']);
    queryClient.setQueryData(['offers'], (old) => [...old, newOffer]);
    return { previousOffers };
  },
  onError: (err, newOffer, context) => {
    queryClient.setQueryData(['offers'], context.previousOffers);
  },
});

// 使用mutation
<Button onClick={() => mutation.mutate(newOffer)}>
  {mutation.isPending ? 'Creating...' : 'Create Offer'}
</Button>
```

### Zustand（仅用于UI状态）

```tsx
import { create } from 'zustand';

// 定义store
interface UIStore {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  theme: 'light',
  sidebarOpen: true,
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));

// 使用store
function ThemeToggle() {
  const { theme, setTheme } = useUIStore();
  
  return (
    <Button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Toggle Theme
    </Button>
  );
}
```

---

## 📊 图表组件（Tremor）

### 基础用法

```tsx
import { LineChart, BarChart, DonutChart } from '@tremor/react';

// 折线图
<LineChart
  data={data}
  index="date"
  categories={["revenue", "spend", "roas"]}
  colors={["blue", "red", "green"]}
  valueFormatter={(value) => `$${value.toLocaleString()}`}
  yAxisWidth={60}
  showLegend={true}
  showGridLines={true}
  className="h-80"
/>

// 柱状图
<BarChart
  data={data}
  index="name"
  categories={["sales"]}
  colors={["blue"]}
  valueFormatter={(value) => `$${value}`}
  yAxisWidth={48}
/>

// 环形图
<DonutChart
  data={data}
  category="value"
  index="name"
  valueFormatter={(value) => `${value}%`}
  colors={["blue", "cyan", "indigo", "violet", "purple"]}
/>
```

### 自定义样式

```tsx
<LineChart
  data={data}
  index="date"
  categories={["revenue"]}
  colors={["blue"]}
  className="h-80"
  customTooltip={({ payload, active }) => {
    if (!active || !payload) return null;
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="flex flex-col gap-2">
          {payload.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm">{item.name}: {item.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }}
/>
```

---

## 🔄 加载状态

### Skeleton（shadcn/ui）
```tsx
import { Skeleton } from '~/components/ui/skeleton';

{isLoading ? (
  <div className="space-y-4">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-8 w-1/2" />
    <Skeleton className="h-3 w-full" />
  </div>
) : (
  <ActualContent />
)}
```

### 专用骨架屏
```tsx
import { SkeletonCard, SkeletonMetricCard, SkeletonTable } from '~/components/ui/Skeleton';

// 卡片骨架屏
<SkeletonCard />

// 指标卡片骨架屏
<SkeletonMetricCard />

// 表格骨架屏
<SkeletonTable />
```

---

## 🎯 空状态

```tsx
import { EmptyState } from '~/components/ui/EmptyState';
import { Package } from 'lucide-react';

<EmptyState
  icon={Package}
  title="暂无Offers"
  description="开始创建您的第一个Offer，开启评估之旅"
  action={{
    label: "创建Offer",
    onClick: () => router.push('/offers?action=create')
  }}
/>
```

---

## 🚨 错误处理

```tsx
import { ErrorBoundary } from '~/components/states/ErrorBoundary';
import { ErrorState } from '~/components/states/ErrorState';

// 使用错误边界
<ErrorBoundary fallback={<ErrorState />}>
  <YourComponent />
</ErrorBoundary>

// 手动显示错误状态
{error && (
  <ErrorState
    title="加载失败"
    description={error.message}
    action={{
      label: "重试",
      onClick: () => refetch()
    }}
  />
)}
```

---

## 📊 图表使用

### 趋势图
```tsx
import { TrendChart } from '~/components/charts/TrendChart';

<TrendChart
  data={trendData}
  dataKeys={['revenue', 'roas']}
  colors={['#3b82f6', '#8b5cf6']}
  height={300}
/>
```

### 雷达图
```tsx
import { OfferRadarChart } from '~/components/charts/OfferRadarChart';

<OfferRadarChart
  evaluation={evaluationData}
/>
```

---

## ⌨️ 快捷键

### 全局快捷键
```
Cmd/Ctrl + K: 打开命令面板
Cmd/Ctrl + /: 显示快捷键帮助
Esc: 关闭模态框
```

### 实现自定义快捷键
```tsx
import { useHotkeys } from 'react-hotkeys-hook';

useHotkeys('cmd+n, ctrl+n', () => {
  // 创建新Offer
  router.push('/offers?action=create');
});
```

---

## 🎨 常用布局模式

### Hero区域
```tsx
<section className="relative overflow-hidden py-20 lg:py-32">
  {/* 渐变背景 */}
  <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50" />
  
  {/* 网格背景 */}
  <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
  
  {/* 光晕效果 */}
  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 blur-3xl rounded-full" />
  
  {/* 内容 */}
  <div className="relative">
    {/* Hero内容 */}
  </div>
</section>
```

---

### 卡片网格
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map((item) => (
    <GlassCard key={item.id} hover>
      <GlassCardContent className="p-6">
        {/* 卡片内容 */}
      </GlassCardContent>
    </GlassCard>
  ))}
</div>
```

---

### 统计卡片组
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <MetricCard title="总数" value={100} icon={<Package />} />
  <MetricCard title="已评估" value={75} icon={<CheckCircle />} />
  <MetricCard title="待评估" value={25} icon={<Clock />} />
  <MetricCard title="平均分" value={8.5} icon={<Star />} />
</div>
```

---

## 🔍 最佳实践

### 1. 组件命名
- 使用PascalCase：`MyComponent`
- 文件名与组件名一致：`MyComponent.tsx`
- 使用描述性名称：`UserProfileCard` 而不是 `Card1`

### 2. Props设计
```tsx
// ✅ 好的Props设计
interface CardProps {
  title: string;
  description?: string;
  variant?: 'default' | 'primary' | 'success';
  onClick?: () => void;
}

// ❌ 避免的Props设计
interface CardProps {
  data: any; // 太宽泛
  config: object; // 不明确
}
```

### 3. 状态管理
```tsx
// ✅ 使用合适的状态管理
// 本地状态 - useState
const [isOpen, setIsOpen] = useState(false);

// 服务端状态 - TanStack Query
const { data, isLoading } = useQuery({
  queryKey: ['offers'],
  queryFn: fetchOffers,
});

// 全局状态 - Zustand
const { user } = useUserStore();
```

### 4. 性能优化
```tsx
// ✅ 使用memo避免不必要的重渲染
const MemoizedCard = memo(Card);

// ✅ 使用useMemo缓存计算结果
const sortedData = useMemo(() => {
  return data.sort((a, b) => b.score - a.score);
}, [data]);

// ✅ 使用useCallback缓存函数
const handleClick = useCallback(() => {
  // 处理点击
}, [dependency]);
```

### 5. 可访问性
```tsx
// ✅ 添加ARIA标签
<button
  aria-label="关闭对话框"
  aria-pressed={isPressed}
  onClick={handleClose}
>
  <X className="h-4 w-4" />
</button>

// ✅ 使用语义化HTML
<nav aria-label="主导航">
  <ul>
    <li><a href="/dashboard">Dashboard</a></li>
  </ul>
</nav>
```

---

## 🎨 Tailwind v4 新特性

### 使用oklch颜色空间

```css
/* globals.css */
@theme {
  /* 更好的颜色插值 */
  --color-primary: oklch(0.6 0.2 250);
  --color-secondary: oklch(0.65 0.25 280);
  
  /* 自动深色模式 */
  --color-text: light-dark(oklch(0.2 0 0), oklch(0.9 0 0));
}
```

```tsx
// 在组件中使用
<div className="bg-primary text-text">
  {/* 自动适配深色模式 */}
</div>
```

### 简化的类名

```tsx
// ❌ Tailwind v3
<div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">

// ✅ Tailwind v4
<div className="glass-card p-6">

/* globals.css */
@theme {
  --glass-card: {
    background: light-dark(white, oklch(0.2 0 0));
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    border: 1px solid light-dark(oklch(0.9 0 0), oklch(0.3 0 0));
  };
}
```

---

## 🐛 常见问题

### Q: shadcn/ui组件样式不生效？
A: 确保已正确初始化shadcn/ui，检查`components.json`配置，确认Tailwind配置正确。

### Q: TanStack Query数据不更新？
A: 检查`staleTime`和`gcTime`配置，确保queryKey正确，使用DevTools调试。

### Q: Tremor图表不显示？
A: 确保数据格式正确，检查`index`和`categories`属性，查看控制台错误。

### Q: Motion动画不流畅？
A: 使用CSS动画替代复杂的JS动画，添加`will-change`属性，检查是否有性能瓶颈。

### Q: Tailwind v4类名不生效？
A: 确保使用了正确的导入语法`@import "tailwindcss"`，检查PostCSS配置。

### Q: Next.js 15构建失败？
A: 检查React 19兼容性，更新所有依赖到最新版本，查看构建日志。

---

## 📚 参考资源

### 官方文档
- [Next.js 15文档](https://nextjs.org/docs)
- [React 19文档](https://react.dev)
- [Tailwind CSS v4文档](https://tailwindcss.com/docs)
- [shadcn/ui文档](https://ui.shadcn.com)
- [TanStack Query v5文档](https://tanstack.com/query/latest)
- [Tremor文档](https://tremor.so/docs)
- [Motion文档](https://motion.dev)

### 内部文档
- `docs/FrontendV2/UI_Plan.md` - UI设计方案
- `docs/FrontendV2/COMPLETE_UI_OPTIMIZATION_PLAN.md` - 完整优化方案（含技术栈升级）
- `docs/FrontendV2/IMPLEMENTATION_ROADMAP.md` - 实施路线图（7周计划）

### 组件库
- Storybook: `npm run storybook`
- shadcn/ui组件: `apps/frontend/src/components/ui/`
- 自定义组件: `apps/frontend/src/components/`

### 快速命令

```bash
# 添加新的shadcn组件
npx shadcn@latest add [component-name]

# 查看可用组件列表
npx shadcn@latest add

# 运行类型检查
npm run typecheck

# 分析包体积
npm run analyze

# 运行Storybook
npm run storybook
```

---

## 🎓 学习路径

### 新手（1-2天）
1. 熟悉GlassCard、MetricCard、GradientButton
2. 了解颜色系统和响应式设计
3. 练习创建简单页面

### 进阶（3-5天）
1. 掌握动画系统
2. 学习图表组件
3. 理解性能优化技巧

### 高级（1-2周）
1. 创建自定义组件
2. 优化复杂交互
3. 贡献组件库

---

## 💡 提示

1. **先看设计稿**：开始编码前先查看Figma设计
2. **复用组件**：优先使用现有组件，避免重复造轮子
3. **测试深色模式**：每个组件都要测试深色模式
4. **检查性能**：使用Lighthouse检查性能
5. **保持一致**：遵循现有的代码风格和命名规范

---

**快速开始**：
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 查看组件库
npm run storybook

# 运行测试
npm run test

# 构建生产版本
npm run build
```

---

**需要帮助？**
- 查看Storybook示例
- 阅读完整文档
- 询问团队成员
- 提交Issue

祝编码愉快！🚀