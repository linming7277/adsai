package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/xxrenzhe/autoads/pkg/errors"
)

// getOfferPreferences handles GET /api/v1/offers/{id}/preferences
func (h *Handler) getOfferPreferences(w http.ResponseWriter, r *http.Request, id, userID string) {
	type prefs struct {
		AutoStatusEnabled bool `json:"autoStatusEnabled"`
		Favorite          bool `json:"favorite"`
		StatusRules       struct {
			ZeroPerfDays    int `json:"zeroPerfDays"`
			RoscDeclineDays int `json:"roscDeclineDays"`
		} `json:"statusRules,omitempty"`
	}
	// defaults
	p := prefs{AutoStatusEnabled: false}
	p.StatusRules.ZeroPerfDays = 5
	p.StatusRules.RoscDeclineDays = 7
	var (
		auto sql.NullBool
		zero sql.NullInt32
		rosc sql.NullInt32
		fav  sql.NullBool
	)
	err := h.QueryRowContext(r.Context(), `
		SELECT auto_status_enabled, zero_perf_days, rosc_decline_days, favorite
		FROM "OfferPreferences" WHERE offer_id=$1 AND user_id=$2
	`, id, userID).Scan(&auto, &zero, &rosc, &fav)
	if err == nil {
		if auto.Valid {
			p.AutoStatusEnabled = auto.Bool
		}
		if zero.Valid && zero.Int32 > 0 {
			p.StatusRules.ZeroPerfDays = int(zero.Int32)
		}
		if rosc.Valid && rosc.Int32 > 0 {
			p.StatusRules.RoscDeclineDays = int(rosc.Int32)
		}
		if fav.Valid {
			p.Favorite = fav.Bool
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(p)
}

// updateOfferPreferences handles PUT /api/v1/offers/{id}/preferences
func (h *Handler) updateOfferPreferences(w http.ResponseWriter, r *http.Request, id, userID string) {
	var body struct {
		AutoStatusEnabled *bool `json:"autoStatusEnabled"`
		Favorite          *bool `json:"favorite"`
		StatusRules       *struct {
			ZeroPerfDays    *int `json:"zeroPerfDays"`
			RoscDeclineDays *int `json:"roscDeclineDays"`
		} `json:"statusRules"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}
	// Load existing preferences to preserve unspecified fields
	current := struct {
		auto     bool
		zeroPerf int
		roscDecl int
		favorite bool
	}{
		auto:     false,
		zeroPerf: 5,
		roscDecl: 7,
		favorite: false,
	}

	var (
		existingAuto sql.NullBool
		existingZero sql.NullInt32
		existingRosc sql.NullInt32
		existingFav  sql.NullBool
	)

	err := h.QueryRowContext(r.Context(), `
		SELECT auto_status_enabled, zero_perf_days, rosc_decline_days, favorite
		FROM "OfferPreferences" WHERE user_id=$1 AND offer_id=$2
	`, userID, id).Scan(&existingAuto, &existingZero, &existingRosc, &existingFav)
	if err == nil {
		if existingAuto.Valid {
			current.auto = existingAuto.Bool
		}
		if existingZero.Valid && existingZero.Int32 > 0 {
			current.zeroPerf = int(existingZero.Int32)
		}
		if existingRosc.Valid && existingRosc.Int32 > 0 {
			current.roscDecl = int(existingRosc.Int32)
		}
		if existingFav.Valid {
			current.favorite = existingFav.Bool
		}
	}

	if body.AutoStatusEnabled != nil {
		current.auto = *body.AutoStatusEnabled
	}
	if body.StatusRules != nil {
		if body.StatusRules.ZeroPerfDays != nil && *body.StatusRules.ZeroPerfDays > 0 && *body.StatusRules.ZeroPerfDays <= 30 {
			current.zeroPerf = *body.StatusRules.ZeroPerfDays
		}
		if body.StatusRules.RoscDeclineDays != nil && *body.StatusRules.RoscDeclineDays > 0 && *body.StatusRules.RoscDeclineDays <= 30 {
			current.roscDecl = *body.StatusRules.RoscDeclineDays
		}
	}
	if body.Favorite != nil {
		current.favorite = *body.Favorite
	}

	if _, err := h.ExecContext(r.Context(), `
		INSERT INTO "OfferPreferences"(user_id, offer_id, auto_status_enabled, zero_perf_days, rosc_decline_days, favorite, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6, NOW())
		ON CONFLICT (user_id, offer_id) DO UPDATE SET
			auto_status_enabled=EXCLUDED.auto_status_enabled,
			zero_perf_days=EXCLUDED.zero_perf_days,
			rosc_decline_days=EXCLUDED.rosc_decline_days,
			favorite=EXCLUDED.favorite,
			updated_at=NOW()
	`, userID, id, current.auto, current.zeroPerf, current.roscDecl, current.favorite); err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "upsert failed", map[string]string{"error": err.Error()})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok"})
}
