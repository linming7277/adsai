# 快速参考指南

## 📋 Placeholder修复进度

### ✅ 已完成（5/12 = 42%）

| # | 功能 | 状态 | 文件 | 工作量 |
|---|------|------|------|--------|
| 1 | Create Offer Dialog | ✅ | `OffersPage.tsx` | 5分钟 |
| 2 | Offer Detail Dialog | ✅ | `OfferDetailDialog.tsx` | 2小时 |
| 3 | OffersPage数据加载 | ✅ | `OffersPage.tsx` | 1小时 |
| 4 | TasksPage实现 | ✅ | `TasksPage.tsx`, `TasksTable.tsx` | 2小时 |
| 5 | 订阅管理组件 | ✅ | `SubscriptionManagement.tsx` | 1小时 |

### ⚠️ 待修复（7/12 = 58%）

| # | 功能 | 优先级 | 预估工作量 |
|---|------|--------|-----------|
| 6 | 管理后台编辑功能 | P2 | 6-8小时 |
| 7 | AdsCenterPage功能 | P2 | 4-6小时 |
| 8 | AI评估Modal | P2 | 2-3小时 |
| 9 | 性能指标API | P3 | 2-3小时 |
| 10 | Console API客户端 | P3 | 4-6小时 |
| 11 | 权限检查API | P3 | 2-3小时 |
| 12 | 系统告警和财务 | P3 | 3-4小时 |

---

## 🎯 关键Hooks和API

### Offers相关
```typescript
// 数据加载
import { useOffersPageState } from '~/app/(app)/offers/hooks/useOffersPageState';
import { useOffers } from '~/lib/offers';

// 操作
import { useOfferActions } from '~/lib/offers';
import { useOffersBulkActions } from '~/lib/offers';

// 过滤
import { useOffersFilters } from '~/lib/offers';
```

### Tasks相关
```typescript
// 数据加载
import { useTasks } from '~/lib/tasks';

// 操作
import { useCancelTask, useRetryTask } from '~/lib/tasks';
```

### 订阅相关
```typescript
// 订阅信息
import { useEnhancedSubscription } from '~/core/hooks/use-billing-api';
import { useSubscriptionConfigs } from '~/core/hooks/use-billing-api';

// Token
import { useBillingTokenBalance } from '~/lib/billing/hooks';
```

---

## 📁 项目结构

### 核心目录
```
apps/frontend/src/
├── app/                    # Next.js App Router
│   ├── (app)/             # 应用页面
│   │   ├── offers/        # Offers管理
│   │   └── tasks/         # Tasks管理
│   ├── settings/          # 设置页面
│   └── manage/            # 管理后台
├── components/            # 共享组件
│   ├── offers/           # Offers组件
│   ├── tasks/            # Tasks组件
│   └── settings/         # 设置组件
├── lib/                   # 业务逻辑
│   ├── offers/           # Offers逻辑
│   │   ├── hooks/        # Offers hooks
│   │   └── types.ts      # Offers类型
│   ├── tasks/            # Tasks逻辑
│   │   ├── hooks/        # Tasks hooks
│   │   └── types.ts      # Tasks类型
│   ├── billing/          # 计费逻辑
│   └── api/              # API客户端
└── core/                  # 核心功能
    ├── ui/               # UI组件
    └── hooks/            # 核心hooks
```

---

## 🔧 常用命令

### 开发
```bash
# 启动开发服务器
npm run dev

# 类型检查
npm run type-check

# Lint检查
npm run lint

# 格式化代码
npm run format
```

### 测试
```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- offers

# 测试覆盖率
npm run test:coverage
```

### 构建
```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

---

## 📚 文档索引

### 实现文档
- [Placeholder修复总结](./PLACEHOLDER_FIXES_SUMMARY.md)
- [Placeholder修复完成报告](./PLACEHOLDER_FIXES_COMPLETED.md)
- [最终报告](./PLACEHOLDER_FIXES_FINAL_REPORT.md)
- [TasksPage实现](./TASKS_PAGE_IMPLEMENTATION.md)
- [订阅管理实现](./SUBSCRIPTION_MANAGEMENT_IMPLEMENTATION.md)

### 优化文档
- [代码质量优化建议](./CODE_QUALITY_OPTIMIZATION_RECOMMENDATIONS.md)

### 架构文档
- [Dashboard架构说明](./DASHBOARD_ARCHITECTURE_CLARIFICATION.md)
- [Dashboard系统总结](./DASHBOARD_SYSTEMS_SUMMARY.md)
- [权限系统设计原则](./PERMISSION_SYSTEM_DESIGN_PRINCIPLES.md)

---

## 🎨 UI组件库

### 基础组件
```typescript
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/core/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/core/ui/Tabs';
```

### 布局组件
```typescript
import { DashboardPageLayout } from '~/core/ui/PageLayout';
import { SettingsPageLayout } from '~/core/ui/PageLayout';
```

### 状态组件
```typescript
import { Skeleton } from '~/core/ui/Skeleton';
import { ResourceEmptyState, ResourceErrorState } from '~/core/ui/ResourceState';
```

---

## 🔍 调试技巧

### 查看SWR缓存
```typescript
import { useSWRConfig } from 'swr';

const { cache } = useSWRConfig();
console.log('SWR Cache:', cache);
```

### 查看订阅状态
```typescript
const subscription = useEnhancedSubscription();
console.log('Subscription:', subscription);
```

### 查看Offers状态
```typescript
const offersState = useOffersPageState();
console.log('Offers State:', offersState);
```

---

## ⚡ 性能优化清单

### 已实现
- [x] 智能轮询（只在需要时）
- [x] SWR数据缓存
- [x] 条件渲染
- [x] 懒加载对话框
- [x] 防抖搜索

### 待实现
- [ ] 图片优化
- [ ] 代码分割
- [ ] 虚拟滚动（长列表）
- [ ] Service Worker
- [ ] 预加载关键资源

---

## 🛡️ 安全检查清单

### 已实现
- [x] TypeScript类型检查
- [x] 环境变量保护
- [x] HTTPS通信
- [x] 权限验证

### 待实现
- [ ] XSS防护
- [ ] CSRF保护
- [ ] 内容安全策略
- [ ] 速率限制
- [ ] 输入验证

---

## 📊 监控指标

### 性能指标
- **LCP**: < 2.5s
- **FID**: < 100ms
- **CLS**: < 0.1
- **TTI**: < 3.5s

### 质量指标
- **测试覆盖率**: > 80%
- **TypeScript覆盖**: 100%
- **ESLint警告**: 0
- **代码重复**: < 5%

---

## 🚀 部署流程

### 1. 本地验证
```bash
npm run type-check
npm run lint
npm test
npm run build
```

### 2. 提交代码
```bash
git add .
git commit -m "feat: implement feature"
git push origin main
```

### 3. 自动部署
- Vercel自动检测push
- 运行CI/CD流程
- 部署到生产环境

---

## 🐛 常见问题

### Q: 如何添加新的Offer功能？
A: 
1. 在 `lib/offers/hooks/` 添加hook
2. 在 `components/offers/` 添加组件
3. 在 `OffersPage.tsx` 集成功能

### Q: 如何修改订阅配置？
A: 
1. 更新 `lib/types/subscription.ts` 类型
2. 修改 `useEnhancedSubscription` hook
3. 更新 `SubscriptionManagement` 组件

### Q: 如何添加新的Task类型？
A:
1. 更新 `lib/tasks/types.ts` 中的 `TaskType`
2. 在 `TasksTable.tsx` 添加类型标签
3. 更新翻译文件

---

## 📞 联系方式

### 技术支持
- **文档**: `/docs`
- **Issues**: GitHub Issues
- **讨论**: GitHub Discussions

### 代码审查
- **PR模板**: `.github/pull_request_template.md`
- **审查清单**: 检查类型、测试、文档

---

## 🎯 下一步行动

### 本周
1. 继续修复P2优先级问题
2. 添加单元测试
3. 实施错误监控

### 下周
4. 完成P2问题修复
5. 开始P3问题
6. 优化性能

### 本月
7. 完成所有placeholder修复
8. 提升测试覆盖率
9. 建立监控系统

---

**最后更新**: 2025-10-18  
**版本**: 1.0.0  
**维护者**: Development Team
