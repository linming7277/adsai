# 页面布局开发指南

> 本指南帮助开发者快速选择和使用正确的页面布局组件

## 🎯 快速开始

### 1. 导入组件

```typescript
import { DashboardPageLayout } from '~/core/ui/PageLayout';
```

### 2. 包裹页面内容

```typescript
export default function MyPage() {
  return (
    <DashboardPageLayout>
      {/* 你的页面内容 */}
    </DashboardPageLayout>
  );
}
```

### 3. 完成！

就这么简单！布局组件会自动处理：
- ✅ 容器宽度限制
- ✅ 响应式padding
- ✅ 内容居中
- ✅ 暗色模式适配

---

## 📋 组件选择表

| 你的页面路径 | 使用组件 | 最大宽度 |
|------------|---------|---------|
| `/dashboard/*` | `DashboardPageLayout` | 1280px |
| `/settings/*` | `SettingsPageLayout` | 896px |
| `/(site)/*` | `MarketingPageLayout` | 1152px |
| `/manage/*` | `AdminPageLayout` | 1280px |
| `/auth/*` | `FullWidthPageLayout` | 无限制 |

---

## 📖 详细说明

### DashboardPageLayout

**用途**: Dashboard相关页面

**特点**:
- 宽度: 1280px (max-w-7xl)
- Padding: 标准 (px-4 py-8)
- 适合: 数据展示、卡片布局

**示例**:
```typescript
import { DashboardPageLayout } from '~/core/ui/PageLayout';

export default function DashboardPage() {
  return (
    <DashboardPageLayout>
      <div className="flex flex-col gap-6">
        <StatsCards />
        <RecentActivity />
      </div>
    </DashboardPageLayout>
  );
}
```

### SettingsPageLayout

**用途**: 设置页面

**特点**:
- 宽度: 896px (max-w-4xl)
- Padding: 标准 (px-4 py-8)
- 适合: 表单、设置项

**为什么窄一些?** 研究表明，表单在600-900px宽度时可读性最佳

**示例**:
```typescript
import { SettingsPageLayout } from '~/core/ui/PageLayout';

export default function ProfileSettings() {
  return (
    <SettingsPageLayout>
      <Section>
        <SectionHeader title="个人信息" />
        <SectionBody>
          <ProfileForm />
        </SectionBody>
      </Section>
    </SettingsPageLayout>
  );
}
```

### MarketingPageLayout

**用途**: 营销/落地页

**特点**:
- 宽度: 1152px (max-w-6xl)，可自定义
- Padding: 较大 (px-6 py-12)
- 适合: 产品介绍、博客、文档

**示例**:
```typescript
import { MarketingPageLayout } from '~/core/ui/PageLayout';

export default function AboutPage() {
  return (
    <MarketingPageLayout maxWidth="6xl">
      <h1 className="text-4xl font-bold">About Us</h1>
      <p className="mt-4 text-lg">...</p>
    </MarketingPageLayout>
  );
}
```

### AdminPageLayout

**用途**: 管理员后台页面

**特点**:
- 宽度: 1280px (max-w-7xl)
- Padding: 标准 (px-4 py-8)
- 适合: 数据表格、用户管理

**示例**:
```typescript
import { AdminPageLayout } from '~/core/ui/PageLayout';

export default function UsersManagePage() {
  return (
    <AdminPageLayout>
      <DataTable
        columns={userColumns}
        data={users}
      />
    </AdminPageLayout>
  );
}
```

### FullWidthPageLayout

**用途**: 需要全屏的页面

**特点**:
- 宽度: 无限制
- 可选垂直居中
- 最小padding

**示例**:
```typescript
import { FullWidthPageLayout } from '~/core/ui/PageLayout';

export default function SignInPage() {
  return (
    <FullWidthPageLayout centered>
      <div className="w-full max-w-md">
        <SignInForm />
      </div>
    </FullWidthPageLayout>
  );
}
```

---

## 🔧 自定义用法

如果标准组件不满足需求，使用 `PageContainer`:

```typescript
import { PageContainer } from '~/core/ui/PageLayout';

export default function CustomPage() {
  return (
    <PageContainer
      maxWidth="5xl"     // 自定义宽度
      padding="lg"       // sm | md | lg
      className="bg-muted" // 额外样式
    >
      {content}
    </PageContainer>
  );
}
```

**可用的maxWidth值**:
- `sm` - 384px
- `md` - 448px
- `lg` - 512px
- `xl` - 576px
- `2xl` - 672px
- `3xl` - 768px
- `4xl` - 896px ⭐ Settings
- `5xl` - 1024px
- `6xl` - 1152px ⭐ Marketing
- `7xl` - 1280px ⭐ Dashboard/Admin
- `full` - 无限制

---

## 📝 迁移指南

### 迁移检查清单

- [ ] 移除手动的 `mx-auto`
- [ ] 移除手动的 `max-w-*`
- [ ] 移除手动的 `px-*` `py-*`
- [ ] 使用合适的 PageLayout 组件
- [ ] 运行 `npm run check:ui` 验证

### Before & After 对比

#### ❌ Before (不推荐)

```typescript
export default function Page() {
  return (
    <PageBody>
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-6">
          {content}
        </div>
      </div>
    </PageBody>
  );
}
```

**问题**:
- 嵌套过多
- 重复的类名
- 不易维护

#### ✅ After (推荐)

```typescript
import { DashboardPageLayout } from '~/core/ui/PageLayout';

export default function Page() {
  return (
    <DashboardPageLayout>
      <div className="flex flex-col gap-6">
        {content}
      </div>
    </DashboardPageLayout>
  );
}
```

**优点**:
- 简洁明了
- 自动一致性
- 易于维护

---

## ⚠️ 常见错误

### 错误1: 嵌套使用布局组件

```typescript
// ❌ 错误
<PageBody>
  <DashboardPageLayout>
    {content}
  </DashboardPageLayout>
</PageBody>
```

```typescript
// ✅ 正确
<DashboardPageLayout>
  {content}
</DashboardPageLayout>
```

### 错误2: 重复添加padding

```typescript
// ❌ 错误 - PageLayout已经有padding了
<DashboardPageLayout>
  <div className="px-4 py-8">
    {content}
  </div>
</DashboardPageLayout>
```

```typescript
// ✅ 正确
<DashboardPageLayout>
  <div className="flex flex-col gap-6">
    {content}
  </div>
</DashboardPageLayout>
```

### 错误3: 不使用语义化组件

```typescript
// ❌ 错误 - 难以理解页面类型
<PageContainer maxWidth="7xl">
  {dashboardContent}
</PageContainer>
```

```typescript
// ✅ 正确 - 一眼就知道是Dashboard页面
<DashboardPageLayout>
  {dashboardContent}
</DashboardPageLayout>
```

---

## 🎨 样式指南

### 推荐的间距值

使用 Tailwind 的间距 scale (4px 倍数):

```typescript
// ✅ 推荐
<div className="flex flex-col gap-4">  // 16px
<div className="flex flex-col gap-6">  // 24px
<div className="flex flex-col gap-8">  // 32px

// ❌ 避免
<div className="flex flex-col gap-5">  // 20px (不是4的倍数)
<div className="flex flex-col gap-[17px]"> // 魔法数字
```

### 推荐的内容结构

```typescript
<DashboardPageLayout>
  <div className="flex flex-col gap-6">
    {/* Section 1 */}
    <div>...</div>

    {/* Section 2 */}
    <div>...</div>

    {/* Section 3 */}
    <div>...</div>
  </div>
</DashboardPageLayout>
```

---

## 🧪 测试和验证

### 运行UI一致性检查

```bash
npm run check:ui
```

这会检查:
- ✅ 是否使用了标准布局组件
- ✅ 是否有重复的padding/max-width
- ✅ 是否有内容贴边

### 手动检查

1. **桌面端** (1920x1080)
   - 内容应该居中
   - 左右有适当的空白
   - 阅读宽度舒适

2. **平板** (768x1024)
   - padding 自动调整为 px-6
   - 内容不贴边

3. **手机** (375x667)
   - padding 自动调整为 px-4
   - 内容完全可见

---

## 💡 最佳实践

### 1. 选择合适的布局

```typescript
// Dashboard - 需要展示多列数据
<DashboardPageLayout> ✅

// Settings - 表单为主
<SettingsPageLayout> ✅

// 博客文章 - 阅读体验重要
<MarketingPageLayout maxWidth="4xl"> ✅
```

### 2. 保持结构简洁

```typescript
// ✅ 好 - 扁平结构
<DashboardPageLayout>
  <StatsGrid />
  <RecentActivity />
</DashboardPageLayout>

// ❌ 差 - 过度嵌套
<DashboardPageLayout>
  <div>
    <div>
      <div>
        <StatsGrid />
      </div>
    </div>
  </div>
</DashboardPageLayout>
```

### 3. 使用语义化间距

```typescript
// ✅ 好 - 清晰的视觉层次
<div className="flex flex-col gap-8">  // 组件间
  <Card>
    <CardHeader />
    <CardContent className="space-y-4" />  // 内容间
  </Card>
</div>
```

---

## 🔗 相关资源

- [完整分析报告](./PAGE_LAYOUT_ANALYSIS.md)
- [UI一致性检查脚本](../../scripts/review/check-ui-consistency.mjs)
- [Tailwind CSS文档](https://tailwindcss.com/docs)
- [Next.js Layouts文档](https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts)

---

## ❓ FAQ

### Q: 我的页面需要特殊宽度怎么办？

A: 使用 `PageContainer` 自定义:

```typescript
<PageContainer maxWidth="5xl">
  {content}
</PageContainer>
```

### Q: 我需要更大/更小的padding怎么办？

A: 使用padding prop:

```typescript
<DashboardPageLayout className="py-12">  // 覆盖py-8
  {content}
</DashboardPageLayout>
```

或者使用PageContainer:

```typescript
<PageContainer maxWidth="7xl" padding="lg">
  {content}
</PageContainer>
```

### Q: 为什么Settings页面比Dashboard窄？

A: 表单类页面在600-900px宽度时可读性最佳，这是UX设计的最佳实践。参考:
- Google Material Design
- Apple Human Interface Guidelines
- Linear App

### Q: 我可以不用这些组件吗？

A: 可以，但不推荐。使用标准组件的好处:
- ✅ 自动一致性
- ✅ 响应式设计
- ✅ 易于维护
- ✅ 减少bug

如果标准组件不满足需求，请先讨论，可能需要添加新的标准组件。

### Q: 如何在layout.tsx中使用？

A: 在layout.tsx中包裹children:

```typescript
// app/dashboard/layout.tsx
import { DashboardPageLayout } from '~/core/ui/PageLayout';

export default function DashboardLayout({ children }) {
  return (
    <AppScopeLayout>
      {/* DashboardPageLayout会应用于所有子页面 */}
      {children}
    </AppScopeLayout>
  );
}
```

注意: 如果layout中已经应用了PageLayout，页面中就不要再包一层。

---

**最后更新**: 2025-10-13
**维护者**: Frontend Team
