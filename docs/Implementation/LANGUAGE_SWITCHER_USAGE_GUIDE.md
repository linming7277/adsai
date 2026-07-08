# Language Switcher 使用指南

**文档版本**: v1.0
**创建日期**: 2025-10-22
**组件**: `LanguageSwitcher.tsx`

---

## 📋 组件概述

`LanguageSwitcher` 是一个功能强大且高度可定制的语言切换组件，提供了三种不同的显示变体和丰富的配置选项。

### 🎯 核心特性

- ✅ **三种显示变体**: 图标、下拉菜单、单选按钮组
- ✅ **国旗显示**: 支持国旗emoji或自定义图标
- ✅ **本地化名称**: 显示语言的原生名称和英文名称
- ✅ **RTL支持**: 支持从右到左的语言
- ✅ **加载状态**: 切换过程中的视觉反馈
- ✅ **无障碍访问**: 完整的aria标签和键盘导航
- ✅ **扩展性**: 易于添加新语言
- ✅ **类型安全**: 完整的TypeScript支持

---

## 🚀 快速开始

### 基础用法

```typescript
import LanguageSwitcher from '~/components/LanguageSwitcher';

function Header() {
  return (
    <div className="flex items-center gap-4">
      <LanguageSwitcher />
    </div>
  );
}
```

### 预设变体

```typescript
import {
  LanguageIconSwitcher,
  LanguageDropdownSwitcher,
  LanguageRadioSwitcher
} from '~/components/LanguageSwitcher';

// 图标版本 - 适合导航栏
<LanguageIconSwitcher />

// 下拉菜单版本 - 适合设置页面
<LanguageDropdownSwitcher />

// 单选按钮组版本 - 适合语言设置页面
<LanguageRadioSwitcher />
```

---

## 🔧 配置选项

### Props 接口

```typescript
interface LanguageSwitcherProps {
  variant?: 'icon' | 'dropdown' | 'radio';  // 显示变体
  showFlags?: boolean;                      // 是否显示国旗
  showNativeNames?: boolean;                // 是否显示原生名称
  className?: string;                       // 自定义CSS类
  onChange?: (locale: string) => unknown;    // 语言切换回调
}
```

### 默认配置

```typescript
const defaultProps = {
  variant: 'icon',
  showFlags: true,
  showNativeNames: true,
  className: '',
  onChange: undefined,
};
```

---

## 🎨 显示变体详解

### 1. 图标变体 (`variant="icon"`)

**适用场景**: 导航栏、工具栏等空间有限的地方

```typescript
<LanguageSwitcher
  variant="icon"
  showFlags={false}  // 不显示国旗，仅显示地球图标
/>
```

**特点**:
- 📱 响应式设计，移动端友好
- 🌐 简洁的地球图标
- 📋 下拉菜单显示语言选项
- ✅ 当前语言高亮显示

### 2. 下拉菜单变体 (`variant="dropdown"`)

**适用场景**: 设置页面、用户菜单等

```typescript
<LanguageSwitcher
  variant="dropdown"
  showFlags={true}
  showNativeNames={true}
/>
```

**特点**:
- 📝 显示完整的语言信息
- 🏳️‍🌈 国旗 + 原生名称 + 英文名称
- 🎯 清晰的当前选择指示
- 📱 响应式标签显示

### 3. 单选按钮组变体 (`variant="radio"`)

**适用场景**: 语言设置页面、首次使用引导

```typescript
<LanguageSwitcher
  variant="radio"
  showFlags={true}
  className="justify-center"
/>
```

**特点**:
- 🎛️ 所有选项同时可见
- 🎯 清晰的选中状态
- 📏 可水平或垂直排列
- ⚡ 快速切换体验

---

## 🌍 语言配置

### 支持的语言

当前支持的语言配置：

```typescript
const languageConfig = {
  'en': {
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    rtl: false,
  },
  'zh-CN': {
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    flag: '🇨🇳',
    rtl: false,
  },
  // 扩展语言配置
  'ja': {
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    rtl: false,
  },
  'ar': {
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    rtl: true,
  },
};
```

### 添加新语言

1. **更新语言配置**:

```typescript
// 在 LanguageSwitcher.tsx 中添加
const languageConfig = {
  // ... 现有语言
  'fr': {
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    rtl: false,
  },
  'de': {
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    rtl: false,
  },
};
```

2. **更新i18n配置**:

```typescript
// apps/frontend/src/i18n/locales.ts
export const SUPPORTED_LOCALES = ['en', 'zh-CN', 'fr', 'de'] as const;
```

3. **添加翻译文件**:

```json
// apps/frontend/public/locales/fr/common.json
{
  "languageSwitcher": {
    "ariaLabel": "Changer de langue",
    "selectLanguage": "Sélectionner la langue",
    "preferences": "Préférences linguistiques",
    "moreLanguagesComing": "D'autres langues arrivent bientôt..."
  }
}
```

---

## 💡 高级用法

### 自定义样式

```typescript
<LanguageSwitcher
  variant="dropdown"
  className="border-2 border-primary rounded-lg"
/>
```

### 语言切换回调

```typescript
<LanguageSwitcher
  onChange={(locale) => {
    // 记录语言切换事件
    analytics.track('language_changed', {
      from: currentLocale,
      to: locale
    });

    // 更新用户偏好
    updateUserPreferences({ language: locale });
  }}
/>
```

### 条件显示配置

```typescript
<LanguageSwitcher
  variant={isMobile ? 'icon' : 'dropdown'}
  showFlags={!isMobile}
  showNativeNames={isDesktop}
/>
```

### 组合使用

```typescript
function LanguageSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3>快速切换</h3>
        <LanguageIconSwitcher />
      </div>

      <div>
        <h3>选择语言</h3>
        <LanguageDropdownSwitcher />
      </div>

      <div>
        <h3>所有可用语言</h3>
        <LanguageRadioSwitcher />
      </div>
    </div>
  );
}
```

---

## 🔧 集成示例

### 在导航栏中使用

```typescript
// apps/frontend/src/components/Navigation.tsx
import LanguageIconSwitcher from '~/components/LanguageSwitcher';

function Navigation() {
  return (
    <nav className="flex items-center justify-between px-4 py-2">
      <Logo />

      <div className="flex items-center gap-4">
        <SearchBar />
        <Notifications />
        <LanguageIconSwitcher />
        <UserMenu />
      </div>
    </nav>
  );
}
```

### 在设置页面使用

```typescript
// apps/frontend/src/app/settings/page.tsx
import LanguageDropdownSwitcher from '~/components/LanguageSwitcher';

export default function SettingsPage() {
  return (
    <SettingsPageLayout>
      <Section>
        <SectionHeader>
          <SectionTitle>语言设置</SectionTitle>
          <SectionDescription>
            选择您的首选语言，界面将自动切换
          </SectionDescription>
        </SectionHeader>

        <SectionBody>
          <div className="max-w-sm">
            <LanguageDropdownSwitcher
              showFlags={true}
              showNativeNames={true}
              onChange={(locale) => {
                toast.success('语言设置已更新');
              }}
            />
          </div>
        </SectionBody>
      </Section>
    </SettingsPageLayout>
  );
}
```

### 在移动端使用

```typescript
// apps/frontend/src/components/MobileNavigation.tsx
import LanguageIconSwitcher from '~/components/LanguageSwitcher';

function MobileNavigation() {
  return (
    <div className="flex items-center justify-around py-2 border-t">
      <MobileNavItem icon={HomeIcon} label="首页" href="/" />
      <MobileNavItem icon={BarChartIcon} label="数据" href="/dashboard" />
      <LanguageIconSwitcher variant="icon" />
      <MobileNavItem icon={UserIcon} label="我的" href="/profile" />
    </div>
  );
}
```

---

## ⚡ 性能优化

### 语言信息缓存

```typescript
// 组件内部已优化语言信息计算
const languageConfig = useMemo(() => {
  // 语言配置被缓存，避免重复计算
}, []);
```

### 防抖切换

```typescript
// 防止快速连续切换
const languageChanged = useCallback(
  async (locale: string) => {
    if (isChanging || locale === currentLanguage) {
      return;
    }

    setIsChanging(true);
    // ... 切换逻辑
  },
  [currentLanguage, isChanging],
);
```

### 懒加载翻译

```typescript
// i18next 已配置懒加载
// 翻译文件按需加载，减少初始包大小
```

---

## 🧪 测试

### 单元测试示例

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import LanguageSwitcher from '~/components/LanguageSwitcher';

describe('LanguageSwitcher', () => {
  it('renders language options', () => {
    render(<LanguageSwitcher variant="radio" />);

    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('简体中文')).toBeInTheDocument();
  });

  it('changes language on selection', async () => {
    const mockOnChange = jest.fn();
    render(<LanguageSwitcher variant="radio" onChange={mockOnChange} />);

    fireEvent.click(screen.getByText('简体中文'));

    expect(mockOnChange).toHaveBeenCalledWith('zh-CN');
  });

  it('shows loading state during language change', async () => {
    render(<LanguageSwitcher variant="icon" />);

    // 模拟语言切换
    fireEvent.click(screen.getByLabelText('Change language'));
    fireEvent.click(screen.getByText('简体中文'));

    // 验证加载状态
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### 视觉回归测试

```typescript
// 使用 Storybook 进行视觉测试
export default {
  title: 'Components/LanguageSwitcher',
  component: LanguageSwitcher,
};

export const IconVariant = {
  args: { variant: 'icon' },
};

export const DropdownVariant = {
  args: { variant: 'dropdown' },
};

export const RadioVariant = {
  args: { variant: 'radio' },
};
```

---

## 🔍 故障排除

### 常见问题

1. **语言切换不生效**
   - 检查 i18n 配置是否正确
   - 确认翻译文件路径正确
   - 验证服务器API端点可用

2. **样式显示异常**
   - 检查 CSS 类名是否正确
   - 确认 Tailwind CSS 配置
   - 验证父容器的样式

3. **无障碍访问问题**
   - 检查 aria 标签是否正确
   - 验证键盘导航功能
   - 确认屏幕阅读器支持

### 调试技巧

```typescript
// 启用调试模式
<LanguageSwitcher
  variant="dropdown"
  onChange={(locale) => {
    console.log('Language changed to:', locale);
    console.log('Current i18n language:', i18n.language);
  }}
/>
```

---

## 📚 相关文档

- [i18next 官方文档](https://www.i18next.com/)
- [React i18next 文档](https://react.i18next.com/)
- [Tailwind CSS 文档](https://tailwindcss.com/)
- [AdsAI 架构文档](./AUTOADS_ARCHITECTURE_OPTIMIZATION_IMPLEMENTATION.md)

---

**文档维护**: 前端团队
**创建日期**: 2025-10-22
**版本**: v1.0
**状态**: ✅ 就绪使用