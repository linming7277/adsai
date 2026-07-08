# AutoAds 设计令牌总览（2025-10）

本节记录 `apps/frontend/src/styles/design-tokens.css` 中维护的核心 Design Token，便于 Storybook、Figma 与代码的三方对齐。Token 覆盖颜色、排版、间距、圆角、阴影等维度。

## 1. 颜色系统

| 分组 | Token | 说明 |
| --- | --- | --- |
| 主色 | `--color-primary-50` ~ `--color-primary-900` | Brand 主色（蓝色阶），用于按钮、链接等交互元素 |
| 成功 | `--color-success-50` ~ `--color-success-900` | 成功与正向提示 |
| 警告 | `--color-warning-50` ~ `--color-warning-900` | 需要关注的提示 |
| 错误 | `--color-error-50` ~ `--color-error-900` | 错误与阻塞信息 |
| 中性色 | `--color-gray-50` ~ `--color-gray-900` | 背景、边框及文字基色 |
| 表面色 | `--surface-*` | 默认、悬浮、蒙层等容器背景 |

## 2. 排版与间距

- 字体：`--font-sans`（界面）、`--font-mono`（代码/数值）
- 字号：`--text-xs` 至 `--text-5xl`
- 字重：`--font-normal` / `--font-medium` / `--font-semibold` / `--font-bold`
- 行高与字距：`--leading-*`、`--tracking-*`
- 间距刻度：`--spacing-xs` ~ `--spacing-3xl`

## 3. 圆角与阴影

- 圆角：`--radius-xs` / `--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-xl` / `--radius-pill`
- 阴影：`--shadow-sm` / `--shadow-md` / `--shadow-lg` / `--shadow-xl` / `--shadow-2xl`

## 4. 布局与层级

- 容器：`--container-max-width`、`--container-fluid-max-width`、`--container-padding`
- 栅格：`--grid-column-gap`、`--grid-row-gap`、`--grid-max-columns`
- Z 轴：`--z-base`、`--z-sticky`、`--z-dropdown`、`--z-overlay`、`--z-modal`、`--z-toast`

## 5. 动效

- 时长：`--transition-duration-fast` / `base` / `slow` / `delayed`
- 缓动：`--transition-easing-standard` / `--transition-easing-emphasized`

> 提示：Storybook 预览已默认载入 `design-tokens.css` 与 `animations.css`，确保颜色/动效在文档与组件示例中一致。

