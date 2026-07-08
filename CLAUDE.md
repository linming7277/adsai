- docs/SupabaseGo/MustKnowV6.md
- docs/monorepo-build-best-practices.md

  # i18n 强制规范
  所有用户可见文本必须使用 react-i18next 的 t() 函数，禁止任何中英文硬编码字符串。
  编写代码时主动提示需要添加的翻译键，发现硬编码立即提醒修正。

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

# page-layout-standards
IMPORTANT: All pages MUST use standardized PageLayout components for consistency.

## Layout Component Selection
- Dashboard pages (`/dashboard/*`) → `DashboardPageLayout` (max-w-7xl, 1280px)
- Settings pages (`/settings/*`) → `SettingsPageLayout` (max-w-4xl, 896px)
- Marketing pages (`/(site)/*`) → `MarketingPageLayout` (max-w-6xl, 1152px)
- Admin pages (`/manage/*`) → `AdminPageLayout` (max-w-7xl, 1280px)
- Auth pages (`/auth/*`) → `FullWidthPageLayout` (no max-width)
- Custom needs → `PageContainer` with explicit maxWidth prop

## Usage Rules
1. ALWAYS import from: `~/core/ui/PageLayout`
2. NEVER manually add: `max-w-*`, `mx-auto`, `px-*`, `py-*` classes
3. DO use `Section`, `SectionHeader`, `SectionBody` for content cards
4. DO NOT nest PageLayout components or wrap with extra divs

## Example
```typescript
import { DashboardPageLayout } from '~/core/ui/PageLayout';

export default function MyPage() {
  return (
    <DashboardPageLayout>
      <div className="flex flex-col gap-6">
        {content}
      </div>
    </DashboardPageLayout>
  );
}
```

See docs/TestAll/PAGE_LAYOUT_GUIDE.md for complete documentation.
