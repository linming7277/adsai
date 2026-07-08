package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	apperr "github.com/xxrenzhe/autoads/pkg/errors"
	"github.com/xxrenzhe/autoads/pkg/middleware"
)

// DemoInitializeRequest represents demo initialization request
type DemoInitializeRequest struct {
	Modules []string `json:"modules"`
}

// DemoInitializeResponse represents demo initialization response
type DemoInitializeResponse struct {
	Success            bool           `json:"success"`
	InitializedModules []string       `json:"initialized_modules"`
	SkippedModules     []string       `json:"skipped_modules"`
	DemoCounts         map[string]int `json:"demo_counts"`
}

// DemoStatusResponse represents demo status response
type DemoStatusResponse struct {
	Modules map[string]DemoModuleStatus `json:"modules"`
}

// DemoModuleStatus represents status for a single module
type DemoModuleStatus struct {
	HasRealData bool `json:"has_real_data"`
	DemoCount   int  `json:"demo_count"`
	RealCount   int  `json:"real_count"`
}

// HandleInitializeDemoData initializes demo data for a new user
func (h *Handler) HandleInitializeDemoData(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 支持两种认证方式:
	// 1. JWT认证 (frontend调用)
	// 2. X-User-ID header (内部服务调用)
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		// 尝试从header获取userID (内部服务调用)
		userID = r.Header.Get("X-User-ID")
		if userID == "" {
			apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
			return
		}
	}

	var req DemoInitializeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "BAD_REQUEST", "invalid request body", nil)
		return
	}

	// Default modules if not specified
	if len(req.Modules) == 0 {
		req.Modules = []string{"offers"}
	}

	resp := DemoInitializeResponse{
		Success:            true,
		InitializedModules: []string{},
		SkippedModules:     []string{},
		DemoCounts:         make(map[string]int),
	}

	for _, module := range req.Modules {
		switch module {
		case "offers":
			hasReal, err := h.hasRealOffers(ctx, userID)
			if err != nil {
				log.Printf("Error checking real offers: %v", err)
				apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "failed to check offers", nil)
				return
			}

			if hasReal {
				resp.SkippedModules = append(resp.SkippedModules, "offers")
			} else {
				count, err := h.createDemoOffers(ctx, userID)
				if err != nil {
					log.Printf("Error creating demo offers: %v", err)
					apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "failed to create demo offers", nil)
					return
				}
				resp.InitializedModules = append(resp.InitializedModules, "offers")
				resp.DemoCounts["offers"] = count
			}
		default:
			log.Printf("Unknown module: %s", module)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// HandleGetDemoStatus returns demo data status for current user
func (h *Handler) HandleGetDemoStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := middleware.GetUserIDFromContext(ctx)
	if !ok {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized", nil)
		return
	}

	resp := DemoStatusResponse{
		Modules: make(map[string]DemoModuleStatus),
	}

	// Check offers status
	hasReal, err := h.hasRealOffers(ctx, userID)
	if err != nil {
		log.Printf("Error checking real offers: %v", err)
		apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "failed to check offers", nil)
		return
	}

	demoCount, realCount, err := h.getOfferCounts(ctx, userID)
	if err != nil {
		log.Printf("Error getting offer counts: %v", err)
		apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "failed to get offer counts", nil)
		return
	}

	resp.Modules["offers"] = DemoModuleStatus{
		HasRealData: hasReal,
		DemoCount:   demoCount,
		RealCount:   realCount,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// hasRealOffers checks if user has any real (non-demo) offers
func (h *Handler) hasRealOffers(ctx context.Context, userID string) (bool, error) {
	var count int
	query := `SELECT COUNT(*) FROM offers WHERE user_id = $1 AND is_demo = FALSE`
	err := h.QueryRowContext(ctx, query, userID).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("query real offers: %w", err)
	}
	return count > 0, nil
}

// getOfferCounts returns demo and real offer counts for user
func (h *Handler) getOfferCounts(ctx context.Context, userID string) (int, int, error) {
	var demoCount, realCount int

	query := `SELECT COUNT(*) FROM offers WHERE user_id = $1 AND is_demo = TRUE`
	if err := h.QueryRowContext(ctx, query, userID).Scan(&demoCount); err != nil {
		return 0, 0, fmt.Errorf("query demo offers: %w", err)
	}

	query = `SELECT COUNT(*) FROM offers WHERE user_id = $1 AND is_demo = FALSE`
	if err := h.QueryRowContext(ctx, query, userID).Scan(&realCount); err != nil {
		return 0, 0, fmt.Errorf("query real offers: %w", err)
	}

	return demoCount, realCount, nil
}

// createDemoOffers creates 8 demo offers for the user
func (h *Handler) createDemoOffers(ctx context.Context, userID string) (int, error) {
	now := time.Now()
	demoOffers := []struct {
		Name         string
		Brand        string
		Country      string
		URL          string
		Revenue      int
		ROAS         float64
		Clicks       int
		Conversions  int
		CTR          float64
		AIScore      float64
		DemoCategory string
		Status       string
		EvalStatus   string
	}{
		{
			Name: "Nike Summer Sale Campaign", Brand: "Nike", Country: "US",
			URL: "https://demo.example.com/nike-summer", Revenue: 250000, ROAS: 4.2,
			Clicks: 15000, Conversions: 1200, CTR: 0.08, AIScore: 92,
			DemoCategory: "success", Status: "scaling", EvalStatus: "evaluated",
		},
		{
			Name: "Amazon Prime Day Electronics", Brand: "Amazon", Country: "US",
			URL: "https://demo.example.com/amazon-prime", Revenue: 180000, ROAS: 3.8,
			Clicks: 12500, Conversions: 950, CTR: 0.076, AIScore: 88,
			DemoCategory: "success", Status: "scaling", EvalStatus: "evaluated",
		},
		{
			Name: "Apple iPhone 15 Launch", Brand: "Apple", Country: "US",
			URL: "https://demo.example.com/iphone15", Revenue: 320000, ROAS: 5.1,
			Clicks: 18000, Conversions: 1500, CTR: 0.083, AIScore: 95,
			DemoCategory: "success", Status: "scaling", EvalStatus: "evaluated",
		},
		{
			Name: "Adidas Fall Collection", Brand: "Adidas", Country: "US",
			URL: "https://demo.example.com/adidas-fall", Revenue: 0, ROAS: 0,
			Clicks: 0, Conversions: 0, CTR: 0, AIScore: 85,
			DemoCategory: "pending", Status: "optimizing", EvalStatus: "evaluated",
		},
		{
			Name: "Samsung Galaxy Launch", Brand: "Samsung", Country: "US",
			URL: "https://demo.example.com/samsung-galaxy", Revenue: 0, ROAS: 0,
			Clicks: 0, Conversions: 0, CTR: 0, AIScore: 87,
			DemoCategory: "pending", Status: "optimizing", EvalStatus: "evaluated",
		},
		{
			Name: "Sony PlayStation Deals", Brand: "Sony", Country: "US",
			URL: "https://demo.example.com/sony-playstation", Revenue: 0, ROAS: 0,
			Clicks: 0, Conversions: 0, CTR: 0, AIScore: 0,
			DemoCategory: "pending", Status: "evaluating", EvalStatus: "evaluating",
		},
		{
			Name: "Microsoft Surface Promo", Brand: "Microsoft", Country: "US",
			URL: "https://demo.example.com/microsoft-surface", Revenue: 0, ROAS: 0,
			Clicks: 0, Conversions: 0, CTR: 0, AIScore: 0,
			DemoCategory: "failed", Status: "evaluating", EvalStatus: "failed",
		},
		{
			Name: "Dell Laptop Campaign (Archived)", Brand: "Dell", Country: "US",
			URL: "https://demo.example.com/dell-laptop", Revenue: 150000, ROAS: 3.2,
			Clicks: 10000, Conversions: 800, CTR: 0.07, AIScore: 82,
			DemoCategory: "archived", Status: "archived", EvalStatus: "evaluated",
		},
	}

	insertQuery := `
		INSERT INTO offers (
			id, user_id, name, original_url, status, evaluation_status,
			domain, impressions, clicks, ctr, total_revenue, roas,
			siterank_score, is_demo, demo_category,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
		)`

	count := 0
	for _, offer := range demoOffers {
		offerID := uuid.New().String()
		impressions := int64(offer.Clicks) * 100 // Simple calculation

		_, err := h.ExecContext(ctx, insertQuery,
			offerID, userID, offer.Name, offer.URL, offer.Status, offer.EvalStatus,
			"demo.example.com", impressions, offer.Clicks, offer.CTR, offer.Revenue, offer.ROAS,
			offer.AIScore, true, offer.DemoCategory,
			now, now,
		)
		if err != nil {
			return count, fmt.Errorf("insert demo offer %s: %w", offer.Name, err)
		}
		count++
	}

	log.Printf("Created %d demo offers for user %s", count, userID)
	return count, nil
}
