package services

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/xxrenzhe/autoads/pkg/serviceclient"
)

// Global service registry (set by main.go)
var globalServiceRegistry *serviceclient.Registry

// SetGlobalRegistry sets the global service registry for this package
func SetGlobalRegistry(registry *serviceclient.Registry) {
	globalServiceRegistry = registry
}

// EvaluationServiceV2 handles offer evaluation using browser-exec service
type EvaluationServiceV2 struct {
	redisClient    *redis.Client
	httpClient     *http.Client
	browserExecURL string
}

// NewEvaluationServiceV2 creates a new evaluation service that uses browser-exec
func NewEvaluationServiceV2(redisClient *redis.Client, browserExecURL string) *EvaluationServiceV2 {
	if browserExecURL == "" {
		browserExecURL = os.Getenv("BROWSER_EXEC_URL")
	}
	if browserExecURL == "" {
		browserExecURL = "http://localhost:3001" // Default for local development
	}

	return &EvaluationServiceV2{
		redisClient:    redisClient,
		browserExecURL: browserExecURL,
		httpClient: &http.Client{
			Timeout: 60 * time.Second, // Longer timeout for browser operations
		},
	}
}

// BrowserEvalResponse represents the response from browser-exec evaluate endpoint
type BrowserEvalResponse struct {
	OK             bool                     `json:"ok"`
	Status         int                      `json:"status"`
	FinalURL       string                   `json:"finalUrl"`
	FinalURLSuffix string                   `json:"finalUrlSuffix"`
	Domain         string                   `json:"domain"`
	BrandName      string                   `json:"brandName"`
	RedirectChain  []map[string]interface{} `json:"redirectChain"`
	HTMLSnippet    string                   `json:"htmlSnippet"`
	Via            string                   `json:"via"`
	Timings        map[string]interface{}   `json:"timings"`
	Error          *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// EvaluateOffer performs full evaluation of an offer using browser-exec service
func (s *EvaluationServiceV2) EvaluateOffer(ctx context.Context, offerID, originalURL string, targetCountries []string) (*EvaluationResult, error) {
	result := &EvaluationResult{
		OfferID:   offerID,
		Status:    "evaluating",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// 1. Resolve landing page via browser-exec
	country := "US"
	if len(targetCountries) > 0 {
		country = targetCountries[0]
	}

	browserResp, err := s.callBrowserExec(ctx, originalURL, country)
	if err != nil {
		result.Status = "failed"
		result.ErrorMessage = fmt.Sprintf("Failed to resolve landing page: %v", err)
		return result, err
	}

	// 2. Populate result from browser response
	result.BrandName = browserResp.BrandName
	result.FinalURL = browserResp.FinalURL
	result.FinalURLSuffix = browserResp.FinalURLSuffix
	result.Domain = browserResp.Domain

	// Convert redirect chain
	result.RedirectChain = make([]RedirectStep, 0)
	for _, step := range browserResp.RedirectChain {
		if urlStr, ok := step["url"].(string); ok {
			timestamp := time.Now()
			if ts, ok := step["timestamp"].(string); ok {
				if parsed, err := time.Parse(time.RFC3339, ts); err == nil {
					timestamp = parsed
				}
			}
			result.RedirectChain = append(result.RedirectChain, RedirectStep{
				URL:       urlStr,
				Timestamp: timestamp,
			})
		}
	}

	// 3. Query SimilarWeb data (with cache)
	similarWebData, err := s.querySimilarWebWithCache(ctx, browserResp.Domain)
	if err != nil {
		// Non-fatal: continue with partial evaluation
		result.SimilarWebData = nil
	} else {
		result.SimilarWebData = similarWebData
	}

	// 4. Calculate score
	score := s.calculateScore(similarWebData, browserResp)
	result.Score = score

	// 5. Generate insights
	insights := s.generateInsights(similarWebData, browserResp, score)
	result.Insights = insights

	result.Status = "completed"
	result.UpdatedAt = time.Now()

	return result, nil
}

// callBrowserExec calls the browser-exec service to evaluate an offer
func (s *EvaluationServiceV2) callBrowserExec(ctx context.Context, offerURL, targetCountry string) (*BrowserEvalResponse, error) {
	if globalServiceRegistry == nil {
		return nil, fmt.Errorf("service registry not initialized")
	}

	// Prepare request body
	reqBody := map[string]interface{}{
		"url":           offerURL,
		"targetCountry": targetCountry,
		"timeoutMs":     30000,
		"waitUntil":     "networkidle",
	}

	// Add proxy provider URL based on target country
	proxyURL := os.Getenv(fmt.Sprintf("PROXY_URL_%s", targetCountry))
	if proxyURL == "" {
		proxyURL = os.Getenv("PROXY_URL_US") // Default to US proxy
	}
	if proxyURL != "" {
		reqBody["proxyProviderURL"] = proxyURL
	}

	var browserResp BrowserEvalResponse
	err := globalServiceRegistry.CallJSON(ctx, "browser-exec", serviceclient.Request{
		Method: http.MethodPost,
		Path:   "/api/v1/browser/evaluate-offer",
		Body:   reqBody,
	}, &browserResp)

	if err != nil {
		return nil, fmt.Errorf("browser-exec request failed: %w", err)
	}

	if browserResp.Error != nil {
		return nil, fmt.Errorf("browser-exec error: %s - %s", browserResp.Error.Code, browserResp.Error.Message)
	}

	if !browserResp.OK {
		return nil, fmt.Errorf("browser-exec returned ok=false")
	}

	return &browserResp, nil
}

// querySimilarWebWithCache queries SimilarWeb API with Redis caching
func (s *EvaluationServiceV2) querySimilarWebWithCache(ctx context.Context, domain string) (*SimilarWebData, error) {
	cacheKey := fmt.Sprintf("similarweb:%s", domain)

	// Check cache first
	cached, err := s.redisClient.Get(ctx, cacheKey).Result()
	if err == nil {
		var data SimilarWebData
		if json.Unmarshal([]byte(cached), &data) == nil {
			return &data, nil
		}
	}

	// Query API
	apiURL := fmt.Sprintf("https://data.similarweb.com/api/v1/data?domain=%s", domain)
	req, _ := http.NewRequestWithContext(ctx, "GET", apiURL, nil)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("similarweb api request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("similarweb api returned status %d", resp.StatusCode)
	}

	var data SimilarWebData
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to decode similarweb response: %v", err)
	}

	// Cache for 24 hours
	jsonData, _ := json.Marshal(data)
	s.redisClient.Set(ctx, cacheKey, jsonData, 24*time.Hour)

	return &data, nil
}

// calculateScore calculates a 0-100 score based on multiple dimensions
func (s *EvaluationServiceV2) calculateScore(swData *SimilarWebData, browserResp *BrowserEvalResponse) float64 {
	var score float64

	if swData == nil {
		// Fallback score if SimilarWeb data unavailable
		return 50.0
	}

	// Traffic dimension (30%)
	trafficScore := normalizeTraffic(swData.GlobalRank, swData.MonthlyVisits)
	score += trafficScore * 0.3

	// Engagement dimension (20%)
	engagementScore := normalizeEngagement(swData.AvgVisitDuration, swData.BounceRate)
	score += engagementScore * 0.2

	// Country rank dimension (20%)
	countryScore := normalizeCountryRank(swData.CountryRank)
	score += countryScore * 0.2

	// Traffic sources diversity (15%)
	sourceScore := normalizeTrafficSources(swData.TrafficSources)
	score += sourceScore * 0.15

	// Landing page quality (15%)
	landingScore := analyzeLandingQualityV2(browserResp)
	score += landingScore * 0.15

	return math.Min(score*100, 100)
}

// generateInsights generates actionable insights
func (s *EvaluationServiceV2) generateInsights(swData *SimilarWebData, browserResp *BrowserEvalResponse, score float64) *Insights {
	recommendations := []string{}

	if swData != nil {
		if swData.BounceRate > 0.6 {
			recommendations = append(recommendations, "跳出率较高,建议优化落地页用户体验")
		}
		if swData.AvgVisitDuration < 60 {
			recommendations = append(recommendations, "用户停留时间较短,建议增强内容吸引力")
		}
		if len(swData.TrafficSources) > 0 {
			if searchPct, ok := swData.TrafficSources["search"]; ok && searchPct > 0.5 {
				recommendations = append(recommendations, "流量主要来自搜索引擎,建议投放搜索广告")
			}
		}
	}

	// Add recommendation based on redirect chain length
	if len(browserResp.RedirectChain) > 3 {
		recommendations = append(recommendations, "重定向链较长,可能影响转化率,建议优化链接")
	}

	if len(recommendations) == 0 {
		recommendations = append(recommendations, "建议进行小规模测试,观察转化率表现")
		recommendations = append(recommendations, "建议设置ROI目标,持续优化广告投放")
		recommendations = append(recommendations, "建议监控竞品动态,及时调整策略")
	}

	competitiveIntensity := "中等"
	if swData != nil && swData.GlobalRank < 10000 {
		competitiveIntensity = "高"
	} else if swData != nil && swData.GlobalRank > 100000 {
		competitiveIntensity = "低"
	}

	riskLevel := "中等"
	if score > 70 {
		riskLevel = "低"
	} else if score < 40 {
		riskLevel = "高"
	}

	return &Insights{
		OpportunityScore:     score,
		CompetitiveIntensity: competitiveIntensity,
		RiskLevel:            riskLevel,
		Recommendations:      recommendations,
	}
}

// analyzeLandingQualityV2 analyzes landing page quality from browser response
func analyzeLandingQualityV2(browserResp *BrowserEvalResponse) float64 {
	score := 0.5

	// Check if has meaningful content
	if len(browserResp.HTMLSnippet) > 10000 {
		score += 0.2
	}

	// Check if brand name extracted successfully
	if browserResp.BrandName != "Unknown" && browserResp.BrandName != "" {
		score += 0.3
	}

	return math.Min(score, 1.0)
}

// Helper function to extract clean domain
func extractDomainV2(urlStr string) string {
	parsed, err := url.Parse(urlStr)
	if err != nil {
		return ""
	}
	host := parsed.Hostname()
	// Remove www. prefix
	return strings.TrimPrefix(host, "www.")
}

// Helper function to extract brand name from HTML
func extractBrandNameV2(html, finalURL string) string {
	// Try to extract from <title> tag
	titleRe := regexp.MustCompile(`<title[^>]*>(.*?)</title>`)
	if matches := titleRe.FindStringSubmatch(html); len(matches) > 1 {
		title := strings.TrimSpace(matches[1])
		if title != "" {
			// Clean up title
			title = strings.Split(title, "|")[0]
			title = strings.Split(title, "-")[0]
			return strings.TrimSpace(title)
		}
	}

	// Fallback: use domain name
	domain := extractDomainV2(finalURL)
	parts := strings.Split(domain, ".")
	if len(parts) > 0 {
		return strings.Title(parts[0])
	}

	return "Unknown"
}
