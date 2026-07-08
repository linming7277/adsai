package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/xxrenzhe/autoads/pkg/errors"
	"github.com/xxrenzhe/autoads/pkg/metrics"
)

// updateOfferStatus handles PUT /api/v1/offers/{id}/status
// Allows users to manually update offer status with history tracking
func (h *Handler) updateOfferStatus(w http.ResponseWriter, r *http.Request, id, userID string) {
	var current string
	if err := h.QueryRowContext(r.Context(), `SELECT status FROM "Offer" WHERE id=$1 AND "userId"=$2`, id, userID).Scan(&current); err != nil {
		if err == sql.ErrNoRows {
			errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "offer not found", nil)
			return
		}
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", nil)
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}
	newStatus := strings.ToLower(strings.TrimSpace(body.Status))
	if newStatus == "" {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "status required", nil)
		return
	}
	allowed := map[string]bool{"opportunity": true, "evaluating": true, "simulating": true, "scaling": true, "declining": true, "archived": true, "optimizing": true}
	if !allowed[newStatus] {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "unsupported status", map[string]string{"status": newStatus})
		return
	}
	// update
	tx, err := h.BeginTx(r.Context(), &sql.TxOptions{})
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "begin tx failed", nil)
		return
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(r.Context(), `UPDATE "Offer" SET status=$1, updated_at=NOW() WHERE id=$2 AND userid=$3`, newStatus, id, userID); err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "update failed", map[string]string{"error": err.Error()})
		return
	}
	_, _ = tx.ExecContext(r.Context(), `INSERT INTO "OfferStatusHistory"(offer_id,user_id,from_status,to_status) VALUES ($1,$2,$3,$4)`, id, userID, current, newStatus)
	if err := tx.Commit(); err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "commit failed", map[string]string{"error": err.Error()})
		return
	}

	// Record offer status change metrics
	m := metrics.GetGlobalBusinessMetrics()
	offerType := "standard" // Default type, could be enhanced to read from offer metadata

	// Track completion and failure metrics
	if newStatus == "scaling" || newStatus == "optimizing" {
		// These statuses indicate successful offers
		m.RecordOfferCompleted(userID, offerType)
	} else if newStatus == "declining" || newStatus == "archived" {
		// These statuses indicate failed/terminated offers
		reason := fmt.Sprintf("status_change_%s_to_%s", current, newStatus)
		m.AddCounter(metrics.MetricOffersFailed, 1, map[string]string{
			"user_id": userID,
			"type":    offerType,
			"reason":  reason,
		})
	}

	// Invalidate cache after successful update
	if h.Cache != nil && h.Cache.Ready() {
		cacheKey := fmt.Sprintf("offer:v1:%s:%s", userID, id)
		h.Cache.Del(r.Context(), cacheKey)
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "offerId": id, "from": current, "to": newStatus})
}
