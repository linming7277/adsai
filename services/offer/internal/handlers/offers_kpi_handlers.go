package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"hash/fnv"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/xxrenzhe/autoads/pkg/errors"
)

// getOfferKPI handles GET /api/v1/offers/{id}/kpi
// Returns 7-day KPI summary from OfferDailyKPI table, or synthetic data as fallback
func (h *Handler) getOfferKPI(w http.ResponseWriter, r *http.Request, id, userID string) {
	// Verify ownership quick
	var one int
	if err := h.QueryRowContext(r.Context(), `SELECT 1 FROM "Offer" WHERE id=$1 AND "userId"=$2`, id, userID).Scan(&one); err != nil {
		if err == sql.ErrNoRows {
			errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "offer not found", nil)
			return
		}
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", nil)
		return
	}

	// Try real KPI from read model first (OfferDailyKPI)
	type point struct {
		Date        string  `json:"date"`
		Impressions int64   `json:"impressions"`
		Clicks      int64   `json:"clicks"`
		Spend       float64 `json:"spend"`
		Revenue     float64 `json:"revenue"`
	}
	realPts := make([]point, 0, 7)
	var sumImpReal, sumClkReal int64
	var sumSpendReal, sumRevReal float64
	rows, err := h.QueryContext(r.Context(), `
        SELECT date, impressions, clicks, spend, revenue
        FROM "OfferDailyKPI"
        WHERE offer_id=$1 AND user_id=$2 AND date >= (CURRENT_DATE - INTERVAL '6 days')
        ORDER BY date ASC
    `, id, userID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var d time.Time
			var imp, clk int64
			var spend, rev float64
			if err := rows.Scan(&d, &imp, &clk, &spend, &rev); err != nil {
				break
			}
			sumImpReal += imp
			sumClkReal += clk
			sumSpendReal += spend
			sumRevReal += rev
			realPts = append(realPts, point{Date: d.Format("2006-01-02"), Impressions: imp, Clicks: clk, Spend: round2(spend), Revenue: round2(rev)})
		}
		if err := rows.Err(); err == nil && len(realPts) > 0 {
			rosc := 0.0
			if sumSpendReal > 0 {
				rosc = sumRevReal / sumSpendReal
			}
			out := map[string]any{
				"summary": map[string]any{
					"impressions": sumImpReal,
					"clicks":      sumClkReal,
					"spend":       round2(sumSpendReal),
					"revenue":     round2(sumRevReal),
					"rosc":        round2(rosc),
				},
				"days":      realPts,
				"updatedAt": time.Now().UTC().Format(time.RFC3339),
				"source":    "real",
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(out)
			return
		}
	}

	// Try Adscenter diagnose metrics (stub/live) for base values
	type dm struct {
		Impressions  int64   `json:"impressions"`
		CTR          float64 `json:"ctr"`
		QS           int     `json:"qualityScore"`
		DailyBudget  float64 `json:"dailyBudget"`
		BudgetPacing float64 `json:"budgetPacing"`
	}
	var base *dm
	if baseURL := strings.TrimRight(os.Getenv("ADSCENTER_URL"), "/"); baseURL != "" {
		ctx, cancel := context.WithTimeout(r.Context(), 1500*time.Millisecond)
		defer cancel()
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/api/v1/adscenter/diagnose/metrics?accountId="+url.QueryEscape(userID), nil)
		req.Header.Set("Accept", "application/json")
		req.Header.Set("X-User-Id", userID)
		if resp, err := http.DefaultClient.Do(req); err == nil && resp != nil {
			b, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
			_ = resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				var tmp dm
				if json.Unmarshal(b, &tmp) == nil {
					base = &tmp
				}
			}
		}
	}

	// Deterministic pseudo metrics by offer id (fallback or augment trend)
	hsh := fnv.New32a()
	_, _ = hsh.Write([]byte(id))
	seed := int64(hsh.Sum32())
	// helper to derive numbers
	f := func(mod, base int64) int64 {
		v := (seed%mod + base)
		if v < 0 {
			v = -v
		}
		return v
	}
	// last 7 days arrays
	days := 7
	pts := make([]point, 0, days)
	var sumImp, sumClk int64
	var sumSpend, sumRev float64
	now := time.Now().UTC()
	for i := days - 1; i >= 0; i-- {
		d := now.AddDate(0, 0, -i)
		var imp int64
		var clk int64
		var spend float64
		var rev float64
		if base != nil {
			// Use base impressions and ctr with small oscillation
			bimp := base.Impressions
			if bimp <= 0 {
				bimp = f(500, 200)
			}
			imp = bimp + int64(i*10) - int64((seed % 7))
			if imp < 10 {
				imp = 10
			}
			ctr := base.CTR
			if ctr <= 0 {
				ctr = 1.0
			}
			clk = int64(float64(imp) * (ctr / 100.0))
			if clk < 1 {
				clk = 1
			}
			if base.DailyBudget > 0 {
				spend = base.DailyBudget * (0.8 + float64((seed%20))/100.0)
			} else {
				spend = float64(imp) * (0.01 + float64((seed%3))/100.0)
			}
			// revenue scale by QS and pacing
			q := base.QS
			if q <= 0 {
				q = 6
			}
			scale := 0.6 + float64(q)/10.0 + base.BudgetPacing/2.0
			if scale < 0.5 {
				scale = 0.5
			}
			if scale > 2.0 {
				scale = 2.0
			}
			rev = spend * scale
		} else {
			imp = f(500, 200) + int64(i*10)
			clk = imp * (2 + int64(seed%5)) / 100 // 2-6% CTR
			spend = float64(imp) * (0.01 + float64((seed%3))/100.0)
			rev = spend * (0.8 + float64((seed%60))/100.0) // 0.8x-1.39x
		}
		sumImp += imp
		sumClk += clk
		sumSpend += spend
		sumRev += rev
		pts = append(pts, point{Date: d.Format("2006-01-02"), Impressions: imp, Clicks: clk, Spend: round2(spend), Revenue: round2(rev)})
	}
	rosc := 0.0
	if sumSpend > 0 {
		rosc = sumRev / sumSpend
	}
	out := map[string]any{
		"summary": map[string]any{
			"impressions": sumImp,
			"clicks":      sumClk,
			"spend":       round2(sumSpend),
			"revenue":     round2(sumRev),
			"rosc":        round2(rosc),
		},
		"days":      pts,
		"updatedAt": time.Now().UTC().Format(time.RFC3339),
		"source":    "synthetic",
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}
