package handlers

import (
	"database/sql"
	"encoding/json"
	stdErrors "errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/xxrenzhe/autoads/pkg/errors"
)

// deleteOffer handles DELETE /api/v1/offers/{id}
func (h *Handler) deleteOffer(w http.ResponseWriter, r *http.Request, id, userID string) {
	res, err := h.ExecContext(r.Context(), `DELETE FROM "Offer" WHERE id=$1 AND userid=$2`, id, userID)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "delete failed", map[string]string{"error": err.Error()})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "offer not found", nil)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// getOfferByID handles GET /api/v1/offers/{id}
func (h *Handler) getOfferByID(w http.ResponseWriter, r *http.Request, id, userID string) {
	// Try cache first
	cacheKey := fmt.Sprintf("offer:v1:%s:%s", userID, id)
	if h.Cache != nil && h.Cache.Ready() {
		if cached, ok := h.Cache.Get(r.Context(), cacheKey); ok {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache", "HIT")
			w.Write([]byte(cached))
			return
		}
	}

	if modern, err := h.fetchModernOffer(r.Context(), id, userID); err == nil {
		// Write to cache (5 minutes TTL)
		if h.Cache != nil && h.Cache.Ready() {
			if data, err := json.Marshal(modern); err == nil {
				h.Cache.Set(r.Context(), cacheKey, string(data), 5*time.Minute)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "MISS")
		_ = json.NewEncoder(w).Encode(modern)
		return
	} else if err != nil && !isUndefinedTableErr(err) && !stdErrors.Is(err, sql.ErrNoRows) {
		log.Printf("fetchModernOffer failed: %v", err)
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
		return
	}

	var o Offer
	var createdAt time.Time
	err := h.QueryRowContext(r.Context(), `
		SELECT id, "userId" AS "userId", name, "originalUrl" AS "originalUrl", status, siterankScore, created_at AS "createdAt"
		FROM "Offer" WHERE id=$1 AND "userId"=$2
	`, id, userID).Scan(&o.ID, &o.UserID, &o.Name, &o.OriginalUrl, &o.Status, &o.SiterankScore, &createdAt)
	if err != nil {
		// Fallback to legacy lowercase column names
		err = h.QueryRowContext(r.Context(), `
			SELECT id, userid AS "userId", name, originalurl AS "originalUrl", status, NULL::DOUBLE PRECISION AS siterankScore, created_at AS "createdAt"
			FROM "Offer" WHERE id=$1 AND userid=$2
		`, id, userID).Scan(&o.ID, &o.UserID, &o.Name, &o.OriginalUrl, &o.Status, &o.SiterankScore, &createdAt)
	}
	if err != nil {
		if err == sql.ErrNoRows {
			errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "offer not found", nil)
			return
		}
		log.Printf("offerByID query error: %v", err)
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
		return
	}
	// v2：计算派生状态
	derived, reason := h.deriveStatus(r.Context(), o.Status, o.SiterankScore, createdAt)
	o.DerivedStatus = derived
	o.StatusReason = reason
	o.CreatedAt = createdAt
	o.Country = "--"

	// Write to cache (5 minutes TTL)
	if h.Cache != nil && h.Cache.Ready() {
		if data, err := json.Marshal(o); err == nil {
			h.Cache.Set(r.Context(), cacheKey, string(data), 5*time.Minute)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	_ = json.NewEncoder(w).Encode(o)
}
