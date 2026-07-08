# Package G - 可访问性增强计划

> 更新时间：2025-10-10

## 1. 可访问性目标

- **键盘优先**：所有核心页面须支持 `Tab`/快捷键导航与提交。
- **语义清晰**：组件具备语义化标签与 SR（Screen Reader）提示。
- **实时反馈**：操作结果必须通过视觉 + 语音双通道呈现。

## 2. 已落地改动

| 模块 | 改动 | 说明 |
|------|------|------|
| 全局布局 | 新增 `LiveAnnouncer`、`SkipToContent` | 提供 `aria-live` 提示与跳转主内容入口 |
| 表单体系 | 统一接入 `useFormHotkeys`、`SaveShortcutHint` | 支持 `⌘/Ctrl + S` 保存提示，呈现 SR 可读信息 |
| Toast & 状态提示 | `announce()` 工具同步触发 SR 提示 | 成功/失败消息不再仅依赖视觉 Toast |
| Command Palette | 输入框/列表追加 `aria` 属性与帮助说明 | 确保命令搜索、快捷键帮助可被 SR 识别 |

## 3. 监控与验收

- Prometheus 指标新增：`console_web_vitals_total{metric="CLS"}` 等标签，观察可访问性改动对性能影响。
- 前端自测清单更新：加入键盘导航、SR 朗读、Toast 与 Live Region 校验。
- QA 验收：覆盖组织设置、个人资料、Offer 创建、NPS 反馈四条核心链路。

## 4. 后续路线

1. **语义标签补全**：逐步为 Dashboard 指标、表格加入 `aria-describedby` 等描述。
2. **主题对比度优化**：结合 Tailwind tokens 检查夜间模式对比度。
3. **自动化检查**：引入 axe-core / Lighthouse CI 可访问性扫描，纳入 Pipeline。

> 当前阶段已满足 Package G 要求，后续将以“检查清单 + 自动化”形式沉淀，保障新增功能默认符合可访问标准。
