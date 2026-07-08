# AutoAds SSOT 最终确认

**日期**: 2025-10-17
**状态**: ✅ 已确认
**版本**: Final

---

## ✅ SSOT 确认

### 核心文档（当前实际版本）

1. **MustKnowV7.md** - 架构设计、技术栈、项目配置
   - 路径: `docs/BasicPrinciples/MustKnowV7.md`
   - 用途: 技术视角的SSOT

2. **CoreBusinessFeatures_V2.md** - 当前实际业务功能
   - 路径: `docs/BasicPrinciples/CoreBusinessFeatures_V2.md`
   - 用途: 业务视角的SSOT
   - 特点: 只包含已实现功能，不含规划

---

## 🎯 产品核心定义

### 产品定位
**AutoAds**: Affiliate营销领域的AI驱动自动化平台

### 三大核心功能（已实现）

#### 1. Offer评估 (siterank服务)
- 基础评估 (1 token)
- AI增强评估 (3 tokens)
- A/B/C/D/F五级评分
- 评估时间: 11-16秒

#### 2. 真实补点击 (batchopen服务)
- URL访问任务配置
- 后台异步执行
- 浏览器自动化
- 结果统计

#### 3. Ads中心 (adscenter服务)
- Google Ads OAuth授权
- 多账号管理
- 数据同步
- Dashboard展示

---

## 💰 套餐定义（当前实际）

基于代码: `apps/frontend/src/configuration.ts`

### Starter套餐
- 价格: ¥298/月 (年付¥1788)
- Token: 10,000/月
- 功能: 基础评估

### Professional套餐 (推荐)
- 价格: ¥998/月 (年付¥5988)
- Token: 更多
- 功能: 基础 + AI评估

### Elite套餐
- 价格: ¥2998/月 (年付¥17988)
- Token: 大量
- 功能: 全部功能 + 无限Offer

### 权限矩阵

| 功能 | Starter | Professional | Elite |
|------|---------|--------------|-------|
| 基础评估 | ✓ | ✓ | ✓ |
| AI评估 | ✗ | ✓ | ✓ |
| 补点击 | ✓ | ✓ | ✓ |
| Ads中心 | ✗ | ✓ | ✓ |
| 无限Offer | ✗ | ✗ | ✓ |

---

## ❌ 已移除的过时内容

### 1. BatchOpen三种执行模式
- **原因**: 未在当前系统实现
- **来源**: V5重构计划
- **状态**: 规划功能，非实际功能

### 2. 工作流自动化
- **原因**: 未在当前系统实现
- **来源**: V2重构计划
- **状态**: 规划功能，非实际功能

### 3. 智能Offer中心
- **原因**: 未在当前系统实现
- **来源**: V2重构计划
- **状态**: 规划功能，非实际功能
- **说明**: 当前只有基础的Offer管理

### 4. 过时的套餐定义
- **原因**: 与代码实际定义不符
- **来源**: 历史文档
- **状态**: 已更新为代码实际定义

### 5. 成功指标
- **原因**: 非核心功能描述
- **来源**: 产品规划文档
- **状态**: 移至产品规划文档

---

## 📚 文档状态

### ✅ 有效文档

1. **MustKnowV7.md** - 技术SSOT
2. **CoreBusinessFeatures_V2.md** - 业务SSOT
3. **COMPLETE-OPTIMIZATION-PLAN.md** - 架构优化计划
4. **E2E_TEST_SOLUTION_SUMMARY.md** - 测试方案
5. **SUPERCLOUD_OPTIMIZATION_DIRECTIVES.md** - SuperClaude优化指令

### ⚠️ 已标记为过时

1. **CoreBusinessFeatures.md** (V1.0) - 包含规划功能
2. **BUSINESS_FEATURES_EXTRACTION.md** - 包含规划功能
3. **SSOT_CONSOLIDATION_SUMMARY.md** - 包含规划功能

### 📋 建议归档

1. **prd-new-V5.md** - GoFly重构计划
2. **productrefactoring-v2/** - V2重构计划
3. 其他历史规划文档

---

## 🔍 验证方法

### 功能验证
```bash
# 1. 检查实际代码
grep -r "功能关键词" apps/frontend/src services/

# 2. 检查配置
cat apps/frontend/src/configuration.ts

# 3. 检查类型定义
cat apps/frontend/src/lib/types/subscription.ts
cat apps/frontend/src/lib/hooks/useSubscription.ts
```

### 套餐验证
```bash
# 检查套餐定义
grep -A 20 "products:" apps/frontend/src/configuration.ts

# 检查权限逻辑
grep -A 10 "canUseAI\|hasUnlimitedOffers" apps/frontend/src/lib/hooks/useSubscription.ts
```

---

## 📋 维护原则

### 文档更新规则

1. **Ground Truth原则**: 
   - 代码是唯一真实来源
   - 文档必须基于实际代码
   - 发现不一致立即更新

2. **去除规划内容**:
   - 不在文档中描述未实现功能
   - 规划功能单独文档管理
   - 明确标注文档类型（实际/规划）

3. **及时更新**:
   - 代码变更后立即更新文档
   - 每月审查文档准确性
   - 重大功能变更后全面审查

4. **简洁明确**:
   - 只描述当前实际功能
   - 避免历史信息堆积
   - 保持文档精简

---

## 🎯 关键原则

### 1. 代码即真相
- 所有功能描述必须基于实际代码
- 不基于文档或记忆描述功能
- 发现冲突以代码为准

### 2. 实际优于规划
- 核心文档只描述已实现功能
- 规划功能单独管理
- 明确区分实际和规划

### 3. 简洁优于完整
- 去除过时内容
- 不保留历史记录
- 保持文档精简

---

## ✅ 确认清单

- [x] 确认SSOT文档（MustKnowV7.md + CoreBusinessFeatures_V2.md）
- [x] 移除BatchOpen三种模式描述
- [x] 移除工作流自动化描述
- [x] 移除智能Offer中心描述
- [x] 更新套餐定义为代码实际定义
- [x] 移除成功指标
- [x] 标记过时文档
- [x] 创建验证方法
- [x] 建立维护原则

---

## 🔗 相关文档

**当前有效**:
- `docs/BasicPrinciples/MustKnowV7.md`
- `docs/BasicPrinciples/CoreBusinessFeatures_V2.md`
- `docs/ArchitectureOpV1/COMPLETE-OPTIMIZATION-PLAN.md`
- `docs/TestAll/E2E_TEST_SOLUTION_SUMMARY.md`
- `docs/SuperClaude/SUPERCLOUD_OPTIMIZATION_DIRECTIVES.md`

**已过时**:
- `docs/BasicPrinciples/CoreBusinessFeatures.md` (V1.0)
- `docs/SuperClaude/BUSINESS_FEATURES_EXTRACTION.md`
- `docs/SuperClaude/SSOT_CONSOLIDATION_SUMMARY.md`

**建议归档**:
- `docs/prd-new-V5.md`
- `docs/productrefactoring-v2/`

---

**确认人**: Kiro AI Assistant
**确认日期**: 2025-10-17
**状态**: ✅ 已完成
