package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/xxrenzhe/autoads/pkg/errors"
)

// getOfferAccounts handles GET /api/v1/offers/{id}/accounts
func (h *Handler) getOfferAccounts(w http.ResponseWriter, r *http.Request, id, userID string) {
	rows, err := h.QueryContext(r.Context(), `SELECT account_id FROM "OfferAccountMap" WHERE offer_id=$1 AND user_id=$2 ORDER BY account_id`, id, userID)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	type item struct {
		AccountId string `json:"accountId"`
	}
	var items []item
	for rows.Next() {
		var a string
		if err := rows.Scan(&a); err != nil {
			errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "scan failed", nil)
			return
		}
		items = append(items, item{AccountId: a})
	}
	if err := rows.Err(); err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "rows failed", nil)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct {
		Items []item `json:"items"`
	}{Items: items})
}

// addOfferAccount handles POST /api/v1/offers/{id}/accounts
func (h *Handler) addOfferAccount(w http.ResponseWriter, r *http.Request, id, userID string) {
	var body struct {
		AccountId string `json:"accountId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}
	acct := strings.TrimSpace(body.AccountId)
	if acct == "" {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "accountId required", nil)
		return
	}
	// basic sanity: digits only (Google Ads CID without dashes), but keep generic
	if _, err := h.ExecContext(r.Context(), `
		INSERT INTO "OfferAccountMap"(user_id, offer_id, account_id, linked_at) VALUES ($1,$2,$3,NOW())
		ON CONFLICT (offer_id, account_id) DO UPDATE SET user_id=EXCLUDED.user_id, linked_at=GREATEST("OfferAccountMap".linked_at, EXCLUDED.linked_at)
	`, userID, id, acct); err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "insert failed", map[string]string{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "offerId": id, "accountId": acct})
}

// deleteOfferAccount handles DELETE /api/v1/offers/{id}/accounts/{accountId}
func (h *Handler) deleteOfferAccount(w http.ResponseWriter, r *http.Request, id, userID, accountID string) {
	acct := strings.TrimSpace(accountID)
	if acct == "" {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "accountId required", nil)
		return
	}
	res, err := h.ExecContext(r.Context(), `DELETE FROM "OfferAccountMap" WHERE offer_id=$1 AND user_id=$2 AND account_id=$3`, id, userID, acct)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "delete failed", map[string]string{"error": err.Error()})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "mapping not found", nil)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
