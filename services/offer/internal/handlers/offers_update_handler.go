package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/xxrenzhe/autoads/pkg/errors"
)

// updateOffer handles PUT /api/v1/offers/{id}
func (h *Handler) updateOffer(w http.ResponseWriter, r *http.Request, id, userID string) {
	var body struct {
		Name        *string `json:"name"`
		OriginalUrl *string `json:"originalUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}
	if body.Name == nil && body.OriginalUrl == nil {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "no fields to update", nil)
		return
	}
	// Build dynamic update
	set := []string{}
	args := []any{}
	idx := 1
	if body.Name != nil {
		set = append(set, fmt.Sprintf("name=$%d", idx))
		args = append(args, strings.TrimSpace(*body.Name))
		idx++
	}
	if body.OriginalUrl != nil {
		v := strings.TrimSpace(*body.OriginalUrl)
		if v == "" {
			errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "originalUrl cannot be empty", nil)
			return
		}
		set = append(set, fmt.Sprintf("originalurl=$%d", idx))
		args = append(args, v)
		idx++
	}
	// append id,user
	args = append(args, id, userID)
	q := fmt.Sprintf(`UPDATE "Offer" SET %s, updated_at=NOW() WHERE id=$%d AND "userId"=$%d`, strings.Join(set, ", "), idx, idx+1)
	res, err := h.ExecContext(r.Context(), q, args...)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "update failed", map[string]string{"error": err.Error()})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "offer not found", nil)
		return
	}
	// return updated
	var o Offer
	var createdAt time.Time
	err = h.QueryRowContext(r.Context(), `
		SELECT id, "userId" AS "userId", name, "originalUrl" AS "originalUrl", status, siterankScore, created_at AS "createdAt"
		FROM "Offer" WHERE id=$1 AND "userId"=$2
	`, id, userID).Scan(&o.ID, &o.UserID, &o.Name, &o.OriginalUrl, &o.Status, &o.SiterankScore, &createdAt)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "reload failed", map[string]string{"error": err.Error()})
		return
	}
	o.CreatedAt = createdAt
	// Invalidate cache after successful update
	if h.Cache != nil && h.Cache.Ready() {
		cacheKey := fmt.Sprintf("offer:v1:%s:%s", userID, id)
		h.Cache.Del(r.Context(), cacheKey)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(o)
}
