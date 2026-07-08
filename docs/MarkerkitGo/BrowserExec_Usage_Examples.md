# Browser-Exec统一API使用示例

## API端点
```
POST /api/v1/browser/visit
```

## 4种访问模式

### 1. Offer评估模式 (evaluate)

**业务场景**: 获取Offer的域名、品牌名、落地页信息，用于评估Offer价值

**请求示例**:
```bash
curl -X POST http://localhost:3001/api/v1/browser/visit \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://affiliate-network.com/offer/12345",
    "visitMode": "evaluate",
    "targetCountry": "US",
    "refererStrategy": "social",
    "proxyProviderURL": "https://proxy-api.com/us-proxies"
  }'
```

**响应示例**:
```json
{
  "success": true,
  "visitMode": "evaluate",
  "metadata": {
    "targetCountry": "US",
    "referer": "https://www.facebook.com/",
    "proxyUsed": true,
    "userAgent": "Mozilla/5.0..."
  },
  "timings": {
    "totalMs": 3200,
    "navigationMs": 2000,
    "stabilizationMs": 1200
  },
  "result": {
    "statusCode": 200,
    "finalUrl": "https://brand.com/product",
    "finalUrlSuffix": "utm_source=affiliate&utm_campaign=test",
    "domain": "brand.com",
    "brandName": "Brand Name",
    "htmlSnippet": "<html>...(first 50KB)...</html>",
    "redirectChain": [
      {"url": "https://affiliate-network.com/offer/12345", "timestamp": "2025-01-30T10:00:00Z"},
      {"url": "https://tracker.com/click", "timestamp": "2025-01-30T10:00:01Z"},
      {"url": "https://brand.com/product", "timestamp": "2025-01-30T10:00:02Z"}
    ],
    "antiDetectionResult": {
      "passed": true,
      "blockedBy": null
    }
  }
}
```

**Go服务调用**:
```go
import (
    "bytes"
    "encoding/json"
    "net/http"
)

type VisitRequest struct {
    URL             string `json:"url"`
    VisitMode       string `json:"visitMode"`
    TargetCountry   string `json:"targetCountry"`
    RefererStrategy string `json:"refererStrategy"`
    ProxyProviderURL string `json:"proxyProviderURL,omitempty"`
}

func evaluateOffer(offerURL string) (*VisitResponse, error) {
    req := VisitRequest{
        URL:             offerURL,
        VisitMode:       "evaluate",
        TargetCountry:   "US",
        RefererStrategy: "social",
        ProxyProviderURL: os.Getenv("PROXY_URL_US"),
    }

    jsonData, _ := json.Marshal(req)
    resp, err := http.Post(
        "http://browser-exec:3001/api/v1/browser/visit",
        "application/json",
        bytes.NewBuffer(jsonData),
    )

    // Handle response...
}
```

---

### 2. 补点击模式 (click)

**业务场景**: 模拟真实用户访问，突破Cloudflare等风控，增加点击量

**特点**:
- 完整加载所有资源 (图片、CSS、JS)
- 启用反风控检测
- 模拟人类停留时间 (3秒)
- 最长超时60秒
- 支持智能重试

**请求示例**:
```bash
curl -X POST http://localhost:3001/api/v1/browser/visit \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://brand.com/product",
    "visitMode": "click",
    "targetCountry": "GB",
    "refererStrategy": "search",
    "proxyProviderURL": "https://proxy-api.com/gb-proxies",
    "advancedOptions": {
      "dwellMs": 5000
    }
  }'
```

**响应示例**:
```json
{
  "success": true,
  "visitMode": "click",
  "metadata": {
    "proxyUsed": true,
    "referer": "https://www.google.co.uk/search"
  },
  "timings": {
    "totalMs": 8200,
    "navigationMs": 3200,
    "stabilizationMs": 2000
  },
  "result": {
    "statusCode": 200,
    "finalUrl": "https://brand.com/product",
    "domain": "brand.com",
    "redirectChain": [
      {"url": "https://brand.com/product", "timestamp": "..."}
    ],
    "antiDetectionResult": {
      "passed": true,
      "blockedBy": null,
      "cloudflareDetected": false,
      "captchaDetected": false
    }
  }
}
```

**失败响应 (被Cloudflare拦截)**:
```json
{
  "success": false,
  "visitMode": "click",
  "timings": {
    "totalMs": 1500
  },
  "result": {
    "antiDetectionResult": {
      "passed": false,
      "blockedBy": "cloudflare"
    }
  },
  "error": {
    "type": "antibot",
    "message": "Blocked by cloudflare",
    "fastFailed": true
  }
}
```

---

### 3. 换链接模式 (resolve)

**业务场景**: 快速获取Final URL和URL Suffix，用于更新广告链接

**特点**:
- 资源优化 (禁用图片/字体/媒体)
- 15秒快速超时
- 不进行风控检测 (节省时间)
- 重点返回 `finalUrlSuffix`

**请求示例**:
```bash
curl -X POST http://localhost:3001/api/v1/browser/visit \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://affiliate.com/offer/abc",
    "visitMode": "resolve",
    "targetCountry": "US",
    "refererStrategy": "social"
  }'
```

**响应示例**:
```json
{
  "success": true,
  "visitMode": "resolve",
  "timings": {
    "totalMs": 2100,
    "navigationMs": 1500,
    "stabilizationMs": 600
  },
  "result": {
    "statusCode": 200,
    "finalUrl": "https://landing.com/product",
    "finalUrlSuffix": "source=aff&campaign=winter&gclid=abc123",
    "domain": "landing.com",
    "redirectChain": [
      {"url": "https://affiliate.com/offer/abc", "timestamp": "..."},
      {"url": "https://tracker.io/r/xyz", "timestamp": "..."},
      {"url": "https://landing.com/product?source=aff&campaign=winter&gclid=abc123", "timestamp": "..."}
    ]
  }
}
```

**使用场景**:
```go
// 定期更新Offer的Final URL Suffix
func updateOfferURLSuffix(offerID string, offerURL string) error {
    resp, err := browserExecClient.Visit(ctx, &VisitRequest{
        URL:       offerURL,
        VisitMode: "resolve",
    })

    if err != nil || !resp.Success {
        return err
    }

    // 更新数据库
    err = db.UpdateOfferSuffix(offerID, resp.Result.FinalUrlSuffix)
    return err
}
```

---

### 4. 可用性检测模式 (check)

**业务场景**: 定期检测Offer URL是否可访问，检测是否到达真实落地页

**特点**:
- 优先使用HEAD请求 (最快)
- HEAD失败时降级为浏览器访问
- 禁用所有资源 (最小流量)
- 10秒快速超时
- **检测中间页**: 识别是否卡在广告联盟的中间页而非最终落地页
- 不进行风控检测

**请求示例**:
```bash
curl -X POST http://localhost:3001/api/v1/browser/visit \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://affiliate.com/offer/xyz",
    "visitMode": "check"
  }'
```

**成功响应 (到达最终落地页)**:
```json
{
  "success": true,
  "visitMode": "check",
  "timings": {
    "totalMs": 800
  },
  "result": {
    "available": true,
    "statusCode": 200,
    "method": "HEAD",
    "responseTimeMs": 800,
    "isIntermediatePage": false
  }
}
```

**失败响应 (卡在中间页)**:
```json
{
  "success": true,
  "visitMode": "check",
  "timings": {
    "totalMs": 5200
  },
  "result": {
    "available": false,
    "statusCode": 200,
    "method": "browser",
    "isIntermediatePage": true,
    "failureReason": "stuck_at_intermediate_page",
    "finalUrl": "https://affiliate-network.com/redirect",
    "domain": "affiliate-network.com"
  }
}
```

**失败响应 (HTTP错误)**:
```json
{
  "success": true,
  "visitMode": "check",
  "result": {
    "available": false,
    "statusCode": 404,
    "method": "browser",
    "failureReason": "http_error_404",
    "isIntermediatePage": false
  }
}
```

**定时任务示例**:
```go
// 每小时检测所有Offer的可用性
func checkOfferAvailability() {
    offers, _ := db.GetActiveOffers()

    for _, offer := range offers {
        resp, err := browserExecClient.Visit(ctx, &VisitRequest{
            URL:       offer.OriginalURL,
            VisitMode: "check",
        })

        if err != nil || !resp.Success {
            // 标记为失败
            db.UpdateOfferStatus(offer.ID, "check_failed")
            continue
        }

        if !resp.Result.Available {
            if resp.Result.IsIntermediatePage {
                // 卡在中间页，可能需要更新链接
                log.Printf("Offer %s stuck at intermediate page", offer.ID)
                db.UpdateOfferStatus(offer.ID, "needs_link_update")
            } else if resp.Result.FailureReason == "http_error_404" {
                // 链接失效
                log.Printf("Offer %s not found (404)", offer.ID)
                db.UpdateOfferStatus(offer.ID, "unavailable")
            }
        } else {
            db.UpdateOfferStatus(offer.ID, "available")
        }
    }
}
```

---

## Referer策略

### 社交媒体轮询 (social) - **推荐**
```json
{
  "refererStrategy": "social"
}
```
从以下列表随机选择:
- https://www.facebook.com/
- https://www.instagram.com/
- https://twitter.com/
- https://www.tiktok.com/
- https://www.youtube.com/
- https://www.linkedin.com/
- https://www.reddit.com/
- https://www.pinterest.com/

### 搜索引擎 (search)
```json
{
  "refererStrategy": "search"
}
```
根据目标国家选择:
- US: https://www.google.com/search
- GB: https://www.google.co.uk/search
- CN: https://www.baidu.com/s

### 直接访问 (direct)
```json
{
  "refererStrategy": "direct"
}
```
使用该国家的主流搜索引擎首页

### 自定义 (custom)
```json
{
  "refererStrategy": "custom",
  "customReferer": "https://example.com/"
}
```

### 置空 (none)
```json
{
  "refererStrategy": "none"
}
```
不设置Referer头

---

## 高级选项

### 覆盖超时时间
```json
{
  "url": "...",
  "visitMode": "evaluate",
  "advancedOptions": {
    "timeout": 20000
  }
}
```

### 修改停留时间 (click模式)
```json
{
  "visitMode": "click",
  "advancedOptions": {
    "dwellMs": 10000
  }
}
```

### 禁用风控检测
```json
{
  "visitMode": "evaluate",
  "advancedOptions": {
    "enableAntiBot": false
  }
}
```

---

## 错误处理

### 容量耗尽
```json
{
  "success": false,
  "error": {
    "type": "capacity",
    "message": "Browser pool capacity exhausted"
  }
}
```
**HTTP状态码**: 503
**解决方案**: 等待或增加浏览器池大小

### 超时
```json
{
  "success": false,
  "error": {
    "type": "timeout",
    "message": "Navigation timeout of 30000ms exceeded",
    "fastFailed": true
  }
}
```
**HTTP状态码**: 502

### 反风控拦截
```json
{
  "success": false,
  "error": {
    "type": "antibot",
    "message": "Blocked by cloudflare",
    "fastFailed": true
  }
}
```
**HTTP状态码**: 502

### 网络错误
```json
{
  "success": false,
  "error": {
    "type": "network",
    "message": "net::ERR_NAME_NOT_RESOLVED",
    "fastFailed": true
  }
}
```
**HTTP状态码**: 502

---

## 性能对比

| 模式 | 平均耗时 | 流量消耗 | 成功率 | 适用场景 |
|------|----------|---------|--------|---------|
| **evaluate** | 2-4秒 | 100-500KB | 90%+ | Offer评估 |
| **click** | 5-10秒 | 2-5MB | 85%+ | 补点击 |
| **resolve** | 1-3秒 | 50-200KB | 95%+ | 换链接 |
| **check** | 0.5-2秒 | 10-50KB | 98%+ | 可用性检测 |

---

## 最佳实践

### 1. 根据业务场景选择正确的模式
```go
// ❌ 错误: 用evaluate模式做可用性检测
resp, _ := visit(url, "evaluate")  // 浪费资源

// ✅ 正确: 用check模式
resp, _ := visit(url, "check")  // 快速轻量
```

### 2. 合理设置代理
```go
// ✅ 推荐: 仅在需要时使用代理
if needBypassGeo || needAntiBot {
    req.ProxyProviderURL = os.Getenv("PROXY_URL_" + targetCountry)
}
```

### 3. 利用快速失败机制
```go
resp, _ := visit(url, "evaluate")
if !resp.Success && resp.Error.FastFailed {
    // 快速失败，不重试
    return nil
}
```

### 4. 处理中间页检测
```go
resp, _ := visit(url, "check")
if !resp.Result.Available && resp.Result.IsIntermediatePage {
    // 需要更新链接或手动检查
    notifyAdmin("Offer stuck at intermediate page")
}
```

---

**文档版本**: v1.0
**最后更新**: 2025-01-30