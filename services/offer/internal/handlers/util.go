package handlers

import (
	"context"
	"encoding/json"
	"math"
	"os"
	"strings"
	"time"
)

// round2 rounds a float64 to 2 decimal places.
func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

// toJSON converts a map to JSON string.
func toJSON(m map[string]any) string {
	b, _ := json.Marshal(m)
	return string(b)
}

// getenv reads an environment variable with a fallback value.
func getenv(k string) string {
	v := os.Getenv(k)
	if v != "" {
		return v
	}
	switch k {
	case "OPENAI_API_KEY":
		return os.Getenv("OPENAI_API_KEY_FALLBACK")
	default:
		return ""
	}
}

// toOfferPointers converts a slice of Offer to []*Offer.
func toOfferPointers(offers []Offer) []*Offer {
	pointers := make([]*Offer, 0, len(offers))
	for i := range offers {
		pointers = append(pointers, &offers[i])
	}
	return pointers
}

// isUndefinedTableErr checks if error indicates missing offers table.
func isUndefinedTableErr(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "relation \"public.offers\" does not exist") ||
		strings.Contains(msg, "relation \"offers\" does not exist")
}

// deriveStatus calculates derived status and reason based on current status,
// SiterankScore, and creation time.
// Rules (MVP):
// - archived -> return archived directly
// - No score -> evaluating (reason: evaluation incomplete)
// - Score >=70: scaling; 40-69: simulating; <=20: declining; else: optimizing
// - Time consideration: created >30 days ago and score <=20, append "long-term low score"
func (h *Handler) deriveStatus(ctx context.Context, current string, siterank *float64, createdAt time.Time) (string, string) {
	if current == "archived" {
		return "archived", "已归档"
	}
	if siterank == nil {
		return "evaluating", "未完成评估"
	}
	score := *siterank
	var status, reason string
	switch {
	case score >= 70:
		status, reason = "scaling", "评分较高"
	case score >= 40:
		status, reason = "simulating", "评分一般"
	case score <= 20:
		status, reason = "declining", "评分偏低"
	default:
		status, reason = "optimizing", "评分中等"
	}
	// Check if created more than 30 days ago with low score
	if time.Since(createdAt) > 30*24*time.Hour && score <= 20 {
		reason = "创建已超过30天，评分持续偏低"
	}
	return status, reason
}
