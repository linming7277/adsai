# AdsAI 路由SEO迁移指南

## 📋 概述

本指南详细说明AdsAI平台路由变更时的SEO最佳实践，确保搜索引擎排名和用户体验不受影响。

## 🚀 新产品SEO策略

由于AdsAI是新产品而非迁移现有网站，SEO重点应放在：

### 1. 基础SEO建立
- 实施完整的技术SEO基础
- 创建高质量的网站架构
- 建立品牌搜索存在

### 2. 内容营销策略
- 创建有价值的内容资源
- 建立权威性和专业性
- 吸引目标用户群体

## 🌐 国际化SEO策略

### Cookie-Based语言检测

AdsAI使用基于Cookie的语言检测，而非URL前缀：

```typescript
// 语言检测实现 (i18n.server.ts)
export async function initializeServerI18n(locale?: string) {
  const cookie = cookies().get('NEXT_LOCALE');
  const language = locale || cookie?.value || getPreferredLanguage();

  return createInstance(language, i18nResources);
}
```

### SEO最佳实践

#### 1. HTML lang属性
```html
<html lang="zh-CN">
<html lang="en">
```

#### 2. 内容本地化
- 完整的中文和英文内容
- 地区特定的联系方式和定价
- 本地化的用户体验设计

#### 3. 地理定位信号
- 地区特定的联系信息
- 本地化的客服时间
- 地理相关的关键词优化

## 📝 页面SEO实施指南

### 1. 动态元数据生成

每个页面都应实现 `generateMetadata()`：

```typescript
export async function generateMetadata(): Promise<Metadata> {
  const i18n = await initializeServerI18n(getLanguageCookie());
  const t = i18n.getFixedT(null, ['seo']);
  const baseUrl = configuration.site.siteUrl as string;

  return {
    title: t('page.title'),
    description: t('page.description'),
    keywords: t('page.keywords'),
    authors: [{ name: 'AdsAI Team' }],
    creator: 'AdsAI',
    publisher: 'AdsAI',
    openGraph: {
      type: 'website',
      locale: i18n.language,
      url: `${baseUrl}${pathname}`,
      title: t('page.title'),
      description: t('page.description'),
      siteName: configuration.site.siteName,
      images: [
        {
          url: `${baseUrl}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: t('page.ogImageAlt'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: configuration.site.twitterHandle,
      creator: configuration.site.twitterHandle,
      title: t('page.title'),
      description: t('page.description'),
      images: [`${baseUrl}/twitter-image.jpg`],
    },
    alternates: {
      canonical: `${baseUrl}${pathname}`,
    },
  };
}
```

### 2. 结构化数据实施

#### Organization Schema
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://example.com#organization",
  "name": "AdsAI",
  "url": "https://example.com",
  "logo": {
    "@type": "ImageObject",
    "url": "https://example.com/logo.png",
    "width": 512,
    "height": 512
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "email": "support@adsai.dev",
    "contactType": "customer support",
    "availableLanguage": ["en", "zh-CN"]
  },
  "areaServed": [
    {
      "@type": "Country",
      "name": "United States"
    },
    {
      "@type": "Country",
      "name": "China"
    }
  ]
}
```

#### Service Schema
```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "https://example.com#service",
  "name": "AI Landing Page Evaluation",
  "description": "AI-powered analysis of landing pages for accurate profitability prediction",
  "provider": {
    "@type": "Organization",
    "@id": "https://example.com#organization"
  },
  "serviceType": "Marketing Analysis Service",
  "areaServed": "Worldwide",
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "AdsAI Services",
    "itemListElement": [
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "12-Dimension AI Evaluation"
        }
      }
    ]
  }
}
```

### 3. 面包屑导航结构化数据

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "首页",
      "item": "https://example.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "功能特性",
      "item": "https://example.com/features"
    }
  ]
}
```

## 🔧 技术实施步骤

### 1. Sitemap配置

```typescript
// sitemap.ts
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = configuration.site.siteUrl as string;

  const marketingPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/features`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // ... 其他页面
  ];

  return marketingPages;
}
```

### 2. Robots.txt配置

```typescript
// robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/auth/', '/api/', '/manage/', '/dashboard/', '/settings/']
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

### 3. 图片SEO优化

#### SEO友好的图片配置
```typescript
// 优化的Image组件
<Image
  src="/path/to/image.jpg"
  alt="描述性的alt文本"
  width={800}
  height={600}
  priority={isAboveFold}
  sizes="(max-width: 768px) 100vw, 50vw"
  quality={85}
/>
```

## 📊 内容SEO策略

### 1. 页面内容结构

#### 首页内容层次
```html
<h1>AdsAI - AI落地页评估平台</h1>
<h2>核心功能</h2>
<h3>12维度AI分析</h3>
<h3>真实点击模拟</h3>
<h3>全球代理IP测试</h3>

<h2>客户成功案例</h2>
<h3>健身器材ROI 380%</h3>
<h3>电商节省$1,200浪费</h3>
```

#### 关键词布局
- **主要关键词**: 在H1标题中体现
- **次要关键词**: 在H2-H3标题中分布
- **长尾关键词**: 在段落内容中自然使用

### 2. 内容营销策略

#### 博客内容规划
1. **教程类内容**: Brand Bidding指南, 落地页优化技巧
2. **案例研究**: 客户成功故事, ROI提升案例
3. **行业分析**: 市场趋势, 竞争对手分析
4. **技术分享**: SEO最佳实践, 技术实现细节

#### 内容更新频率
- **博客文章**: 每周2-3篇
- **案例研究**: 每月1-2个
- **产品更新**: 根据功能发布节奏

### 3. 内部链接策略

#### 链接分配原则
- **首页**: 链接到核心功能页面
- **功能页面**: 链接到相关案例研究和博客
- **博客文章**: 链接到相关功能和产品页面
- **案例研究**: 链接到相关功能和技术实现

#### 锚文本优化
```html
<!-- 好的锚文本 -->
<a href="/features">12维度AI评估功能</a>
<a href="/case-studies">查看客户成功案例</a>

<!-- 避免的锚文本 -->
<a href="/features">点击这里</a>
<a href="/case-studies">更多</a>
```

## 🌍 国际SEO实施

### 1. 语言特定内容

#### 中文SEO重点
- 关键词: 落地页评估, AI评估, 联盟营销, ROI优化
- 本地化: 使用简体中文, 符合中国大陆用户习惯
- 联系方式: 微信、QQ、电子邮件
- 定价策略: 人民币定价, 符合中国市场需求

#### 英文SEO重点
- 关键词: landing page evaluation, AI evaluation, affiliate marketing, ROI optimization
- 本地化: 使用标准英语, 面向全球市场
- 联系方式: Email, Slack, 联系表单
- 定价策略: 美元定价, 适合国际用户

### 2. 地理定位信号

#### 联系信息本地化
```json
{
  "zh-CN": {
    "company": "AdsAI",
    "address": "中国上海市",
    "phone": "+86-xxx-xxxx-xxxx",
    "email": "support@adsai.dev"
  },
  "en": {
    "company": "AdsAI",
    "address": "Global",
    "phone": "+1-xxx-xxx-xxxx",
    "email": "support@adsai.dev"
  }
}
```

#### 时区和服务时间
```typescript
const getServiceHours = (language: string) => {
  if (language === 'zh-CN') {
    return '工作时间: 周一至周五 9:00-18:00 (CST)';
  } else {
    return 'Business Hours: Monday-Friday 9:00-18:00 (EST)';
  }
};
```

## 📈 性能监控和优化

### 1. SEO指标监控

#### 关键指标追踪
- **搜索排名**: 目标关键词排名变化
- **自然流量**: 来自搜索引擎的访问量
- **点击率**: 搜索结果点击率
- **页面停留时间**: 用户参与度指标
- **转化率**: 目标完成率

#### 监控工具
- **Google Search Console**: 搜索表现监控
- **Google Analytics**: 流量和用户行为分析
- **Ahrefs**: 关键词排名和反向链接监控
- **Screaming Frog**: 技术SEO定期审计

### 2. Core Web Vitals优化

#### 页面加载速度
```typescript
// Next.js图片优化
import Image from 'next/image';

<Image
  src="/hero-image.jpg"
  alt="AdsAI Dashboard"
  width={1200}
  height={800}
  priority
  sizes="(max-width: 768px) 100vw, 50vw"
  quality={85}
/>
```

#### 代码分割和懒加载
```typescript
// 动态导入非关键组件
const LazyComponent = dynamic(() => import('./LazyComponent'), {
  loading: () => <div>Loading...</div>,
  ssr: false,
});
```

## 🔄 维护和更新

### 1. 定期维护任务

#### 每周任务
- [ ] 监控搜索流量和排名变化
- [ ] 检查网站可访问性
- [ ] 回复用户反馈和评论
- [ ] 更新社交媒体内容

#### 每月任务
- [ ] 技术SEO审计
- [ ] 关键词排名分析
- [ ] 内容表现评估
- [ ] 竞争对手分析

#### 每季度任务
- [ ] SEO策略评估和调整
- [ ] 内容计划重新规划
- [ ] 技术基础设施更新
- [ ] 市场趋势分析

### 2. 应急响应流程

#### SEO问题应急处理
1. **问题识别**: 监控工具警报或用户报告
2. **影响评估**: 评估对搜索排名的影响
3. **快速修复**: 实施临时解决方案
4. **根本解决**: 彻底解决问题并预防复发
5. **效果验证**: 确认问题已解决

#### 搜索引擎算法更新响应
1. **监控变化**: 关注排名和流量变化
2. **分析影响**: 评估算法更新的具体影响
3. **策略调整**: 根据新规则调整SEO策略
4. **内容优化**: 更新受影响的页面内容
5. **效果追踪**: 监控恢复情况

## 📞 技术支持

### 常见问题解决

#### 1. 页面索引问题
**问题**: 新页面未被搜索引擎索引
**解决方案**:
- 检查robots.txt设置
- 确保页面在sitemap.xml中
- 使用Google Search Console提交URL
- 创建内部链接指向新页面

#### 2. 搜索结果显示问题
**问题**: 搜索结果标题或描述不正确
**解决方案**:
- 清除Google缓存 (cache:domain.com)
- 检查meta标签设置
- 验证结构化数据格式
- 更新并重新提交页面

#### 3. 国际SEO问题
**问题**: 错误语言版本显示
**解决方案**:
- 验证hreflang设置
- 检查内容本地化质量
- 优化地理定位信号
- 测试语言切换功能

### 联系方式
- **技术支持**: support@adsai.dev
- **SEO咨询**: seo@adsai.dev
- **文档更新**: docs@adsai.dev

---

*最后更新: 2025-01-20*
*版本: 1.0*