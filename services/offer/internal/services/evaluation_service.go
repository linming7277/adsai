package services

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/playwright-community/playwright-go"
	"github.com/redis/go-redis/v9"
)

// EvaluationService handles offer evaluation logic
type EvaluationService struct {
	redisClient *redis.Client
	httpClient  *http.Client
}

// NewEvaluationService creates a new evaluation service
func NewEvaluationService(redisClient *redis.Client) *EvaluationService {
	return &EvaluationService{
		redisClient: redisClient,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// LandingPage represents the final landing page data
type LandingPage struct {
	FinalURL       string
	FinalURLSuffix string
	StatusCode     int
	RedirectChain  []RedirectStep
	HTML           string
	BrandName      string
}

// RedirectStep represents a redirect in the chain
type RedirectStep struct {
	URL        string    `json:"url"`
	StatusCode int       `json:"statusCode"`
	Timestamp  time.Time `json:"timestamp"`
}

// SimilarWebData represents SimilarWeb API response
type SimilarWebData struct {
	GlobalRank       int                    `json:"global_rank"`
	CountryRank      map[string]int         `json:"country_rank"`
	CategoryRank     int                    `json:"category_rank"`
	Category         string                 `json:"category"`
	MonthlyVisits    float64                `json:"monthly_visits"`
	AvgVisitDuration float64                `json:"avg_visit_duration"`
	BounceRate       float64                `json:"bounce_rate"`
	TrafficSources   map[string]float64     `json:"traffic_sources"`
	Extra            map[string]interface{} `json:"extra"`
}

// EvaluationResult represents the complete evaluation result
type EvaluationResult struct {
	OfferID        string          `json:"offerId"`
	Status         string          `json:"status"`
	Score          float64         `json:"score"`
	BrandName      string          `json:"brandName"`
	FinalURL       string          `json:"finalUrl"`
	FinalURLSuffix string          `json:"finalUrlSuffix"`
	Domain         string          `json:"domain"`
	SimilarWebData *SimilarWebData `json:"similarWebData"`
	RedirectChain  []RedirectStep  `json:"redirectChain"`
	Insights       *Insights       `json:"insights"`
	ErrorMessage   string          `json:"errorMessage,omitempty"`
	CreatedAt      time.Time       `json:"createdAt"`
	UpdatedAt      time.Time       `json:"updatedAt"`
}

// Insights represents AI-generated insights
type Insights struct {
	OpportunityScore     float64  `json:"opportunityScore"`
	CompetitiveIntensity string   `json:"competitiveIntensity"`
	RiskLevel            string   `json:"riskLevel"`
	Recommendations      []string `json:"recommendations"`
}

// EvaluateOffer performs full evaluation of an offer
func (s *EvaluationService) EvaluateOffer(ctx context.Context, offerID, originalURL string, targetCountries []string) (*EvaluationResult, error) {
	result := &EvaluationResult{
		OfferID:   offerID,
		Status:    "evaluating",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// 1. Resolve landing page
	country := "US"
	if len(targetCountries) > 0 {
		country = targetCountries[0]
	}

	landingPage, err := s.resolveLandingPage(ctx, originalURL, country)
	if err != nil {
		result.Status = "failed"
		result.ErrorMessage = fmt.Sprintf("Failed to resolve landing page: %v", err)
		return result, err
	}

	// 2. Extract domain
	domain := extractDomain(landingPage.FinalURL)
	result.BrandName = landingPage.BrandName
	result.FinalURL = landingPage.FinalURL
	result.FinalURLSuffix = landingPage.FinalURLSuffix
	result.Domain = domain
	result.RedirectChain = landingPage.RedirectChain

	// 3. Query SimilarWeb data (with cache)
	similarWebData, err := s.querySimilarWebWithCache(ctx, domain)
	if err != nil {
		// Non-fatal: continue with partial evaluation
		result.SimilarWebData = nil
	} else {
		result.SimilarWebData = similarWebData
	}

	// 4. Calculate score
	score := s.calculateScore(similarWebData, landingPage)
	result.Score = score

	// 5. Generate insights
	insights := s.generateInsights(similarWebData, landingPage, score)
	result.Insights = insights

	result.Status = "completed"
	result.UpdatedAt = time.Now()

	return result, nil
}

// resolveLandingPage resolves the final landing page URL through redirects
func (s *EvaluationService) resolveLandingPage(ctx context.Context, offerURL, country string) (*LandingPage, error) {
	pw, err := playwright.Run()
	if err != nil {
		return nil, fmt.Errorf("could not start playwright: %v", err)
	}
	defer pw.Stop()

	browser, err := pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
	})
	if err != nil {
		return nil, fmt.Errorf("could not launch browser: %v", err)
	}
	defer browser.Close()

	page, err := browser.NewPage(playwright.BrowserNewPageOptions{
		Locale:    playwright.String(countryToLocale(country)),
		UserAgent: playwright.String(getRandomUserAgent()),
	})
	if err != nil {
		return nil, fmt.Errorf("could not create page: %v", err)
	}

	// Track redirects
	redirectChain := []RedirectStep{}
	page.OnResponse(func(response playwright.Response) {
		status := response.Status()
		if status >= 300 && status < 400 {
			redirectChain = append(redirectChain, RedirectStep{
				URL:        response.URL(),
				StatusCode: status,
				Timestamp:  time.Now(),
			})
		}
	})

	// Block images and fonts to reduce traffic
	err = page.Route("**/*", func(route playwright.Route) {
		req := route.Request()
		resourceType := req.ResourceType()
		if resourceType == "image" || resourceType == "font" || resourceType == "media" {
			route.Abort()
		} else {
			route.Continue()
		}
	})
	if err != nil {
		return nil, fmt.Errorf("could not set route: %v", err)
	}

	// Navigate to page
	_, err = page.Goto(offerURL, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateNetworkidle,
		Timeout:   playwright.Float(30000),
	})
	if err != nil {
		return nil, fmt.Errorf("could not navigate to page: %v", err)
	}

	finalURL := page.URL()
	html, _ := page.Content()

	// Extract brand name from page
	brandName := extractBrandName(html, finalURL)

	// Extract URL suffix (query params)
	parsedURL, _ := url.Parse(finalURL)
	suffix := parsedURL.RawQuery

	return &LandingPage{
		FinalURL:       finalURL,
		FinalURLSuffix: suffix,
		StatusCode:     200,
		RedirectChain:  redirectChain,
		HTML:           html,
		BrandName:      brandName,
	}, nil
}

// querySimilarWebWithCache queries SimilarWeb API with Redis caching
func (s *EvaluationService) querySimilarWebWithCache(ctx context.Context, domain string) (*SimilarWebData, error) {
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
func (s *EvaluationService) calculateScore(swData *SimilarWebData, landing *LandingPage) float64 {
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
	landingScore := analyzeLandingQuality(landing)
	score += landingScore * 0.15

	return math.Min(score*100, 100)
}

// generateInsights generates actionable insights
func (s *EvaluationService) generateInsights(swData *SimilarWebData, landing *LandingPage, score float64) *Insights {
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

// Helper functions

func extractDomain(urlStr string) string {
	parsed, err := url.Parse(urlStr)
	if err != nil {
		return ""
	}
	host := parsed.Hostname()
	// Remove www. prefix
	return strings.TrimPrefix(host, "www.")
}

func extractBrandName(html, finalURL string) string {
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
	domain := extractDomain(finalURL)
	parts := strings.Split(domain, ".")
	if len(parts) > 0 {
		return strings.Title(parts[0])
	}

	return "Unknown"
}

func countryToLocale(country string) string {
	localeMap := map[string]string{
		"US": "en-US",
		"GB": "en-GB",
		"CA": "en-CA",
		"AU": "en-AU",
		"DE": "de-DE",
		"FR": "fr-FR",
		"ES": "es-ES",
		"IT": "it-IT",
		"JP": "ja-JP",
		"CN": "zh-CN",
	}
	if locale, ok := localeMap[country]; ok {
		return locale
	}
	return "en-US"
}

func getRandomUserAgent() string {
	userAgents := []string{
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	}
	return userAgents[time.Now().Unix()%int64(len(userAgents))]
}

// Normalization functions

func normalizeTraffic(globalRank int, monthlyVisits float64) float64 {
	if globalRank == 0 || globalRank > 1000000 {
		return 0.3
	}
	if globalRank <= 1000 {
		return 1.0
	}
	if globalRank <= 10000 {
		return 0.9
	}
	if globalRank <= 100000 {
		return 0.7
	}
	return 0.5
}

func normalizeEngagement(avgDuration, bounceRate float64) float64 {
	score := 0.5
	if avgDuration > 180 {
		score += 0.3
	} else if avgDuration > 60 {
		score += 0.15
	}
	if bounceRate < 0.4 {
		score += 0.2
	} else if bounceRate < 0.6 {
		score += 0.1
	}
	return math.Min(score, 1.0)
}

func normalizeCountryRank(countryRank map[string]int) float64 {
	if len(countryRank) == 0 {
		return 0.5
	}
	// Average country ranks
	var total, count int
	for _, rank := range countryRank {
		total += rank
		count++
	}
	avgRank := total / count
	if avgRank <= 1000 {
		return 1.0
	}
	if avgRank <= 10000 {
		return 0.8
	}
	if avgRank <= 50000 {
		return 0.6
	}
	return 0.4
}

func normalizeTrafficSources(sources map[string]float64) float64 {
	if len(sources) == 0 {
		return 0.5
	}
	// Diversity score: more balanced = higher score
	if len(sources) >= 4 {
		return 1.0
	}
	if len(sources) >= 3 {
		return 0.8
	}
	return 0.6
}

func analyzeLandingQuality(landing *LandingPage) float64 {
	score := 0.5
	// Check if has meaningful content
	if len(landing.HTML) > 10000 {
		score += 0.2
	}
	// Check if brand name extracted successfully
	if landing.BrandName != "Unknown" && landing.BrandName != "" {
		score += 0.3
	}
	return math.Min(score, 1.0)
}
