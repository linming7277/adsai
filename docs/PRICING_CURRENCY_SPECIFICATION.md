# 定价货币符号使用规范

**文档版本**: v1.0
**更新日期**: 2025-10-14

---

## 💰 货币符号使用规则

### 核心原则

**中文内容使用人民币符号 `¥`，英文内容使用美元符号 `$`，但金额数字保持一致。**

### 定价方案

| 套餐 | 中文显示 | 英文显示 | 月付（中文） | 月付（英文） | 年付（中文） | 年付（英文） |
|------|---------|---------|------------|------------|------------|------------|
| Starter | ¥298/月 | $298/mo | ¥298 | $298 | ¥149 | $149 |
| Professional | ¥998/月 | $998/mo | ¥998 | $998 | ¥499 | $499 |
| Elite | ¥2,998/月 | $2,998/mo | ¥2,998 | $2,998 | ¥1,499 | $1,499 |

### 年付优惠

- **中文**: 年付享5折优惠（买6个月送6个月）
- **英文**: 50% off annual billing (buy 6 months, get 6 months free)

---

## 📁 文件检查清单

### ✅ 已验证正确的文件

#### 中文翻译文件（使用 ¥）
- [x] `apps/frontend/public/locales/zh-CN/marketing.json`
  - `pricing.plans.starter.price`: "¥298"
  - `pricing.plans.starter.priceAnnual`: "¥149"
  - `pricing.plans.professional.price`: "¥998"
  - `pricing.plans.professional.priceAnnual`: "¥499"
  - `pricing.plans.elite.price`: "¥2,998"
  - `pricing.plans.elite.priceAnnual`: "¥1,499"

- [x] `apps/frontend/public/locales/zh-CN/seo.json`
  - `pricing.description`: 包含 "¥298/月"、"¥998/月"、"¥2,998/月"

#### 英文翻译文件（使用 $）
- [x] `apps/frontend/public/locales/en/marketing.json`
  - `pricing.plans.starter.price`: "$298"
  - `pricing.plans.starter.priceAnnual`: "$149"
  - `pricing.plans.professional.price`: "$998"
  - `pricing.plans.professional.priceAnnual`: "$499"
  - `pricing.plans.elite.price`: "$2,998"
  - `pricing.plans.elite.priceAnnual`: "$1,499"

- [x] `apps/frontend/public/locales/en/seo.json`
  - `pricing.description`: 包含 "$298/mo"、"$998/mo"、"$2,998/mo"

#### 博客文章（使用 ¥，中文内容）
- [x] `apps/frontend/content/blog/brand-bidding-complete-guide.md`
  - 使用 "¥298/月"、"¥998/月"、"¥2,998/月"（正确）

- [x] `apps/frontend/content/blog/brand-bidding-case-studies.md`
  - 使用 "¥298"、"¥998"、"¥2,998"（正确）

- [x] `apps/frontend/content/blog/brand-bidding-common-mistakes.md`
  - 使用 "¥298"、"¥998"、"¥2,998"（正确）

---

## 🎯 使用场景说明

### 1. 中文页面/内容

**何时使用**:
- 中文翻译文件（zh-CN/*.json）
- 中文博客文章（content/blog/*.md，中文内容）
- 中文文档和报告

**货币符号**: `¥`

**示例**:
```json
{
  "price": "¥298",
  "priceAnnual": "¥149",
  "description": "Starter 套餐 ¥298/月（年付 ¥149/月）"
}
```

### 2. 英文页面/内容

**何时使用**:
- 英文翻译文件（en/*.json）
- 英文博客文章（content/blog/en/*.md，如果创建）
- 英文文档和报告

**货币符号**: `$`

**示例**:
```json
{
  "price": "$298",
  "priceAnnual": "$149",
  "description": "Starter plan $298/mo (annual $149/mo)"
}
```

---

## 💡 重要说明

### 为什么金额数字相同？

虽然中文使用 `¥` 和英文使用 `$` 符号不同，但我们**故意保持金额数字一致**（298/998/2998），原因：

1. **简化定价策略**: 避免汇率波动带来的频繁调价
2. **统一用户认知**: 全球用户看到相同的数字，便于记忆和传播
3. **降低维护成本**: 不需要根据汇率实时更新价格

### 实际收费

- **中国用户**: 实际收费 ¥298/¥998/¥2,998（人民币）
- **国际用户**: 实际收费 $298/$998/$2,998（美元）
- **汇率处理**: 在支付系统（Stripe）中按实际货币处理

### 显示逻辑

```typescript
// 伪代码示例
const currency = locale === 'zh-CN' ? '¥' : '$';
const price = locale === 'zh-CN' ? '298' : '298'; // 金额相同
const displayPrice = `${currency}${price}`;

// 输出:
// zh-CN: ¥298
// en: $298
```

---

## 🔍 验证方法

### 手动检查

1. **切换到中文**
   - 访问 `/pricing`
   - 确认显示 "¥298"、"¥998"、"¥2,998"

2. **切换到英文**
   - 访问 `/pricing`
   - 确认显示 "$298"、"$998"、"$2,998"

3. **检查博客**
   - 中文博客应显示 "¥298"
   - 英文博客（如果有）应显示 "$298"

### 自动化检查

```bash
# 检查中文翻译文件（应该有 ¥）
grep -r "\"price\":" apps/frontend/public/locales/zh-CN/marketing.json

# 检查英文翻译文件（应该有 $）
grep -r "\"price\":" apps/frontend/public/locales/en/marketing.json

# 检查中文博客（应该有 ¥）
grep -r "¥298\|¥998\|¥2,998" apps/frontend/content/blog/*.md

# 检查是否有错误使用 $ 在中文文件或 ¥ 在英文文件
grep -r "\$298\|\$998\|\$2,998" apps/frontend/public/locales/zh-CN/*.json
grep -r "¥298\|¥998\|¥2,998" apps/frontend/public/locales/en/*.json
```

---

## ✅ 验证结果

### 当前状态（2025-10-14）

- [x] 中文翻译文件：100% 使用 `¥` ✅
- [x] 英文翻译文件：100% 使用 `$` ✅
- [x] 中文博客文章：100% 使用 `¥` ✅
- [x] 金额数字一致：298/998/2998 ✅
- [x] 年付优惠一致：50% off / 5折 ✅

**结论**: 所有文件的货币符号使用正确，无需修改。

---

## 📝 未来扩展

### 如果创建英文博客

当创建英文博客文章时（例如 `content/blog/en/brand-bidding-complete-guide.md`），需要：

1. **翻译内容**：将中文内容翻译为英文
2. **替换货币符号**：将所有 `¥` 替换为 `$`
3. **保持金额数字**：298/998/2998 不变
4. **更新 SEO**：使用英文 SEO 关键词

**示例对比**:

| 中文 | 英文 |
|------|------|
| Starter 套餐 ¥298/月 | Starter plan $298/mo |
| Professional 套餐 ¥998/月（推荐） | Professional plan $998/mo (recommended) |
| Elite 套餐 ¥2,998/月 | Elite plan $2,998/mo |

---

## 🎓 培训要点

### 新成员必读

1. **中文 = ¥，英文 = $，金额相同**
2. **不要进行汇率转换**
3. **所有价格必须通过 i18n 翻译文件**
4. **禁止硬编码价格字符串**

### 常见错误

❌ **错误示例**:
```typescript
// 硬编码价格
const price = "¥298";

// 使用汇率转换
const priceUSD = "¥298 (约 $42)";
```

✅ **正确示例**:
```typescript
// 使用 i18n
const price = t('pricing.plans.starter.price'); // 自动根据语言显示 ¥298 或 $298
```

---

## 📞 问题反馈

如发现任何货币符号使用错误，请：

1. 检查本文档的验证清单
2. 运行自动化检查脚本
3. 提交 Issue 到 GitHub
4. 联系开发团队：support@adsai.dev

---

**文档维护人**: Claude Code
**最后验证**: 2025-10-14
**状态**: ✅ 全部验证通过
