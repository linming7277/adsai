package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"github.com/lib/pq"
)

// rowScanner interface for scanning database rows
type rowScanner interface {
	Scan(dest ...any) error
}

// listModernOffers retrieves all offers for a user from the modern offers table.
func (h *Handler) listModernOffers(ctx context.Context, userID string) ([]Offer, error) {
	rows, err := h.QueryContext(ctx, queryModernOffersList, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	offers := make([]Offer, 0)
	for rows.Next() {
		offer, err := h.scanModernOffer(ctx, rows)
		if err != nil {
			return nil, err
		}
		offers = append(offers, offer)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return offers, nil
}

// fetchModernOffer retrieves a single offer by ID for a user.
func (h *Handler) fetchModernOffer(ctx context.Context, id, userID string) (*Offer, error) {
	row := h.QueryRowContext(ctx, queryModernOfferByID, id, userID)
	offer, err := h.scanModernOffer(ctx, row)
	if err != nil {
		return nil, err
	}
	h.enrichOffers(ctx, userID, []*Offer{&offer})
	return &offer, nil
}

// scanModernOffer scans a database row into an Offer struct.
func (h *Handler) scanModernOffer(ctx context.Context, scanner rowScanner) (Offer, error) {
	var (
		o             Offer
		title         sql.NullString
		landing       sql.NullString
		status        sql.NullString
		brand         sql.NullString
		ai            sql.NullFloat64
		metadataBytes []byte
		created       time.Time
		updated       time.Time
	)

	if err := scanner.Scan(&o.ID, &o.UserID, &title, &landing, &status, &brand, &ai, &metadataBytes, &created, &updated); err != nil {
		return Offer{}, err
	}

	if title.Valid {
		o.Name = strings.TrimSpace(title.String)
	}
	if landing.Valid {
		o.OriginalUrl = strings.TrimSpace(landing.String)
	}
	if status.Valid {
		o.Status = strings.TrimSpace(status.String)
	}
	if brand.Valid {
		o.BrandName = strings.TrimSpace(brand.String)
	}
	if o.Name == "" {
		o.Name = o.BrandName
	}
	if o.BrandName == "" {
		o.BrandName = o.Name
	}
	if o.Status == "" {
		o.Status = "evaluating"
	}
	if ai.Valid {
		score := ai.Float64
		o.SiterankScore = &score
	}

	if len(metadataBytes) > 0 {
		var meta map[string]any
		if err := json.Unmarshal(metadataBytes, &meta); err == nil {
			if v, ok := meta["country"].(string); ok {
				o.Country = strings.ToUpper(strings.TrimSpace(v))
			}
		}
	}

	if o.Country == "" {
		o.Country = "--"
	}

	o.CreatedAt = created
	o.UpdatedAt = updated

	derived, reason := h.deriveStatus(ctx, o.Status, o.SiterankScore, o.CreatedAt)
	o.DerivedStatus = derived
	o.StatusReason = reason

	return o, nil
}

// fetchOfferAccountIDs retrieves account IDs associated with an offer.
func (h *Handler) fetchOfferAccountIDs(ctx context.Context, offerID, userID string) ([]string, error) {
	rows, err := h.QueryContext(ctx, `
		SELECT account_id
		FROM "OfferAccountMap"
		WHERE offer_id=$1 AND user_id=$2
	`, offerID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accountIDs []string
	for rows.Next() {
		var acct string
		if err := rows.Scan(&acct); err != nil {
			return nil, err
		}
		acct = strings.TrimSpace(acct)
		if acct != "" {
			accountIDs = append(accountIDs, acct)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return accountIDs, nil
}

// loadAccountsForOffers loads account mappings for multiple offers.
func (h *Handler) loadAccountsForOffers(ctx context.Context, offerIDs []string, owners map[string]string) (map[string][]string, error) {
	result := make(map[string][]string, len(offerIDs))
	if len(offerIDs) == 0 {
		return result, nil
	}

	rows, err := h.QueryContext(ctx, `
		SELECT offer_id, user_id, account_id
		FROM "OfferAccountMap"
		WHERE offer_id = ANY($1)
	`, pq.Array(offerIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var offerID, userID, accountID string
		if err := rows.Scan(&offerID, &userID, &accountID); err != nil {
			return nil, err
		}
		owner, ok := owners[offerID]
		if !ok || owner != userID {
			continue
		}
		acct := strings.TrimSpace(accountID)
		if acct == "" {
			continue
		}
		result[offerID] = append(result[offerID], acct)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}
