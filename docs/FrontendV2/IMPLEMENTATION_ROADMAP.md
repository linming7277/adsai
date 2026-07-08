# AdsAI 前端优化实施路线图

## 📅 总体时间规划：7周（含技术栈升级）

---

## 🚀 Week 0: 技术栈升级周（新增）

### 目标
完成核心技术栈升级，为后续优化奠定基础。

### Day 1: Next.js 15 + React 19 升级

#### 任务清单
- [ ] 备份当前代码（创建feature分支）
- [ ] 升级依赖包
  ```bash
  npm install next@15 react@19 react-dom@19
  npm install @tanstack/react-query@5
  npm install tailwindcss@next @tailwindcss/postcss@next
  ```
- [ ] 更新 `next.config.js`
  - [ ] 启用Turbopack
  - [ ] 配置React Server Components
  - [ ] 优化包导入
- [ ] 更新 `tsconfig.json`
  - [ ] 添加React 19类型支持
- [ ] 运行测试确保兼容性
  ```bash
  npm run typecheck
  npm run build
  npm run dev
  ```

**验证清单**：
- [ ] 开发服务器正常启动
- [ ] 所有页面正常渲染
- [ ] 无TypeScript错误
- [ ] 构建成功

---

### Day 2: Tailwind v4 升级

#### 任务清单
- [ ] 安装Tailwind v4
  ```bash
  npm install tailwindcss@next @tailwindcss/postcss@next
  ```
- [ ] 更新 `tailwind.config.js`
  ```javascript
  export default {
    content: ['./src/**/*.{ts,tsx,jsx,js}'],
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          primary: 'oklch(var(--primary) / <alpha-value>)',
          secondary: 'oklch(var(--secondary) / <alpha-value>)',
        },
      },
    },
  };
  ```
- [ ] 更新 `globals.css`
  ```css
  @import "tailwindcss";
  
  @theme {
    --color-primary: oklch(0.6 0.2 250);
    --color-secondary: oklch(0.65 0.25 280);
    
    --glass-card: {
      background: light-dark(oklch(1 0 0 / 0.8), oklch(0.2 0 0 / 0.8));
      backdrop-filter: blur(12px);
      border: 1px solid light-dark(oklch(1 0 0 / 0.2), oklch(0.3 0 0 / 0.3));
    };
  }
  ```
- [ ] 测试所有页面样式
- [ ] 优化常用类名组合

**验证清单**：
- [ ] 所有页面样式正常
- [ ] 深色模式正常工作
- [ ] 响应式布局正常
- [ ] 构建体积减小

---

### Day 3: shadcn/ui 引入

#### 任务清单
- [ ] 初始化shadcn/ui
  ```bash
  npx shadcn@latest init
  ```
  配置选项：
  - Style: Default
  - Base color: Slate
  - CSS variables: Yes
  
- [ ] 安装核心组件
  ```bash
  npx shadcn@latest add button
  npx shadcn@latest add card
  npx shadcn@latest add dialog
  npx shadcn@latest add dropdown-menu
  npx shadcn@latest add select
  npx shadcn@latest add tabs
  npx shadcn@latest add tooltip
  npx shadcn@latest add avatar
  npx shadcn@latest add badge
  npx shadcn@latest add checkbox
  npx shadcn@latest add input
  npx shadcn@latest add label
  npx shadcn@latest add separator
  npx shadcn@latest add skeleton
  ```

- [ ] 创建组件映射文档
  ```markdown
  # 组件迁移映射
  
  | 旧组件 | 新组件 | 状态 |
  |--------|--------|------|
  | @radix-ui/react-dialog | ~/components/ui/dialog | ✅ |
  | @radix-ui/react-dropdown-menu | ~/components/ui/dropdown-menu | ✅ |
  | 自定义Button | ~/components/ui/button | 待迁移 |
  | 自定义Card | ~/components/ui/card | 待迁移 |
  ```

- [ ] 更新Storybook
  - [ ] 为新组件添加stories
  - [ ] 测试所有变体

**验证清单**：
- [ ] 所有shadcn组件正常工作
- [ ] 组件样式符合设计系统
- [ ] TypeScript类型完整
- [ ] Storybook文档完整

---

### Day 4: 状态管理优化

#### 任务清单
- [ ] 升级TanStack Query到v5
  ```bash
  npm install @tanstack/react-query@5
  npm install @tanstack/react-query-devtools@5
  ```

- [ ] 移除SWR依赖
  ```bash
  npm uninstall swr
  ```

- [ ] 创建统一的Query配置
  ```typescript
  // lib/query-client.ts
  import { QueryClient } from '@tanstack/react-query';
  
  export const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5分钟
        gcTime: 10 * 60 * 1000, // 10分钟
        retry: 3,
        refetchOnWindowFocus: false,
      },
    },
  });
  ```

- [ ] 迁移所有SWR hooks到TanStack Query
  ```typescript
  // ❌ 旧代码
  const { data, error } = useSWR('/api/offers', fetcher);
  
  // ✅ 新代码
  const { data, error } = useQuery({
    queryKey: ['offers'],
    queryFn: () => fetch('/api/offers').then(r => r.json()),
  });
  ```

- [ ] 优化Zustand store（仅保留UI状态）
  ```typescript
  // store/ui-store.ts
  import { create } from 'zustand';
  
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
  ```

**验证清单**：
- [ ] 所有数据获取正常
- [ ] 缓存策略生效
- [ ] 乐观更新正常
- [ ] DevTools正常工作

---

### Day 5: 图表和动画库升级

#### 任务清单 - 图表库
- [ ] 安装Tremor
  ```bash
  npm install @tremor/react
  ```

- [ ] 创建图表组件迁移计划
  ```typescript
  // components/charts/TrendChart.tsx
  import { LineChart } from '@tremor/react';
  
  export function TrendChart({ data }: TrendChartProps) {
    return (
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
    );
  }
  ```

- [ ] 逐步迁移Recharts组件
  - [ ] Dashboard趋势图
  - [ ] Offer性能图
  - [ ] 收入对比图

#### 任务清单 - 动画库
- [ ] 安装Motion
  ```bash
  npm install motion
  ```

- [ ] 创建动画工具函数
  ```typescript
  // lib/animations.ts
  export const fadeIn = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };
  
  export const slideUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };
  ```

- [ ] 优化关键动画
  - [ ] 页面切换动画
  - [ ] 卡片进入动画
  - [ ] 按钮交互动画

**验证清单**：
- [ ] 所有图表正常渲染
- [ ] 图表性能提升明显
- [ ] 动画流畅（60fps）
- [ ] 包体积减小

---

### Week 0 完成标准
- [ ] 所有依赖升级成功
- [ ] 开发服务器启动速度提升5x
- [ ] 热更新速度提升10x
- [ ] 包体积减少30%+
- [ ] 所有测试通过
- [ ] 文档更新完成

---

## 🔴 Week 1-2: P0 优先级任务

### Week 1: 设计系统统一

#### Day 1-2: Marketing组件库创建
- [ ] 创建 `MarketingGlassCard` 组件
- [ ] 创建 `MarketingHero` 组件
- [ ] 创建 `MarketingFeatureCard` 组件
- [ ] 创建 `MarketingPricingCard` 组件
- [ ] 添加Storybook示例

**文件清单**：
```
apps/frontend/src/components/marketing/
├── MarketingGlassCard.tsx
├── MarketingHero.tsx
├── MarketingFeatureCard.tsx
├── MarketingPricingCard.tsx
└── index.ts
```

#### Day 3-4: Landing Page重构
- [ ] 重构 `HeroSection.tsx` - 应用Glassmorphism
- [ ] 重构 `FeaturesSection.tsx` - 使用新组件
- [ ] 重构 `PricingSection.tsx` - 统一风格
- [ ] 重构 `TrustBar.tsx` - 添加动画
- [ ] 更新 `LandingPageClient.tsx`

**关键改动**：
- 渐变背景 + 网格纹理
- 统计数据使用GlassCard
- 添加光晕效果
- 优化动画时序

#### Day 5: Features & Pricing页面
- [ ] 重构 `apps/frontend/src/app/(site)/features/page.tsx`
- [ ] 重构 `apps/frontend/src/app/(site)/pricing/page.tsx`
- [ ] 重构 `apps/frontend/src/components/PricingTable.tsx`
- [ ] 添加推荐套餐光晕效果

---

### Week 2: 深色模式 + 性能优化

#### Day 1-2: 深色模式完善
- [ ] 更新 `GlassCard.tsx` - 添加深色模式变体
- [ ] 更新 `MetricCard.tsx` - 深色模式适配
- [ ] 更新 `GradientButton.tsx` - 深色模式适配
- [ ] 更新 `animations.css` - 深色模式渐变
- [ ] 测试所有页面深色模式

**验证清单**：
- [ ] 所有文字对比度 ≥ 4.5:1
- [ ] 边框和分隔线可见
- [ ] 渐变色在深色背景下效果良好
- [ ] 悬停状态清晰可见

#### Day 3-4: 性能优化
- [ ] 实现关键路径优化
  - [ ] Landing Page懒加载
  - [ ] Features Section懒加载
  - [ ] Pricing Section懒加载
- [ ] 图片优化
  - [ ] 添加 `priority` 标记
  - [ ] 生成 blur placeholder
  - [ ] 优化图片尺寸
- [ ] 字体优化
  - [ ] 使用 `next/font`
  - [ ] 配置 `font-display: swap`

**性能目标**：
- LCP < 2.5s
- FID < 100ms
- CLS < 0.1

#### Day 5: 骨架屏系统
- [ ] 创建 `Skeleton.tsx` 基础组件
- [ ] 创建 `SkeletonCard.tsx`
- [ ] 创建 `SkeletonMetricCard.tsx`
- [ ] 创建 `SkeletonTable.tsx`
- [ ] 创建 `SkeletonHero.tsx`
- [ ] 在所有页面应用骨架屏

**文件清单**：
```
apps/frontend/src/components/ui/
├── Skeleton.tsx
├── SkeletonCard.tsx
├── SkeletonMetricCard.tsx
├── SkeletonTable.tsx
└── SkeletonHero.tsx
```

---

## 🟡 Week 3-4: P1 优先级任务

### Week 3: 微交互和动画

#### Day 1-2: 核心动画组件
- [ ] 创建 `PageTransition.tsx` - 页面切换动画
- [ ] 创建 `RippleButton.tsx` - 波纹效果
- [ ] 创建 `TiltCard.tsx` - 3D倾斜效果
- [ ] 创建 `AnimatedNumber.tsx` - 数字滚动
- [ ] 创建 `ParallaxSection.tsx` - 视差效果

**文件清单**：
```
apps/frontend/src/components/animations/
├── PageTransition.tsx
├── RippleButton.tsx
├── TiltCard.tsx
├── AnimatedNumber.tsx
└── ParallaxSection.tsx
```

#### Day 3-4: 应用动画到页面
- [ ] Landing Page添加视差效果
- [ ] Dashboard添加数字滚动动画
- [ ] Offers页面添加卡片倾斜效果
- [ ] 所有按钮添加波纹效果
- [ ] 页面切换添加过渡动画

#### Day 5: 动画性能优化
- [ ] 使用 `will-change` 优化
- [ ] 减少重排和重绘
- [ ] 使用 `transform` 和 `opacity`
- [ ] 添加 `prefers-reduced-motion` 支持

---

### Week 4: 移动端优化

#### Day 1-2: 移动端组件
- [ ] 创建 `MobileBottomNav.tsx`
- [ ] 创建 `MobileOfferCard.tsx`
- [ ] 创建 `MobileTaskCard.tsx`
- [ ] 创建 `SwipeableCard.tsx`
- [ ] 创建 `PullToRefresh.tsx`

**文件清单**：
```
apps/frontend/src/components/mobile/
├── MobileBottomNav.tsx
├── MobileOfferCard.tsx
├── MobileTaskCard.tsx
├── SwipeableCard.tsx
└── PullToRefresh.tsx
```

#### Day 3-4: 移动端页面适配
- [ ] Dashboard移动端优化
- [ ] Offers页面移动端卡片视图
- [ ] Tasks页面移动端优化
- [ ] Settings页面移动端优化
- [ ] Landing Page移动端优化

**优化重点**：
- 触摸目标 ≥ 44px
- 手势操作支持
- 底部导航栏
- 下拉刷新

#### Day 5: 移动端测试
- [ ] iOS Safari测试
- [ ] Android Chrome测试
- [ ] 触摸交互测试
- [ ] 性能测试
- [ ] 修复发现的问题

---

## 🟢 Week 5-6: P2 优先级任务

### Week 5: 数据可视化 + 快捷键

#### Day 1-2: 图表组件
- [ ] 创建 `TrendChart.tsx` - 趋势图
- [ ] 创建 `OfferRadarChart.tsx` - 雷达图
- [ ] 创建 `TimeRangeSelector.tsx` - 时间选择器
- [ ] 创建 `ComparisonChart.tsx` - 对比图
- [ ] 优化图表主题和样式

**文件清单**：
```
apps/frontend/src/components/charts/
├── TrendChart.tsx
├── OfferRadarChart.tsx
├── TimeRangeSelector.tsx
├── ComparisonChart.tsx
└── ChartTooltip.tsx
```

#### Day 3: Dashboard图表集成
- [ ] 添加收入趋势图
- [ ] 添加ROAS趋势图
- [ ] 添加Offer性能对比
- [ ] 添加时间范围选择
- [ ] 优化图表加载状态

#### Day 4-5: 快捷键系统
- [ ] 创建 `CommandPalette.tsx`
- [ ] 创建 `KeyboardShortcuts.tsx`
- [ ] 实现全局搜索 (Cmd+K)
- [ ] 实现快速导航
- [ ] 实现快速操作
- [ ] 添加快捷键帮助面板

**快捷键清单**：
```
Cmd/Ctrl + K: 打开命令面板
Cmd/Ctrl + 1-9: 快速导航
Cmd/Ctrl + N: 创建新Offer
Cmd/Ctrl + /: 显示快捷键帮助
Esc: 关闭模态框
```

---

### Week 6: 完善和测试

#### Day 1-2: 空状态和错误处理
- [ ] 创建 `EmptyState.tsx` 组件
- [ ] 创建 `ErrorBoundary.tsx` 组件
- [ ] 创建 `ErrorState.tsx` 组件
- [ ] 为所有页面添加空状态
- [ ] 为所有页面添加错误处理

**文件清单**：
```
apps/frontend/src/components/states/
├── EmptyState.tsx
├── ErrorBoundary.tsx
├── ErrorState.tsx
└── LoadingState.tsx
```

#### Day 3: 主题定制
- [ ] 创建 `ThemeCustomizer.tsx`
- [ ] 实现主题切换逻辑
- [ ] 保存用户主题偏好
- [ ] 添加预设主题
- [ ] 测试主题切换

#### Day 4-5: 全面测试和优化
- [ ] 功能测试
  - [ ] 所有页面功能正常
  - [ ] 所有动画流畅
  - [ ] 所有交互响应
- [ ] 性能测试
  - [ ] Lighthouse测试
  - [ ] Web Vitals检查
  - [ ] 移动端性能
- [ ] 兼容性测试
  - [ ] Chrome/Edge
  - [ ] Firefox
  - [ ] Safari
  - [ ] 移动端浏览器
- [ ] 无障碍性测试
  - [ ] 键盘导航
  - [ ] 屏幕阅读器
  - [ ] 颜色对比度

---

## 📋 每周检查清单

### Week 1 完成标准
- [ ] Landing Page视觉风格统一
- [ ] Features和Pricing页面使用Glassmorphism
- [ ] 所有Marketing页面风格一致
- [ ] 代码review通过
- [ ] 设计review通过

### Week 2 完成标准
- [ ] 深色模式在所有页面完美显示
- [ ] LCP < 2.5s
- [ ] 所有页面有骨架屏
- [ ] 性能测试通过
- [ ] 深色模式测试通过

### Week 3 完成标准
- [ ] 所有动画流畅（60fps）
- [ ] 页面切换有过渡效果
- [ ] 按钮有交互反馈
- [ ] 数字有滚动动画
- [ ] 动画性能测试通过

### Week 4 完成标准
- [ ] 移动端底部导航正常
- [ ] 表格在移动端显示为卡片
- [ ] 触摸交互流畅
- [ ] 手势操作正常
- [ ] 移动端测试通过

### Week 5 完成标准
- [ ] Dashboard有完整图表
- [ ] 图表交互流畅
- [ ] 快捷键系统正常
- [ ] 命令面板功能完整
- [ ] 快捷键测试通过

### Week 6 完成标准
- [ ] 所有空状态友好
- [ ] 错误处理完善
- [ ] 主题切换正常
- [ ] 所有测试通过
- [ ] 准备上线

---

## 🎯 关键里程碑

### Milestone 0: 技术栈升级 (Week 0 结束) 🆕
**目标**：完成核心技术栈升级
**验收标准**：
- Next.js 15 + React 19 运行正常
- Tailwind v4 样式正常
- shadcn/ui 组件可用
- TanStack Query v5 数据获取正常
- 图表和动画库升级完成
- 开发效率提升明显

### Milestone 1: 设计统一 (Week 2 结束)
**目标**：整站视觉风格统一，深色模式完善
**验收标准**：
- Marketing和App页面风格一致
- 深色模式无视觉问题
- 性能指标达标
- shadcn/ui组件全面应用

### Milestone 2: 交互提升 (Week 4 结束)
**目标**：动画流畅，移动端体验优秀
**验收标准**：
- 所有动画60fps
- 移动端使用流畅
- 用户反馈积极
- Tremor图表性能优秀

### Milestone 3: 功能完善 (Week 6 结束)
**目标**：所有优化完成，准备上线
**验收标准**：
- 所有功能正常
- 所有测试通过
- 性能指标优秀
- 技术债务清理完成

---

## 🔧 技术债务处理

### 需要重构的文件
1. `apps/frontend/src/components/landing/HeroSection.tsx` - 完全重写
2. `apps/frontend/src/components/landing/FeaturesSection.tsx` - 使用新组件
3. `apps/frontend/src/components/PricingTable.tsx` - 应用Glassmorphism
4. `apps/frontend/src/app/(site)/components/Footer.tsx` - 现代化设计
5. `apps/frontend/src/components/layout/Navbar.tsx` - 统一风格

### 需要新增的文件
- 20+ 新组件文件
- 10+ 动画组件
- 5+ 图表组件
- 多个工具函数

### 需要更新的配置
- `tailwind.config.js` - 添加新的颜色和动画
- `next.config.js` - 优化配置
- `tsconfig.json` - 确保类型正确

---

## 📊 进度追踪

### 使用工具
- GitHub Projects - 任务管理
- Figma - 设计稿
- Lighthouse - 性能测试
- Storybook - 组件文档

### 每日站会
- 昨天完成了什么
- 今天计划做什么
- 遇到什么阻碍

### 每周回顾
- 完成的任务
- 遇到的问题
- 下周计划
- 风险识别

---

## ⚠️ 风险管理

### 技术风险
1. **性能风险**：动画过多可能影响性能
   - 缓解：使用 `will-change`，优化动画
   
2. **兼容性风险**：某些浏览器不支持新特性
   - 缓解：提供降级方案，polyfill

3. **移动端风险**：触摸交互可能有问题
   - 缓解：充分测试，使用成熟库

### 进度风险
1. **时间风险**：6周时间可能不够
   - 缓解：优先完成P0任务，P2可延后

2. **资源风险**：开发资源可能不足
   - 缓解：合理分配任务，必要时调整范围

### 质量风险
1. **测试风险**：测试不充分
   - 缓解：每周测试，持续集成

2. **用户体验风险**：改动太大用户不适应
   - 缓解：渐进式发布，收集反馈

---

## 🎉 成功标准

### 定量指标
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1
- [ ] Lighthouse分数 > 90
- [ ] 移动端性能分数 > 85

### 定性指标
- [ ] 设计团队认可
- [ ] 产品团队认可
- [ ] 用户反馈积极
- [ ] 无重大bug
- [ ] 代码质量良好

### 业务指标
- [ ] 注册转化率提升 > 10%
- [ ] 用户停留时间提升 > 20%
- [ ] 跳出率降低 > 15%
- [ ] 移动端使用率提升 > 30%

---

## 📝 文档要求

### 需要更新的文档
- [ ] 组件库文档
- [ ] 设计系统文档
- [ ] API文档
- [ ] 用户指南
- [ ] 开发指南

### Storybook文档
- [ ] 所有新组件有示例
- [ ] 所有变体有展示
- [ ] 所有状态有说明
- [ ] 使用指南完整

---

## 🚀 发布计划

### 灰度发布策略
1. **Week 2**: 内部测试环境
2. **Week 4**: 10%用户灰度
3. **Week 5**: 50%用户灰度
4. **Week 6**: 100%全量发布

### 回滚计划
- 保留旧版本代码
- 准备快速回滚脚本
- 监控关键指标
- 24小时值班

---

**总结**：这个路线图提供了详细的6周实施计划，包括每周任务、检查清单、风险管理和成功标准。建议严格按照优先级执行，确保每个里程碑都有可衡量的成果。