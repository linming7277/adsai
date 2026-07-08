# 前端UI/UX全面审查计划

**创建日期**: 2025-10-13
**目标**: 确保所有页面风格统一、符合优秀AI SaaS网站标准

---

## 📋 审查范围

### 页面分类统计

根据页面扫描结果，项目共有**62个页面**，分为以下类别：

#### 1. 公共营销页面 (Site) - 18个
```
- 首页: /(site)/page.tsx
- 功能: /features/page.tsx
- 定价: /pricing/page.tsx
- 案例研究: /case-studies/page.tsx
- 关于: /about/page.tsx
- 联系: /contact/page.tsx
- FAQ: /faq/page.tsx
- 博客: /blog/page.tsx, /blog/[slug]/page.tsx
- 文档: /docs/page.tsx, /docs/[...slug]/page.tsx
- 资源: /resources/page.tsx
- 路线图: /roadmap/page.tsx
- 更新日志: /changelog/page.tsx
- 支持: /support/page.tsx
- 招聘: /careers/page.tsx
- 安全: /security/page.tsx
- 隐私: /privacy/page.tsx
- 条款: /terms/page.tsx
- 风格指南: /style-guide/page.tsx
```

#### 2. 认证页面 (Auth) - 7个
```
- 登录: /auth/sign-in/page.tsx
- 注册: /auth/sign-up/page.tsx
- 验证: /auth/verify/page.tsx
- 确认: /auth/confirm/page.tsx
- 密码重置: /auth/password-reset/page.tsx, /password-reset/page.tsx
- 回调错误: /auth/callback/error/page.tsx
```

#### 3. 用户Dashboard - 4个
```
- Dashboard首页: /dashboard/page.tsx
- Offers管理: /dashboard/offers/page.tsx
- 广告中心: /dashboard/ads-center/page.tsx
- 任务管理: /dashboard/tasks/page.tsx
```

#### 4. 用户设置 - 7个
```
- 个人资料: /settings/profile/page.tsx
- 邮箱设置: /settings/profile/email/page.tsx
- 密码设置: /settings/profile/password/page.tsx
- 双因素认证: /settings/profile/authentication/page.tsx
- 安全设置: /settings/profile/security/page.tsx
- 订阅管理: /settings/subscription/page.tsx
- Token管理: /settings/tokens/page.tsx
```

#### 5. 管理后台 (Admin) - 22个
```
- 管理首页: /manage/page.tsx
- 用户管理: /manage/users/page.tsx, /manage/users/[uid]/page.tsx
- 用户操作模态: /manage/users/@modal/[uid]/ban, delete, reactivate, impersonate
- Offers管理: /manage/offers/page.tsx
- 任务管理: /manage/tasks/page.tsx
- 广告账号: /manage/ads-accounts/page.tsx
- Token管理: /manage/tokens/page.tsx
- 订阅管理: /manage/subscriptions/page.tsx
- 财务管理: /manage/financial/page.tsx
- 审计日志: /manage/audit/page.tsx
- 监控: /manage/monitoring/page.tsx
- 性能: /manage/performance/page.tsx
- 安全: /manage/security/page.tsx
- 通知: /manage/notifications/page.tsx
- 用户支持: /manage/user-support/page.tsx
- 数据导出: /manage/exports/page.tsx
- 功能开关: /manage/feature-flags/page.tsx
```

#### 6. 其他功能页面 - 4个
```
- 用户信息: /userinfo/page.tsx
- 设置错误: /setup-error/page.tsx
- 订阅返回: /settings/subscription/return/page.tsx
- 认证首页: /auth/page.tsx
```

---

## 🎯 审查维度

### 1. Header/Footer一致性

**公共页面 (Site Layout)**
- ✅ 检查项:
  - [ ] 所有公共页面使用相同的Header组件
  - [ ] Logo位置和大小一致
  - [ ] 导航菜单项一致
  - [ ] 登录/注册按钮样式一致
  - [ ] Footer信息和链接完整且一致
  - [ ] 响应式断点行为一致

**Dashboard Layout**
- ✅ 检查项:
  - [ ] 侧边栏在所有Dashboard页面保持一致
  - [ ] 顶部导航栏一致（用户菜单、通知等）
  - [ ] 面包屑导航一致
  - [ ] 页面标题区域格式一致

**Admin Layout**
- ✅ 检查项:
  - [ ] 管理后台侧边栏一致
  - [ ] 权限提示一致
  - [ ] 管理员标识一致

### 2. 排版系统 (Typography)

**字体系列**
- ✅ 检查项:
  - [ ] 主字体: 使用统一的sans-serif字体栈
  - [ ] 代码字体: 使用统一的monospace字体
  - [ ] 字重一致性: 确保只使用定义的字重级别

**文字大小层级**
```
Expected hierarchy (Tailwind classes):
- H1: text-4xl lg:text-5xl (36px/48px)
- H2: text-3xl lg:text-4xl (30px/36px)
- H3: text-2xl lg:text-3xl (24px/30px)
- H4: text-xl lg:text-2xl (20px/24px)
- Body Large: text-lg (18px)
- Body: text-base (16px)
- Body Small: text-sm (14px)
- Caption: text-xs (12px)
```

- ✅ 检查项:
  - [ ] 页面标题使用一致的大小级别
  - [ ] 副标题使用一致的大小级别
  - [ ] 正文使用text-base (16px)
  - [ ] 辅助文字使用text-sm或text-xs
  - [ ] 行高 (line-height) 合理且一致

### 3. 间距系统 (Spacing)

**组件间距**
```
Expected spacing scale (Tailwind):
- 特小: gap-1 (4px)
- 小: gap-2 (8px)
- 常规: gap-4 (16px)
- 中: gap-6 (24px)
- 大: gap-8 (32px)
- 特大: gap-12 (48px)
```

- ✅ 检查项:
  - [ ] 页面内容区域padding一致
  - [ ] 卡片内部padding一致
  - [ ] 表单字段间距一致
  - [ ] 按钮与文字间距合理
  - [ ] section间距统一使用gap-8或gap-12

### 4. 按钮系统 (Buttons)

**按钮变体**
- ✅ 检查项:
  - [ ] Primary按钮: 主操作，高对比度
  - [ ] Secondary按钮: 次要操作
  - [ ] Outline按钮: 低优先级操作
  - [ ] Ghost按钮: 最低优先级
  - [ ] Destructive按钮: 危险操作（删除等）

**按钮大小**
```
Expected sizes:
- sm: h-8 px-3 text-xs
- default: h-10 px-4 text-sm
- lg: h-11 px-8 text-base
- xl: h-12 px-10 text-lg
```

- ✅ 检查项:
  - [ ] CTA按钮使用合适的大小（通常lg或xl）
  - [ ] 表单提交按钮大小一致
  - [ ] 图标按钮大小合理
  - [ ] 按钮圆角一致 (rounded-md)
  - [ ] Hover和Active状态过渡流畅

### 5. 卡片和容器 (Cards & Containers)

- ✅ 检查项:
  - [ ] 卡片边框颜色一致
  - [ ] 卡片阴影一致 (shadow-sm或shadow-md)
  - [ ] 卡片圆角一致 (rounded-lg或rounded-xl)
  - [ ] 卡片内部padding一致 (p-4或p-6)
  - [ ] 卡片hover效果一致

### 6. 表单系统 (Forms)

- ✅ 检查项:
  - [ ] 输入框高度一致 (h-10)
  - [ ] 输入框边框和圆角一致
  - [ ] Label字体大小和字重一致
  - [ ] 错误提示样式一致 (text-destructive)
  - [ ] 帮助文字样式一致 (text-muted-foreground)
  - [ ] 必填标记样式一致

### 7. 颜色系统 (Colors)

**语义色彩**
- ✅ 检查项:
  - [ ] Primary色: 品牌主色，用于主要CTA
  - [ ] Secondary色: 辅助色
  - [ ] Success色: 成功状态（绿色）
  - [ ] Warning色: 警告状态（黄色）
  - [ ] Error/Destructive色: 错误和危险操作（红色）
  - [ ] Muted色: 次要信息
  - [ ] Background层级清晰

### 8. 图标系统 (Icons)

- ✅ 检查项:
  - [ ] 使用统一的图标库 (Heroicons)
  - [ ] 图标大小一致 (通常h-5 w-5或h-6 w-6)
  - [ ] 图标颜色继承文字颜色
  - [ ] 图标与文字对齐方式一致

---

## 🎨 AI SaaS最佳实践对比

### 参考对象
- **Stripe Dashboard**: 极简、专业、高效
- **Vercel Dashboard**: 现代、清晰、快速
- **Linear**: 优雅、流畅、细节完美
- **Notion**: 灵活、直观、信息密度平衡

### 关键设计原则

#### 1. 视觉层次 (Visual Hierarchy)
```
重要性层级:
1. 页面标题和主要数据 (最大、最粗)
2. 关键操作按钮 (Primary CTA)
3. 内容卡片和数据展示
4. 次要操作和辅助信息
5. 描述文字和帮助文本 (最小、最淡)
```

#### 2. 信息密度 (Information Density)
- 避免拥挤: 充足的留白
- 避免稀疏: 有效利用空间
- 黄金比例: 40%内容 + 60%留白

#### 3. 交互反馈 (Interaction Feedback)
- Hover状态: 微妙的背景色变化或阴影提升
- Active状态: 轻微的缩放或位移
- Loading状态: 优雅的骨架屏或加载指示器
- 成功/错误反馈: Toast通知，位置一致

#### 4. 响应式设计 (Responsive Design)
- Mobile First: 先设计移动端
- 断点一致: sm, md, lg, xl, 2xl
- 折叠策略: 侧边栏→汉堡菜单，表格→卡片

#### 5. 可访问性 (Accessibility)
- 对比度: WCAG AA标准 (4.5:1)
- Focus状态: 清晰的focus ring
- 键盘导航: Tab顺序合理
- ARIA标签: 适当使用

---

## 🔍 审查方法

### 第一阶段: 自动化检查
创建审查脚本扫描所有页面组件：

```typescript
// scripts/review/check-ui-consistency.ts
interface UIIssue {
  page: string;
  category: 'typography' | 'spacing' | 'button' | 'color';
  severity: 'high' | 'medium' | 'low';
  description: string;
  location: string;
}

// 检查项:
1. 扫描所有页面文件
2. 检测非标准的className组合
3. 识别孤立的inline styles
4. 检测不一致的间距值
5. 标记未使用设计系统的组件
```

### 第二阶段: 手动视觉审查
使用浏览器开发者工具逐页检查：

**检查清单**:
1. [ ] 在3个断点测试 (mobile, tablet, desktop)
2. [ ] 检查深色模式适配
3. [ ] 测试交互状态 (hover, active, disabled)
4. [ ] 验证加载状态显示
5. [ ] 检查错误状态显示

### 第三阶段: 截图对比
生成所有页面截图，进行一致性对比：

```bash
# 使用Playwright生成截图
node scripts/review/generate-screenshots.mjs
```

---

## 📝 问题记录模板

```markdown
## [页面名称] - UI不一致问题

### 问题类型
- [ ] Header/Footer不一致
- [ ] 字体大小不统一
- [ ] 间距不合理
- [ ] 按钮样式不一致
- [ ] 颜色使用不当
- [ ] 响应式问题
- [ ] 可访问性问题

### 严重程度
- [ ] High: 严重影响用户体验
- [ ] Medium: 明显的不和谐
- [ ] Low: 细节优化

### 问题描述
[详细描述问题]

### 期望表现
[应该如何显示]

### 修复建议
[具体的修复方案]

### 截图
[Before] [After]
```

---

## 🎯 优先级定义

### P0 - 必须立即修复
- Header/Footer完全缺失或严重错误
- 核心功能按钮不可用
- 文字不可读 (对比度太低)
- 严重的响应式问题 (内容溢出)

### P1 - 应该尽快修复
- Header/Footer有但不一致
- 主要页面标题大小不统一
- 关键按钮大小不一致
- 明显的间距问题

### P2 - 可以计划修复
- 细微的字体大小差异
- 非关键页面的小问题
- 辅助文字的样式优化
- 深色模式的细节调整

---

## 📊 成功标准

审查完成后，应达到：

✅ **一致性得分: 95%+**
- 所有公共页面使用统一的Header/Footer
- 95%以上的文字使用定义的大小层级
- 90%以上的间距使用标准化的spacing scale
- 100%的主要按钮使用统一的样式系统

✅ **可访问性得分: AA级**
- 所有文字对比度 ≥ 4.5:1
- 所有交互元素有清晰的focus状态
- 所有图片有alt text
- 所有表单有proper labels

✅ **响应式得分: 优秀**
- 所有页面在mobile/tablet/desktop完美显示
- 没有横向滚动条
- 触摸目标 ≥ 44x44px

✅ **性能得分: 良好**
- 首次渲染时间 < 1.5s
- 交互延迟 < 100ms
- 布局稳定性 CLS < 0.1

---

## 📅 执行计划

### Week 1: 准备和基础审查
- Day 1-2: 创建自动化审查脚本
- Day 3-4: 审查公共页面 (Site)
- Day 5: 审查认证页面 (Auth)

### Week 2: 核心功能审查
- Day 1-2: 审查Dashboard页面
- Day 3-4: 审查设置页面
- Day 5: 修复P0问题

### Week 3: 管理后台和收尾
- Day 1-3: 审查管理后台页面
- Day 4: 修复P1问题
- Day 5: 生成审查报告和截图对比

---

## 🛠️ 工具和资源

### 开发工具
- **Tailwind IntelliSense**: VSCode插件
- **Headwind**: 自动排序Tailwind类名
- **axe DevTools**: 可访问性检查
- **Lighthouse**: 性能和最佳实践审计

### 设计资源
- **Figma文件**: (如果有的话)
- **Tailwind Config**: `tailwind.config.ts`
- **Design Tokens**: `apps/frontend/src/styles/`
- **Component Library**: Shadcn UI文档

### 参考文档
- [Tailwind Typography Plugin](https://tailwindcss.com/docs/typography-plugin)
- [WCAG Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Linear Design System](https://linear.app/method)
- [Vercel Design Guidelines](https://vercel.com/design)

---

**文档维护**: 2025-10-13
**负责人**: Jason / Claude Code
**下次更新**: 开始执行后每周更新
