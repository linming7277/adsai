# AdsAI 前端设计行业最佳实践与优化建议

**文档日期**: 2025-10-09
**参考对象**: Figma、Linear、Vercel、Stripe、Notion、Airtable 等顶级 SaaS 产品
**优化目标**: 从行业标杆中学习，提升产品竞争力

---

## 目录

1. [产品定位与增长策略](#一产品定位与增长策略)
2. [首页与营销优化](#二首页与营销优化)
3. [用户体验优化](#三用户体验优化)
4. [性能与技术优化](#四性能与技术优化)
5. [数据驱动与分析](#五数据驱动与分析)
6. [运营与增长黑客](#六运营与增长黑客)
7. [国际化与本地化](#七国际化与本地化)
8. [安全与合规](#八安全与合规)
9. [产品迭代与反馈](#九产品迭代与反馈)
10. [技术债务管理](#十技术债务管理)

---

## 一、产品定位与增长策略

### 1.1 产品定位清晰化

**当前问题**：
- 产品价值主张不够聚焦
- 目标用户画像模糊（广告主？代理商？个人？）

**行业最佳实践**（参考 Vercel、Linear）：

```markdown
## 明确的产品定位公式
[目标用户] 使用 [产品名] 来 [核心价值]，从而 [最终结果]

## AdsAI 优化建议：
**跨境电商广告主** 使用 **AdsAI** 来 **自动化评估和投放落地页广告**，
从而 **提升 ROAS 300%，节省 80% 人工成本**。
```

**具体优化**：

1. **首页标题优化**（当前 vs 优化）：
```diff
- 当前: "智能评估落地页，自动化广告投放"
+ 优化: "为跨境电商打造的 AI 广告自动化平台"
+ 副标题: "智能评估 1000+ 落地页，自动优化广告投放，提升 ROAS 300%"
```

2. **目标用户细分**（创建 3 个 Landing Page）：
- `/for/ecommerce` - 针对跨境电商（主要目标）
- `/for/agencies` - 针对广告代理商
- `/for/affiliates` - 针对联盟营销

3. **竞品对比页面**（参考 Linear、Notion）：
```tsx
// app/(site)/compare/page.tsx
<CompareTable
  competitors={[
    'AdsAI',
    '手动审核',
    'AdEspresso',
    'Supermetrics',
  ]}
  features={[
    { name: 'Offer 评估', adsai: '✅ AI 自动评估', manual: '❌ 需人工', adespresso: '⚠️ 基础评分', supermetrics: '❌ 不支持' },
    { name: '多渠道管理', adsai: '✅ 3+ 平台', manual: '❌ 分散管理', adespresso: '✅ 2 平台', supermetrics: '✅ 5+ 平台' },
    { name: '自动化投放', adsai: '✅ 智能策略', manual: '❌ 不支持', adespresso: '⚠️ 基础自动化', supermetrics: '❌ 仅数据分析' },
    { name: '价格', adsai: '$49/月起', manual: '人工成本高', adespresso: '$99/月起', supermetrics: '$199/月起' },
  ]}
/>
```

---

### 1.2 增长飞轮设计

**参考 Figma、Notion 的增长策略**：

```
用户增长飞轮:
1. 免费试用 → 2. Aha Moment → 3. 付费转化 → 4. 推荐传播 → 循环

AdsAI 优化方案:
1. 免费试用: 注册即送 100 Token（可评估 10 个 Offers）
2. Aha Moment: 首次评估完成后，展示"节省了 XX 小时人工审核"
3. 付费转化: Token 用完时，智能推荐套餐（基于历史使用量）
4. 推荐传播: 邀请奖励升级（邀请 1 人得 500 Token，被邀请人得 200 Token）
```

**具体实现**：

```tsx
// 用户首次评估完成后的 Aha Moment
function FirstEvaluationCompleteModal() {
  return (
    <Dialog open={showAhaMoment}>
      <DialogContent className="max-w-md">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircleIcon className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold">评估完成！</h2>
          <div className="space-y-2">
            <p className="text-lg">
              您的 Offer 得分 <span className="text-primary font-bold">85/100</span>
            </p>
            <p className="text-sm text-muted-foreground">
              相比人工审核，您节省了 <strong className="text-foreground">30 分钟</strong>
            </p>
          </div>
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm mb-2">💡 继续评估更多 Offers？</p>
            <Progress value={10} max={100} />
            <p className="text-xs text-muted-foreground mt-1">
              已使用 10/100 Token，还可评估 9 个 Offers
            </p>
          </div>
          <Button size="lg" onClick={handleContinue}>
            继续评估
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 二、首页与营销优化

### 2.1 社会证明增强（参考 Stripe、Vercel）

**当前方案不足**：
- Trust Bar 数据缺少来源证明
- 缺少真实客户 Logo

**优化建议**：

1. **添加客户 Logo 墙**（参考 Stripe）：
```tsx
<section className="py-12 bg-muted/30">
  <Container>
    <p className="text-center text-sm text-muted-foreground mb-8">
      被全球领先的跨境电商公司信赖
    </p>
    <div className="grid grid-cols-3 md:grid-cols-6 gap-8 items-center opacity-70 grayscale">
      <Image src="/logos/client-1.png" alt="Client 1" width={120} height={40} />
      <Image src="/logos/client-2.png" alt="Client 2" width={120} height={40} />
      <Image src="/logos/client-3.png" alt="Client 3" width={120} height={40} />
      {/* 6-10 个客户 Logo */}
    </div>
  </Container>
</section>
```

2. **实时数据展示**（参考 ProductHunt、Indie Hackers）：
```tsx
<LiveStats>
  <StatItem
    icon={<ActivityIcon />}
    label="过去 24 小时评估"
    value="1,247 个 Offers"
    trend="实时更新"
  />
  <StatItem
    icon={<UsersIcon />}
    label="在线用户"
    value="342 人"
    trend="当前"
  />
</LiveStats>
```

3. **客户评价展示**（参考 G2、Capterra）：
```tsx
<section className="py-20">
  <Container>
    <Heading type={2} className="text-center mb-12">
      客户怎么说
    </Heading>
    <div className="grid md:grid-cols-3 gap-8">
      <TestimonialCard
        quote="AdsAI 让我们的广告团队效率提升了 10 倍，ROAS 从 1.5 提升到 4.2"
        author="王明，运营总监"
        company="某跨境电商（年 GMV $50M）"
        avatar="/avatars/user-1.jpg"
        rating={5}
        badge="G2 五星评价"
      />
      {/* 更多评价 */}
    </div>
  </Container>
</section>
```

---

### 2.2 互动式产品演示（参考 Linear、Notion）

**当前方案不足**：
- 只有静态截图
- 用户无法体验产品

**优化建议**：

1. **嵌入式产品 Demo**（无需注册即可体验）：
```tsx
<section className="py-20 bg-gradient-to-b from-background to-muted/30">
  <Container>
    <div className="text-center mb-12">
      <Badge variant="outline">互动体验</Badge>
      <Heading type={2} className="mt-4">
        无需注册，立即体验 Offer 评估
      </Heading>
    </div>

    {/* 嵌入式 Demo */}
    <Card className="max-w-4xl mx-auto p-8">
      <InteractiveDemoWidget>
        <Input
          placeholder="输入落地页 URL（如: https://example.com）"
          value={demoUrl}
          onChange={setDemoUrl}
        />
        <Button
          size="lg"
          onClick={handleDemoEvaluate}
          loading={evaluating}
        >
          免费评估
        </Button>

        {/* 评估结果动画展示 */}
        {demoResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ScoreCircle score={demoResult.score} size="large" />
            <div className="mt-4 text-sm text-muted-foreground">
              💡 注册后可保存评估结果并进行自动化投放
            </div>
          </motion.div>
        )}
      </InteractiveDemoWidget>
    </Card>
  </Container>
</section>
```

2. **产品导览视频**（参考 Loom、Calendly）：
```tsx
<section className="py-20">
  <Container>
    <div className="max-w-4xl mx-auto">
      <VideoPlayer
        src="https://www.youtube.com/embed/demo-video"
        poster="/assets/images/video-poster.jpg"
        title="2 分钟了解 AdsAI"
      />
      <div className="mt-6 text-center">
        <Button variant="outline" href="/docs/tutorial">
          查看完整教程
        </Button>
      </div>
    </div>
  </Container>
</section>
```

---

### 2.3 价格锚点优化（参考 Stripe、GitHub）

**当前方案不足**：
- 缺少"最受欢迎"标签
- 没有年付优惠
- 企业版定价不透明

**优化建议**：

```tsx
<PricingTable>
  <PricingCard
    name="Free"
    price="$0"
    billing="永久免费"
    description="适合个人用户试用"
    features={[
      '100 Token/月',
      '最多 10 个 Offers',
      '基础评估功能',
      '社区支持',
    ]}
    cta="开始使用"
    ctaVariant="outline"
  />

  <PricingCard
    name="Starter"
    price="$49"
    billing="/月，按年付 $470（省 $118）"
    description="适合小型团队"
    badge="最受欢迎"
    recommended
    features={[
      '5,000 Token/月',
      '无限 Offers',
      '高级评估功能',
      '3 个广告账号',
      '邮件支持',
    ]}
    cta="开始试用"
    ctaVariant="default"
    savings="年付节省 20%"
  />

  <PricingCard
    name="Pro"
    price="$199"
    billing="/月，按年付 $1,910（省 $478）"
    description="适合专业团队"
    features={[
      '30,000 Token/月',
      '无限 Offers',
      '所有高级功能',
      '无限广告账号',
      '优先支持',
      '专属客户经理',
      'API 访问',
    ]}
    cta="联系销售"
    ctaVariant="outline"
  />

  <PricingCard
    name="Enterprise"
    price="自定义"
    billing="联系我们"
    description="适合大型企业"
    features={[
      '自定义 Token 配额',
      '无限一切',
      'SSO 单点登录',
      'SLA 保障',
      '专属部署',
      '合规认证',
      '定制开发',
    ]}
    cta="联系销售"
    ctaVariant="outline"
  />
</PricingTable>

{/* 价格计算器 */}
<section className="mt-12">
  <Card className="max-w-2xl mx-auto p-6">
    <h3 className="text-lg font-semibold mb-4">💰 计算您的成本</h3>
    <div className="space-y-4">
      <div>
        <Label>每月评估 Offers 数量</Label>
        <Slider
          value={offersCount}
          onValueChange={setOffersCount}
          min={10}
          max={1000}
          step={10}
        />
        <p className="text-sm text-muted-foreground mt-1">
          {offersCount} 个 Offers
        </p>
      </div>
      <div className="bg-muted rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span>推荐套餐</span>
          <strong className="text-primary">{recommendedPlan}</strong>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span>预估费用</span>
          <strong className="text-2xl">${estimatedCost}/月</strong>
        </div>
      </div>
    </div>
  </Card>
</section>
```

---

## 三、用户体验优化

### 3.1 空状态设计（参考 Figma、Linear）

**当前方案不足**：
- 空状态页面缺少引导
- 没有明确的 Next Action

**优化建议**：

```tsx
// components/EmptyState.tsx
export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  illustration,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* 插画 */}
      {illustration && (
        <div className="mb-6 opacity-50">
          <Image src={illustration} alt="" width={200} height={200} />
        </div>
      )}

      {/* 图标 */}
      {icon && (
        <div className="mb-4 rounded-full bg-muted p-4">
          {icon}
        </div>
      )}

      {/* 标题 */}
      <h3 className="text-xl font-semibold mb-2">{title}</h3>

      {/* 描述 */}
      <p className="text-muted-foreground max-w-md mb-6">
        {description}
      </p>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        {primaryAction && (
          <Button onClick={primaryAction.onClick}>
            {primaryAction.icon}
            {primaryAction.label}
          </Button>
        )}
        {secondaryAction && (
          <Button variant="outline" onClick={secondaryAction.onClick}>
            {secondaryAction.icon}
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}

// 使用示例：Offers 页面无数据时
<EmptyState
  illustration="/illustrations/empty-offers.svg"
  title="还没有 Offers"
  description="创建您的首个 Offer，开始智能评估之旅"
  primaryAction={{
    label: '创建 Offer',
    icon: <PlusIcon />,
    onClick: () => setCreateDialogOpen(true),
  }}
  secondaryAction={{
    label: '批量导入',
    icon: <UploadIcon />,
    onClick: () => setBulkImportDialogOpen(true),
  }}
/>
```

---

### 3.2 加载状态优化（参考 Vercel、Railway）

**当前方案不足**：
- 只有简单的 Spinner
- 缺少进度反馈

**优化建议**：

1. **骨架屏（Skeleton）**（参考 Vercel Dashboard）：
```tsx
// components/OffersSkeleton.tsx
export function OffersSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-3 w-[200px]" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// 使用
{isLoading ? <OffersSkeleton /> : <OffersTable offers={offers} />}
```

2. **进度条反馈**（参考 Linear 的任务创建）：
```tsx
// Offer 评估进度
<Card className="p-6">
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <span className="font-medium">正在评估 Offer</span>
      <span className="text-sm text-muted-foreground">{progress}%</span>
    </div>
    <Progress value={progress} max={100} />

    {/* 步骤展示 */}
    <div className="space-y-2">
      <StepItem
        label="抓取页面内容"
        status={step >= 1 ? 'completed' : 'pending'}
      />
      <StepItem
        label="分析页面质量"
        status={step >= 2 ? 'completed' : step === 1 ? 'active' : 'pending'}
      />
      <StepItem
        label="检测违规内容"
        status={step >= 3 ? 'completed' : step === 2 ? 'active' : 'pending'}
      />
      <StepItem
        label="生成评估报告"
        status={step >= 4 ? 'completed' : step === 3 ? 'active' : 'pending'}
      />
    </div>
  </div>
</Card>
```

3. **乐观更新（Optimistic UI）**（参考 Notion）：
```tsx
// 点击"评估"按钮时立即更新 UI，无需等待后端响应
const handleEvaluate = async (offer: Offer) => {
  // 1. 乐观更新：立即显示"评估中"状态
  mutate(
    (data) => ({
      ...data,
      offers: data.offers.map((o) =>
        o.id === offer.id ? { ...o, status: 'evaluating' } : o
      ),
    }),
    { revalidate: false }
  );

  // 2. 发起后端请求
  try {
    await evaluateOffer(offer.id);
    // 3. 成功后重新验证数据
    mutate();
    toast.success('评估已启动');
  } catch (error) {
    // 4. 失败时回滚
    mutate();
    toast.error('评估失败');
  }
};
```

---

### 3.3 快捷键支持（参考 Linear、GitHub）

**当前方案不足**：
- 所有操作都需要鼠标点击
- 缺少键盘快捷键

**优化建议**：

```tsx
// hooks/use-keyboard-shortcuts.ts
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command/Ctrl + K: 打开命令面板
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openCommandPalette();
      }

      // C: 创建新 Offer
      if (e.key === 'c' && !isInputFocused()) {
        e.preventDefault();
        openCreateOfferDialog();
      }

      // /: 聚焦搜索框
      if (e.key === '/' && !isInputFocused()) {
        e.preventDefault();
        focusSearchInput();
      }

      // ?: 显示快捷键帮助
      if (e.key === '?' && !isInputFocused()) {
        e.preventDefault();
        openShortcutsDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

// 命令面板（参考 Linear、Raycast）
<CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
  <CommandInput placeholder="输入命令或搜索..." />
  <CommandList>
    <CommandGroup heading="操作">
      <CommandItem onSelect={createOffer}>
        <PlusIcon className="mr-2" />
        创建 Offer
      </CommandItem>
      <CommandItem onSelect={connectAccount}>
        <LinkIcon className="mr-2" />
        连接广告账号
      </CommandItem>
    </CommandGroup>
    <CommandGroup heading="导航">
      <CommandItem onSelect={() => router.push('/dashboard')}>
        <HomeIcon className="mr-2" />
        前往大盘
      </CommandItem>
      <CommandItem onSelect={() => router.push('/offers')}>
        <DocumentTextIcon className="mr-2" />
        前往 Offer 库
      </CommandItem>
    </CommandGroup>
    <CommandGroup heading="搜索">
      {searchResults.map((result) => (
        <CommandItem key={result.id} onSelect={() => openOffer(result)}>
          {result.name}
        </CommandItem>
      ))}
    </CommandGroup>
  </CommandList>
</CommandPalette>

// 快捷键提示（首次使用时显示）
<HelpDialog>
  <KeyboardShortcut keys={['⌘', 'K']} description="打开命令面板" />
  <KeyboardShortcut keys={['C']} description="创建 Offer" />
  <KeyboardShortcut keys={['/']} description="搜索" />
  <KeyboardShortcut keys={['?']} description="显示所有快捷键" />
</HelpDialog>
```

---

### 3.4 搜索体验优化（参考 Algolia、GitHub）

**当前方案不足**：
- 只有简单的客户端搜索
- 搜索结果无高亮
- 无搜索历史

**优化建议**：

```tsx
// components/SmartSearch.tsx
export function SmartSearch() {
  const [query, setQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const { results, isSearching } = useSearch(query);

  return (
    <div className="relative">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索 Offers、任务或账号..."
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2"
            onClick={() => setQuery('')}
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 搜索结果下拉 */}
      {query && (
        <Card className="absolute top-full mt-2 w-full max-h-96 overflow-y-auto z-50">
          {isSearching ? (
            <div className="p-4 text-center">
              <Spinner />
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y">
              {results.map((result) => (
                <button
                  key={result.id}
                  className="w-full p-3 text-left hover:bg-muted transition-colors"
                  onClick={() => handleSelect(result)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {getTypeIcon(result.type)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {/* 高亮匹配文本 */}
                        <Highlight text={result.name} query={query} />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {result.description}
                      </div>
                    </div>
                    <Badge variant="outline">{result.type}</Badge>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">未找到相关结果</p>
            </div>
          )}
        </Card>
      )}

      {/* 搜索历史（无输入时显示） */}
      {!query && searchHistory.length > 0 && (
        <Card className="absolute top-full mt-2 w-full z-50">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">最近搜索</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchHistory([])}
              >
                清除
              </Button>
            </div>
            <div className="space-y-1">
              {searchHistory.slice(0, 5).map((term, i) => (
                <button
                  key={i}
                  className="w-full p-2 text-left text-sm hover:bg-muted rounded transition-colors"
                  onClick={() => setQuery(term)}
                >
                  <ClockIcon className="inline-block mr-2 h-4 w-4 text-muted-foreground" />
                  {term}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// 文本高亮组件
function Highlight({ text, query }: { text: string; query: string }) {
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-900">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}
```

---

## 四、性能与技术优化

### 4.1 边缘渲染优化（参考 Vercel Edge Functions）

**当前方案不足**：
- 所有请求都走 Cloud Run（单地区）
- 国际用户访问慢

**优化建议**：

```typescript
// middleware.ts - 使用 Vercel Edge Middleware
export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
    '/offers/:path*',
  ],
  runtime: 'edge', // ✅ 部署到全球边缘节点
};

export async function middleware(request: NextRequest) {
  // 1. 边缘缓存静态数据
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/public')) {
    const cached = await caches.default.match(request);
    if (cached) return cached;
  }

  // 2. 地理位置路由（就近访问）
  const geo = request.geo;
  const region = getClosestRegion(geo?.country);

  // 3. 根据地区路由到最近的 Cloud Run 实例
  const response = await fetch(`https://${region}.example.com${url.pathname}`, {
    headers: request.headers,
  });

  return response;
}
```

---

### 4.2 数据库查询优化

**当前方案不足**：
- 缺少数据库索引
- N+1 查询问题

**优化建议**：

```sql
-- 1. 添加复合索引（加速常用查询）
CREATE INDEX idx_offer_user_status ON "Offer"(user_id, status);
CREATE INDEX idx_offer_user_created ON "Offer"(user_id, created_at DESC);
CREATE INDEX idx_task_user_status ON "Task"(user_id, status, created_at DESC);

-- 2. 添加部分索引（减少索引大小）
CREATE INDEX idx_offer_active ON "Offer"(user_id)
WHERE status IN ('pending_evaluation', 'evaluating');

-- 3. 使用物化视图（加速统计查询）
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT
  user_id,
  COUNT(CASE WHEN status = 'ready_to_deploy' THEN 1 END) AS ready_offers,
  COUNT(CASE WHEN status = 'pending_evaluation' THEN 1 END) AS pending_offers,
  AVG(score) AS avg_score
FROM "Offer"
GROUP BY user_id;

-- 定时刷新（每 5 分钟）
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('refresh-dashboard-stats', '*/5 * * * *', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
$$);
```

```typescript
// API 查询优化：使用 JOIN 避免 N+1
// ❌ 差的做法（N+1 查询）
const offers = await supabase.from('Offer').select('*');
for (const offer of offers) {
  const account = await supabase
    .from('AdsAccount')
    .select('*')
    .eq('id', offer.ads_account_id)
    .single();
  offer.adsAccount = account;
}

// ✅ 好的做法（单次 JOIN）
const { data: offers } = await supabase
  .from('Offer')
  .select(`
    *,
    ads_account:AdsAccount(id, name, platform, status)
  `)
  .eq('user_id', userId);
```

---

### 4.3 图片优化（参考 Vercel Image Optimization）

**优化建议**：

```tsx
// next.config.js
module.exports = {
  images: {
    domains: ['example.com', 'supabase.co'],
    formats: ['image/avif', 'image/webp'], // ✅ 自动转换为现代格式
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

// 使用 Next.js Image 组件（自动优化）
<Image
  src="/assets/images/hero-dashboard.png"
  alt="Dashboard"
  width={1200}
  height={800}
  priority // 首屏图片
  placeholder="blur" // 模糊占位符
  blurDataURL="data:image/jpeg;base64,..." // 自动生成
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>

// 动态导入（懒加载非关键图片）
<Image
  src={offer.screenshot}
  alt={offer.name}
  width={600}
  height={400}
  loading="lazy" // ✅ 懒加载
/>
```

---

### 4.4 代码分割与打包优化

**优化建议**：

```typescript
// next.config.js
module.exports = {
  // 1. 压缩优化
  compress: true,
  swcMinify: true,

  // 2. 分析打包体积
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          // 将大型库单独打包
          recharts: {
            test: /[\\/]node_modules[\\/](recharts)[\\/]/,
            name: 'recharts',
            priority: 10,
          },
          // 将 UI 组件库单独打包
          ui: {
            test: /[\\/]node_modules[\\/](@radix-ui)[\\/]/,
            name: 'ui',
            priority: 10,
          },
        },
      };
    }
    return config;
  },

  // 3. 实验性功能
  experimental: {
    optimizeCss: true, // ✅ 优化 CSS
    optimizePackageImports: ['@heroicons/react', 'recharts'], // ✅ tree-shaking
  },
};

// 动态导入大型组件
const Chart = dynamic(() => import('recharts').then((mod) => mod.LineChart), {
  ssr: false,
  loading: () => <Skeleton className="h-64" />,
});

// 按需导入图标
import { CheckCircleIcon } from '@heroicons/react/24/outline';
// 而非: import * as Icons from '@heroicons/react/24/outline';
```

---

## 五、数据驱动与分析

### 5.1 用户行为追踪（参考 Amplitude、Mixpanel）

**当前方案不足**：
- 缺少用户行为分析
- 无法了解用户使用习惯

**优化建议**：

```typescript
// lib/analytics.ts
import { Analytics } from '@segment/analytics-next';

const analytics = Analytics.load({
  writeKey: process.env.NEXT_PUBLIC_SEGMENT_KEY,
});

// 封装埋点函数
export const track = {
  // 页面浏览
  pageView: (pageName: string, properties?: Record<string, any>) => {
    analytics.page(pageName, properties);
  },

  // 用户注册
  signUp: (method: 'google' | 'email') => {
    analytics.track('User Signed Up', { method });
  },

  // Offer 创建
  offerCreated: (offer: { id: string; url: string; category: string }) => {
    analytics.track('Offer Created', {
      offer_id: offer.id,
      offer_url: offer.url,
      offer_category: offer.category,
    });
  },

  // Offer 评估
  offerEvaluated: (offer: { id: string; score: number; duration: number }) => {
    analytics.track('Offer Evaluated', {
      offer_id: offer.id,
      score: offer.score,
      evaluation_duration_ms: offer.duration,
    });
  },

  // 付费转化
  subscriptionStarted: (plan: string, amount: number) => {
    analytics.track('Subscription Started', {
      plan,
      amount,
    });
  },

  // 关键功能使用
  featureUsed: (featureName: string, properties?: Record<string, any>) => {
    analytics.track('Feature Used', {
      feature_name: featureName,
      ...properties,
    });
  },
};

// 在组件中使用
function CreateOfferDialog() {
  const handleCreate = async (data) => {
    const offer = await createOffer(data);

    // 埋点：Offer 创建成功
    track.offerCreated({
      id: offer.id,
      url: data.url,
      category: data.category,
    });

    toast.success('Offer 创建成功');
  };

  return <Dialog>...</Dialog>;
}
```

**关键指标追踪**：

```typescript
// 定义关键指标
const KEY_METRICS = {
  // 激活指标
  ACTIVATION: {
    firstOfferCreated: 'First Offer Created',
    firstEvaluationCompleted: 'First Evaluation Completed',
    firstAccountConnected: 'First Account Connected',
  },

  // 参与度指标
  ENGAGEMENT: {
    dailyActiveUsers: 'Daily Active Users',
    weeklyActiveUsers: 'Weekly Active Users',
    avgSessionDuration: 'Average Session Duration',
    offersPerUser: 'Offers Per User',
  },

  // 转化指标
  CONVERSION: {
    trialStarted: 'Trial Started',
    trialToPayingConversion: 'Trial to Paying Conversion',
    upgradedPlan: 'Upgraded Plan',
  },

  // 留存指标
  RETENTION: {
    day1Retention: 'Day 1 Retention',
    day7Retention: 'Day 7 Retention',
    day30Retention: 'Day 30 Retention',
  },
};
```

---

### 5.2 A/B 测试框架（参考 Vercel Edge Config + Statsig）

**优化建议**：

```typescript
// lib/ab-test.ts
import { evaluate } from '@vercel/edge-config';

export async function getFeatureFlag(
  userId: string,
  flagName: string
): Promise<boolean> {
  // 从 Vercel Edge Config 读取特性开关
  const flags = await evaluate({
    user: { id: userId },
    experiments: [flagName],
  });

  return flags[flagName] ?? false;
}

// 使用示例：测试新的定价页面
export default async function PricingPage() {
  const userId = await getCurrentUserId();
  const showNewPricing = await getFeatureFlag(userId, 'new-pricing-page');

  return showNewPricing ? <NewPricingPage /> : <OldPricingPage />;
}

// A/B 测试配置（Vercel Edge Config）
{
  "experiments": {
    "new-pricing-page": {
      "enabled": true,
      "percentage": 50, // 50% 用户看到新版本
      "targeting": {
        "country": ["US", "CN"], // 只在美国和中国测试
        "signupDate": { "after": "2025-10-01" } // 只对新用户测试
      }
    },
    "new-onboarding-flow": {
      "enabled": true,
      "percentage": 30
    }
  }
}
```

---

### 5.3 错误监控与日志（参考 Sentry、LogRocket）

**优化建议**：

```typescript
// lib/monitoring.ts
import * as Sentry from '@sentry/nextjs';
import LogRocket from 'logrocket';

// 1. 初始化 Sentry
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1, // ✅ 会话回放（10% 采样）
  replaysOnErrorSampleRate: 1.0, // 错误时 100% 录制
});

// 2. 初始化 LogRocket（用户会话录制）
LogRocket.init('adsai/production');

// 3. 关联 Sentry 和 LogRocket
LogRocket.getSessionURL((sessionURL) => {
  Sentry.setContext('logrocket', { sessionURL });
});

// 4. 自定义错误追踪
export function captureError(error: Error, context?: Record<string, any>) {
  // 添加用户上下文
  Sentry.setUser({
    id: context?.userId,
    email: context?.userEmail,
  });

  // 添加面包屑（用户操作路径）
  Sentry.addBreadcrumb({
    category: 'action',
    message: context?.action || 'Unknown action',
    level: 'info',
  });

  // 捕获错误
  Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
  });

  // 同时记录到 LogRocket
  LogRocket.captureException(error, {
    extra: context,
  });
}

// 5. 性能监控
export function trackPerformance(metricName: string, value: number) {
  Sentry.metrics.distribution(metricName, value, {
    unit: 'millisecond',
  });
}

// 使用示例
try {
  await evaluateOffer(offerId);
} catch (error) {
  captureError(error, {
    userId: user.id,
    userEmail: user.email,
    action: 'evaluate-offer',
    tags: { feature: 'offer-evaluation' },
    extra: { offerId },
  });
  toast.error('评估失败，请重试');
}
```

---

## 六、运营与增长黑客

### 6.1 邮件营销自动化（参考 Mailchimp、Customer.io）

**优化建议**：

```typescript
// 自动化邮件场景
const EMAIL_AUTOMATIONS = {
  // 1. 欢迎邮件（注册后立即发送）
  welcome: {
    trigger: 'user.signup',
    delay: 0,
    template: 'welcome-email',
    content: {
      subject: '欢迎来到 AdsAI！这里是您的快速开始指南',
      cta: '创建首个 Offer',
    },
  },

  // 2. Onboarding 系列邮件（3 封）
  onboarding_day1: {
    trigger: 'user.signup',
    delay: '24h',
    template: 'onboarding-day1',
    content: {
      subject: '💡 如何评估您的首个 Offer？',
      cta: '查看教程',
    },
  },

  onboarding_day3: {
    trigger: 'user.signup',
    delay: '72h',
    condition: 'offers_count < 5', // 只发送给未完成 5 个 Offers 的用户
    template: 'onboarding-day3',
    content: {
      subject: '🚀 批量导入功能：一次评估 100 个 Offers',
      cta: '批量导入',
    },
  },

  onboarding_day7: {
    trigger: 'user.signup',
    delay: '168h',
    condition: 'accounts_connected === 0',
    template: 'onboarding-day7',
    content: {
      subject: '🔗 连接广告账号，开始自动化投放',
      cta: '连接账号',
    },
  },

  // 3. 付费转化邮件（Token 用完时）
  token_depleted: {
    trigger: 'token.balance < 10',
    delay: 0,
    template: 'token-depleted',
    content: {
      subject: '⚠️ Token 余额不足，升级套餐享 20% 优惠',
      cta: '升级套餐',
    },
  },

  // 4. 流失召回邮件（7 天未登录）
  winback: {
    trigger: 'user.last_login > 7d',
    delay: 0,
    template: 'winback-email',
    content: {
      subject: '我们想念您了！回来看看新功能吧',
      cta: '查看新功能',
    },
  },

  // 5. 推荐邀请邮件（付费用户）
  referral: {
    trigger: 'subscription.active',
    delay: '30d',
    template: 'referral-email',
    content: {
      subject: '🎁 邀请好友，双方各得 500 Token',
      cta: '邀请好友',
    },
  },
};
```

---

### 6.2 产品内引导（Product Tours）（参考 Appcues、Pendo）

**优化建议**：

```tsx
// components/ProductTour.tsx
import { Driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export function useProductTour() {
  const startTour = (tourName: 'dashboard' | 'offers' | 'ads-center') => {
    const tours = {
      dashboard: [
        {
          element: '#kpi-cards',
          popover: {
            title: '核心指标一览',
            description: '这里展示您的 Offer 数量、评估成功率、广告花费等关键数据',
            position: 'bottom',
          },
        },
        {
          element: '#action-items',
          popover: {
            title: '待办事项',
            description: '点击卡片快速跳转到对应操作页面',
            position: 'left',
          },
        },
        {
          element: '#charts',
          popover: {
            title: '数据趋势图表',
            description: '可视化展示 Offer 评估趋势和广告花费变化',
            position: 'top',
          },
        },
      ],

      offers: [
        {
          element: '#create-offer-btn',
          popover: {
            title: '创建您的首个 Offer',
            description: '点击这里输入落地页 URL，开始智能评估',
            position: 'bottom',
          },
        },
        {
          element: '#bulk-import-btn',
          popover: {
            title: '批量导入',
            description: '上传 CSV 文件，一次导入 100+ Offers',
            position: 'bottom',
          },
        },
      ],
    };

    const driver = new Driver({
      showProgress: true,
      steps: tours[tourName],
      onDestroyStarted: () => {
        // 标记用户已完成引导
        localStorage.setItem(`tour-${tourName}-completed`, 'true');
      },
    });

    driver.drive();
  };

  return { startTour };
}

// 使用：首次进入页面时自动触发
export default function DashboardPage() {
  const { startTour } = useProductTour();

  useEffect(() => {
    const tourCompleted = localStorage.getItem('tour-dashboard-completed');
    if (!tourCompleted) {
      // 延迟 1 秒，等待页面加载完成
      setTimeout(() => startTour('dashboard'), 1000);
    }
  }, []);

  return <Dashboard />;
}
```

---

### 6.3 社交分享与病毒传播（参考 Figma、Loom）

**优化建议**：

```tsx
// 1. Offer 评估结果分享（生成精美卡片）
<ShareResultCard>
  <Card className="p-6 max-w-md">
    <div className="text-center space-y-4">
      <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center">
        <span className="text-4xl font-bold text-white">
          {score}
        </span>
      </div>
      <h3 className="text-xl font-bold">
        我的落地页得分 {score}/100
      </h3>
      <p className="text-muted-foreground">
        使用 AdsAI 智能评估，节省 30 分钟人工审核
      </p>
      <div className="flex gap-2 justify-center">
        <Button
          size="sm"
          variant="outline"
          onClick={() => shareToTwitter(score)}
        >
          <TwitterIcon className="mr-2" />
          分享到 Twitter
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => copyShareLink(score)}
        >
          <LinkIcon className="mr-2" />
          复制链接
        </Button>
      </div>
    </div>
  </Card>
</ShareResultCard>

// 2. Twitter 分享文案自动生成
function shareToTwitter(score: number) {
  const text = `我的落地页在 @AdsAI 上得分 ${score}/100！🎉\n\nAI 智能评估，30 秒生成报告，比人工审核快 10 倍！\n\n免费试用：https://example.com?ref=twitter`;

  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// 3. 推荐链接追踪
function generateReferralLink(userId: string): string {
  return `https://example.com?ref=${userId}`;
}

// 4. 病毒系数追踪
track.referralShared({
  user_id: userId,
  channel: 'twitter', // 或 'facebook', 'linkedin', 'copy-link'
});
```

---

## 七、国际化与本地化

### 7.1 多语言 SEO 优化（参考 Notion、Figma）

**优化建议**：

```typescript
// app/[locale]/(site)/page.tsx
export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations(params.locale);

  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: {
      canonical: `https://example.com/${params.locale}`,
      languages: {
        'zh-CN': 'https://example.com/zh-CN',
        'en': 'https://example.com/en',
        'ja': 'https://example.com/ja',
        'ko': 'https://example.com/ko',
      },
    },
    openGraph: {
      locale: params.locale,
      alternateLocale: ['zh-CN', 'en', 'ja', 'ko'].filter(l => l !== params.locale),
    },
  };
}

// 自动语言检测与重定向
// middleware.ts
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 检测用户首选语言
  const locale = detectLocale(request);

  // 如果访问根路径，重定向到对应语言版本
  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  return NextResponse.next();
}

function detectLocale(request: NextRequest): string {
  // 1. 检查 Cookie
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale) return cookieLocale;

  // 2. 检查 Accept-Language 头
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    const primaryLocale = acceptLanguage.split(',')[0].split('-')[0];
    const supportedLocales = ['zh', 'en', 'ja', 'ko'];
    if (supportedLocales.includes(primaryLocale)) {
      return primaryLocale === 'zh' ? 'zh-CN' : primaryLocale;
    }
  }

  // 3. 根据 IP 地理位置（Vercel geo）
  const country = request.geo?.country;
  const countryToLocale: Record<string, string> = {
    CN: 'zh-CN',
    US: 'en',
    JP: 'ja',
    KR: 'ko',
  };
  if (country && countryToLocale[country]) {
    return countryToLocale[country];
  }

  // 4. 默认中文
  return 'zh-CN';
}
```

---

### 7.2 货币与时区本地化

**优化建议**：

```typescript
// lib/localization.ts
import { format, utcToZonedTime } from 'date-fns-tz';
import { zhCN, enUS, ja, ko } from 'date-fns/locale';

// 1. 货币格式化
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'zh-CN'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// 使用示例
formatCurrency(49.99, 'USD', 'zh-CN'); // ¥49.99
formatCurrency(49.99, 'USD', 'en-US'); // $49.99
formatCurrency(49.99, 'JPY', 'ja-JP'); // ¥50

// 2. 日期时间格式化（自动转换时区）
export function formatDate(
  date: string | Date,
  timezone: string = 'Asia/Shanghai',
  locale: string = 'zh-CN'
): string {
  const zonedDate = utcToZonedTime(date, timezone);
  const localeMap = {
    'zh-CN': zhCN,
    'en': enUS,
    'ja': ja,
    'ko': ko,
  };

  return format(zonedDate, 'PPpp', { locale: localeMap[locale] });
}

// 使用示例
formatDate('2025-10-09T10:00:00Z', 'Asia/Shanghai', 'zh-CN');
// 输出: 2025年10月9日 18:00:00

formatDate('2025-10-09T10:00:00Z', 'America/New_York', 'en');
// 输出: Oct 9, 2025, 6:00:00 AM

// 3. 数字格式化
export function formatNumber(
  value: number,
  locale: string = 'zh-CN'
): string {
  return new Intl.NumberFormat(locale).format(value);
}

// 使用示例
formatNumber(1234567, 'zh-CN'); // 1,234,567
formatNumber(1234567, 'en-US'); // 1,234,567
formatNumber(1234567, 'de-DE'); // 1.234.567
```

---

## 八、安全与合规

### 8.1 安全加固（参考 OWASP Top 10）

**优化建议**：

```typescript
// 1. CSRF 保护（增强）
// middleware.ts
import { getToken } from 'next-auth/jwt';
import { verifyCSRFToken } from '~/lib/security/csrf';

export async function middleware(request: NextRequest) {
  // 对所有 POST/PUT/DELETE 请求验证 CSRF Token
  if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
    const csrfToken = request.headers.get('X-CSRF-Token');
    const isValid = await verifyCSRFToken(csrfToken);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid CSRF Token' },
        { status: 403 }
      );
    }
  }

  return NextResponse.next();
}

// 2. Rate Limiting（防止滥用）
// lib/security/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

// 不同端点的限流策略
export const rateLimiters = {
  // API 请求：每分钟 60 次
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    analytics: true,
  }),

  // Offer 评估：每小时 100 次
  evaluation: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 h'),
  }),

  // 登录：每 15 分钟 5 次
  login: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
  }),
};

// API 路由中使用
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const { success, remaining } = await rateLimiters.evaluation.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'X-RateLimit-Remaining': remaining.toString() } }
    );
  }

  // 继续处理请求...
}

// 3. 输入验证（使用 Zod）
import { z } from 'zod';

const CreateOfferSchema = z.object({
  url: z.string().url('无效的 URL 格式').max(2048),
  name: z.string().min(1).max(200),
  category: z.enum(['ecommerce', 'gaming', 'finance', 'other']).optional(),
});

export async function POST(request: Request) {
  const body = await request.json();

  // 验证输入
  const result = CreateOfferSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: result.error.flatten() },
      { status: 400 }
    );
  }

  // 使用验证后的数据
  const { url, name, category } = result.data;
  // ...
}

// 4. SQL 注入防护（使用参数化查询）
// ✅ 好的做法（使用 Supabase SDK，自动参数化）
const { data } = await supabase
  .from('Offer')
  .select('*')
  .eq('user_id', userId)
  .eq('name', userInput); // ✅ 自动转义

// ❌ 差的做法（拼接 SQL，容易注入）
const query = `SELECT * FROM Offer WHERE name = '${userInput}'`; // 危险！

// 5. XSS 防护（React 自动转义）
// ✅ 好的做法（自动转义）
<div>{user.name}</div>

// ❌ 危险做法（允许 HTML）
<div dangerouslySetInnerHTML={{ __html: user.name }} /> // 危险！

// 如果必须渲染 HTML，使用 DOMPurify 清理
import DOMPurify from 'isomorphic-dompurify';

<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }} />
```

---

### 8.2 合规认证（GDPR、SOC 2）

**优化建议**：

```tsx
// 1. Cookie 同意横幅（GDPR 要求）
// components/CookieConsent.tsx
export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setShowBanner(false);

    // 初始化分析工具
    initAnalytics();
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-50">
      <Container>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            我们使用 Cookie 来改善您的体验。继续使用即表示您同意我们的{' '}
            <Link href="/privacy" className="text-primary underline">
              隐私政策
            </Link>
            。
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReject}>
              拒绝
            </Button>
            <Button size="sm" onClick={handleAccept}>
              接受
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}

// 2. 数据导出（GDPR Right to Access）
// API: GET /api/user/export-data
export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // 收集用户所有数据
  const [user, offers, tasks, transactions] = await Promise.all([
    getUserData(userId),
    getUserOffers(userId),
    getUserTasks(userId),
    getUserTransactions(userId),
  ]);

  const exportData = {
    user,
    offers,
    tasks,
    transactions,
    exportedAt: new Date().toISOString(),
  };

  // 生成 JSON 文件
  const json = JSON.stringify(exportData, null, 2);

  return new Response(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="adsai-data-${userId}.json"`,
    },
  });
}

// 3. 数据删除（GDPR Right to Erasure）
// API: DELETE /api/user/delete-account
export async function DELETE(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // 确认用户身份（要求输入密码）
  const { password } = await request.json();
  const isValid = await verifyPassword(userId, password);

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 403 });
  }

  // 软删除（标记为删除，30 天后永久删除）
  await markUserForDeletion(userId, {
    deletionScheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  // 发送确认邮件
  await sendEmail({
    to: session.user.email,
    subject: '账号删除确认',
    template: 'account-deletion-scheduled',
  });

  return NextResponse.json({ success: true });
}
```

---

## 九、产品迭代与反馈

### 9.1 用户反馈收集（参考 Linear、Canny）

**优化建议**：

```tsx
// 1. 页面内反馈按钮（浮动在右下角）
<FeedbackButton>
  <Button
    className="fixed bottom-6 right-6 rounded-full shadow-lg"
    size="lg"
    onClick={() => setFeedbackDialogOpen(true)}
  >
    <ChatBubbleLeftIcon className="mr-2" />
    反馈
  </Button>
</FeedbackButton>

// 2. 反馈对话框
<FeedbackDialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>我们很想听听您的想法</DialogTitle>
      <DialogDescription>
        帮助我们改进 AdsAI，您的反馈至关重要
      </DialogDescription>
    </DialogHeader>

    <Form onSubmit={handleSubmitFeedback}>
      {/* 反馈类型 */}
      <FormField label="反馈类型">
        <Select value={feedbackType} onChange={setFeedbackType}>
          <SelectItem value="bug">🐛 Bug 报告</SelectItem>
          <SelectItem value="feature">💡 功能建议</SelectItem>
          <SelectItem value="improvement">🚀 改进建议</SelectItem>
          <SelectItem value="other">💬 其他</SelectItem>
        </Select>
      </FormField>

      {/* 反馈内容 */}
      <FormField label="详细描述">
        <Textarea
          value={feedbackContent}
          onChange={setFeedbackContent}
          placeholder="请描述您遇到的问题或建议..."
          rows={5}
        />
      </FormField>

      {/* 截图上传 */}
      <FormField label="截图（可选）">
        <FileUpload
          accept="image/*"
          onUpload={handleScreenshotUpload}
        />
      </FormField>

      {/* 联系方式 */}
      <FormField label="邮箱（可选）" description="如需回复，请留下邮箱">
        <Input
          type="email"
          value={feedbackEmail}
          onChange={setFeedbackEmail}
          placeholder="your@email.com"
        />
      </FormField>

      <DialogFooter>
        <Button type="submit" loading={submitting}>
          提交反馈
        </Button>
      </DialogFooter>
    </Form>
  </DialogContent>
</FeedbackDialog>

// 3. 自动收集上下文信息
const handleSubmitFeedback = async () => {
  const feedback = {
    type: feedbackType,
    content: feedbackContent,
    email: feedbackEmail,
    screenshot: screenshotUrl,
    // 自动收集的上下文
    context: {
      userId: user.id,
      userEmail: user.email,
      page: window.location.pathname,
      userAgent: navigator.userAgent,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      timestamp: new Date().toISOString(),
    },
  };

  await fetch('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(feedback),
  });

  toast.success('感谢您的反馈！');
  setFeedbackDialogOpen(false);
};
```

---

### 9.2 功能投票与路线图（参考 Canny、ProductBoard）

**优化建议**：

```tsx
// app/(site)/roadmap/page.tsx
export default function RoadmapPage() {
  return (
    <Container>
      <div className="py-16">
        <Heading type={1} className="text-center mb-4">
          产品路线图
        </Heading>
        <SubHeading className="text-center mb-12">
          查看我们正在开发的功能，并为您期待的功能投票
        </SubHeading>

        {/* 功能状态筛选 */}
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="planned">计划中</TabsTrigger>
            <TabsTrigger value="in-progress">开发中</TabsTrigger>
            <TabsTrigger value="completed">已完成</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-8">
            <div className="space-y-6">
              {features.map((feature) => (
                <FeatureCard
                  key={feature.id}
                  feature={feature}
                  onVote={handleVote}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* 提交新功能建议 */}
        <div className="mt-12 text-center">
          <Button size="lg" onClick={() => setSubmitFeatureOpen(true)}>
            <LightBulbIcon className="mr-2" />
            提交功能建议
          </Button>
        </div>
      </div>
    </Container>
  );
}

// 功能卡片
function FeatureCard({ feature, onVote }: FeatureCardProps) {
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4">
        {/* 投票按钮 */}
        <button
          className="flex flex-col items-center gap-1 p-2 rounded hover:bg-muted transition-colors"
          onClick={() => onVote(feature.id)}
        >
          <ArrowUpIcon className={cn(
            'h-5 w-5',
            feature.userVoted ? 'text-primary' : 'text-muted-foreground'
          )} />
          <span className="text-sm font-medium">{feature.votes}</span>
        </button>

        {/* 功能信息 */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold">{feature.title}</h3>
            <Badge variant={getStatusVariant(feature.status)}>
              {getStatusLabel(feature.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground mb-3">{feature.description}</p>

          {/* 标签 */}
          <div className="flex items-center gap-2">
            {feature.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>

          {/* 预计发布时间 */}
          {feature.eta && (
            <div className="mt-3 text-sm text-muted-foreground">
              <CalendarIcon className="inline-block mr-1 h-4 w-4" />
              预计 {feature.eta} 发布
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
```

---

## 十、技术债务管理

### 10.1 代码质量监控（参考 SonarQube、CodeClimate）

**优化建议**：

```yaml
# .github/workflows/code-quality.yml
name: Code Quality

on: [pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npm run lint
      - run: npm run type-check

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3 # 上传覆盖率报告

  sonarcloud:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

```typescript
// sonar-project.properties
sonar.projectKey=adsai_frontend
sonar.organization=adsai
sonar.sources=apps/frontend/src
sonar.tests=apps/frontend/src
sonar.test.inclusions=**/*.test.ts,**/*.test.tsx
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.coverage.exclusions=**/*.test.ts,**/*.test.tsx,**/*.config.ts
```

---

### 10.2 依赖更新策略（参考 Dependabot、Renovate）

**优化建议**：

```yaml
# .github/dependabot.yml
version: 2
updates:
  # npm 依赖
  - package-ecosystem: "npm"
    directory: "/apps/frontend"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    reviewers:
      - "team-frontend"
    labels:
      - "dependencies"
      - "automerge"
    # 自动合并小版本更新
    allow:
      - dependency-type: "direct"
        update-type: "minor"

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

---

## 总结：优化优先级矩阵

| 优化项 | 影响力 | 实施难度 | 优先级 | 预期收益 |
|--------|--------|----------|--------|----------|
| **首页社会证明增强** | 高 | 低 | 🔥 P0 | 转化率 +30% |
| **互动式产品 Demo** | 高 | 中 | 🔥 P0 | 注册率 +40% |
| **空状态设计** | 高 | 低 | 🔥 P0 | 用户留存 +25% |
| **邮件营销自动化** | 高 | 中 | 🔥 P0 | 付费转化 +20% |
| **用户行为追踪** | 高 | 中 | 🟡 P1 | 数据驱动决策 |
| **命令面板 + 快捷键** | 中 | 中 | 🟡 P1 | 用户效率 +50% |
| **A/B 测试框架** | 中 | 高 | 🟡 P1 | 持续优化 |
| **边缘渲染优化** | 中 | 高 | 🟢 P2 | 全球延迟 -40% |
| **多语言 SEO** | 中 | 中 | 🟢 P2 | 有机流量 +30% |
| **产品内引导** | 中 | 中 | 🟢 P2 | Onboarding 完成率 +35% |

---

## 快速实施清单（本月完成）

### Week 1: 首页与营销优化
- [ ] 添加客户 Logo 墙
- [ ] 客户评价展示
- [ ] 价格锚点优化（年付优惠）
- [ ] 价格计算器

### Week 2: 用户体验优化
- [ ] 空状态设计（所有页面）
- [ ] 骨架屏加载
- [ ] 乐观更新
- [ ] 搜索优化（高亮、历史）

### Week 3: 增长与运营
- [ ] 邮件营销自动化（5 个场景）
- [ ] Aha Moment 展示
- [ ] 社交分享功能
- [ ] 推荐链接追踪

### Week 4: 数据与分析
- [ ] 用户行为埋点（10 个关键事件）
- [ ] Dashboard 数据看板
- [ ] Sentry 错误监控
- [ ] 性能监控

---

**结论**：以上优化方案参考了 Figma、Linear、Vercel、Stripe 等顶级 SaaS 产品的最佳实践，建议优先实施 P0 高优先级项目，预期可提升转化率 30%+、用户留存 25%+。
