package domain

import (
	"time"
)

// Offer represents a user's offer in the system.
type Offer struct {
	ID              string   `json:"id"`
	UserID          string   `json:"userId"`
	Name            string   `json:"name"`            // 品牌名
	OriginalURL     string   `json:"originalUrl"`     // Offer URL
	TargetCountries []string `json:"targetCountries"` // 投放国家列表
	Status          string   `json:"status"`          // "evaluating", "optimizing", "scaling", "archived"

	// 评估相关
	EvaluationStatus string   `json:"evaluationStatus"` // "not_evaluated", "evaluating", "evaluated", "failed"
	SiterankScore    *float64 `json:"siterankScore,omitempty"`
	FinalURL         string   `json:"finalUrl"`       // 最终落地页URL
	FinalURLSuffix   string   `json:"finalUrlSuffix"` // URL参数
	Domain           string   `json:"domain"`         // 域名

	// 仿真相关
	SimulationStatus string `json:"simulationStatus"` // "not_simulated", "simulating", "simulated", "failed"

	// 投放相关
	LaunchStatus string `json:"launchStatus"` // "not_launched", "launching", "launched", "paused"

	// KPI指标(7日汇总)
	Impressions int64   `json:"impressions"` // 曝光量
	Clicks      int64   `json:"clicks"`      // 点击量
	CTR         float64 `json:"ctr"`         // 点击率
	AvgCPC      float64 `json:"avgCpc"`      // 平均CPC

	// 收入产出
	TotalRevenue float64 `json:"totalRevenue"` // 总收入
	AdSpend      float64 `json:"adSpend"`      // 广告支出
	ROAS         float64 `json:"roas"`         // 广告支出回报率

	// 关联
	LinkedAccountIDs []string `json:"linkedAccountIds"` // 关联的Ads账号

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Revenue represents a revenue record for an offer
type Revenue struct {
	ID        string    `json:"id"`
	OfferID   string    `json:"offerId"`
	Amount    float64   `json:"amount"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// NewOffer creates a new offer with a default "evaluating" status.
func NewOffer(id, userID, name, originalURL string, targetCountries []string) *Offer {
	now := time.Now()
	if len(targetCountries) == 0 {
		targetCountries = []string{"US"}
	}
	return &Offer{
		ID:               id,
		UserID:           userID,
		Name:             name,
		OriginalURL:      originalURL,
		TargetCountries:  targetCountries,
		Status:           "evaluating",
		EvaluationStatus: "not_evaluated",
		SimulationStatus: "not_simulated",
		LaunchStatus:     "not_launched",
		LinkedAccountIDs: []string{},
		CreatedAt:        now,
		UpdatedAt:        now,
	}
}

// UpdateSiterankScore updates the offer's Siterank score and status.
func (o *Offer) UpdateSiterankScore(score float64) {
	o.SiterankScore = &score
	o.Status = "optimizing"
	o.UpdatedAt = time.Now()
}

// Archive archives the offer.
func (o *Offer) Archive() {
	o.Status = "archived"
	o.UpdatedAt = time.Now()
}

// StartEvaluation marks the offer as being evaluated
func (o *Offer) StartEvaluation() {
	o.EvaluationStatus = "evaluating"
	o.UpdatedAt = time.Now()
}

// CompleteEvaluation marks the evaluation as completed and updates related fields
func (o *Offer) CompleteEvaluation(score float64, finalURL, domain, brandName string) {
	o.EvaluationStatus = "evaluated"
	o.SiterankScore = &score
	o.FinalURL = finalURL
	o.Domain = domain
	if o.Name == "" || o.Name == "Unnamed" {
		o.Name = brandName
	}
	o.UpdatedAt = time.Now()
}

// FailEvaluation marks the evaluation as failed
func (o *Offer) FailEvaluation() {
	o.EvaluationStatus = "failed"
	o.UpdatedAt = time.Now()
}

// UpdateTargetCountries updates the target countries
func (o *Offer) UpdateTargetCountries(countries []string) {
	o.TargetCountries = countries
	o.UpdatedAt = time.Now()
}

// UpdateName updates the offer name (brand name)
func (o *Offer) UpdateName(name string) {
	o.Name = name
	o.UpdatedAt = time.Now()
}

// AddRevenue adds revenue to the total
func (o *Offer) AddRevenue(amount float64) {
	o.TotalRevenue += amount
	o.calculateROAS()
	o.UpdatedAt = time.Now()
}

// RemoveRevenue removes revenue from the total
func (o *Offer) RemoveRevenue(amount float64) {
	o.TotalRevenue -= amount
	if o.TotalRevenue < 0 {
		o.TotalRevenue = 0
	}
	o.calculateROAS()
	o.UpdatedAt = time.Now()
}

// UpdateKPIs updates the KPI metrics
func (o *Offer) UpdateKPIs(impressions, clicks int64, adSpend float64) {
	o.Impressions = impressions
	o.Clicks = clicks
	o.AdSpend = adSpend

	if impressions > 0 {
		o.CTR = float64(clicks) / float64(impressions)
	}
	if clicks > 0 {
		o.AvgCPC = adSpend / float64(clicks)
	}
	o.calculateROAS()
	o.UpdatedAt = time.Now()
}

// calculateROAS calculates ROAS based on current revenue and ad spend
func (o *Offer) calculateROAS() {
	if o.AdSpend > 0 {
		o.ROAS = o.TotalRevenue / o.AdSpend
	} else {
		o.ROAS = 0
	}
}
