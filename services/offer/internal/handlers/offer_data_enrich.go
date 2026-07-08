package handlers

import (
	"context"
	"database/sql"
	"log"

	"github.com/lib/pq"
)

// enrichOffers enriches offers with favorites and evaluation summaries.
func (h *Handler) enrichOffers(ctx context.Context, userID string, offers []*Offer) {
	if h == nil {
		return
	}
	if len(offers) == 0 {
		return
	}

	ids := make([]string, 0, len(offers))
	for _, offer := range offers {
		if offer == nil || offer.ID == "" {
			continue
		}
		ids = append(ids, offer.ID)
	}
	if len(ids) == 0 {
		return
	}

	favorites, err := h.loadOfferFavorites(ctx, userID, ids)
	if err != nil {
		log.Printf("offer: failed to load favorites: %v", err)
		favorites = map[string]bool{}
	}

	summaries, err := h.loadLatestEvaluationSummaries(ctx, userID, ids)
	if err != nil {
		log.Printf("offer: failed to load latest evaluation summaries: %v", err)
		summaries = map[string]latestEvaluationSummary{}
	}

	for _, offer := range offers {
		if offer == nil {
			continue
		}

		offer.Favorite = favorites[offer.ID]

		if summary, ok := summaries[offer.ID]; ok {
			offer.LastEvaluatedAt = summary.CompletedAt
			offer.LastEvaluationType = summary.Type
			offer.LastEvaluationStatus = summary.Status

			if summary.AIScore != nil {
				score := *summary.AIScore
				offer.LastEvaluationScore = &score
			} else {
				offer.LastEvaluationScore = nil
			}

			if summary.Tokens > 0 {
				tokens := summary.Tokens
				offer.LastEvaluationTokens = &tokens
			} else {
				offer.LastEvaluationTokens = nil
			}
		} else {
			offer.LastEvaluatedAt = nil
			offer.LastEvaluationType = ""
			offer.LastEvaluationStatus = ""
			offer.LastEvaluationScore = nil
			offer.LastEvaluationTokens = nil
		}
	}
}

// loadOfferFavorites loads favorite status for multiple offers.
func (h *Handler) loadOfferFavorites(ctx context.Context, userID string, offerIDs []string) (map[string]bool, error) {
	if h == nil {
		return map[string]bool{}, nil
	}
	result := make(map[string]bool, len(offerIDs))
	if len(offerIDs) == 0 {
		return result, nil
	}

	rows, err := h.QueryContext(ctx, `
		SELECT offer_id, favorite
		FROM "OfferPreferences"
		WHERE user_id = $1 AND offer_id = ANY($2)
	`, userID, pq.Array(offerIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var offerID string
		var favorite sql.NullBool
		if err := rows.Scan(&offerID, &favorite); err != nil {
			return nil, err
		}
		result[offerID] = favorite.Valid && favorite.Bool
	}

	return result, rows.Err()
}

// loadLatestEvaluationSummaries loads the latest evaluation summary for each offer.
func (h *Handler) loadLatestEvaluationSummaries(ctx context.Context, userID string, offerIDs []string) (map[string]latestEvaluationSummary, error) {
	if h == nil {
		return map[string]latestEvaluationSummary{}, nil
	}
	summaries := make(map[string]latestEvaluationSummary, len(offerIDs))
	if len(offerIDs) == 0 {
		return summaries, nil
	}

	rows, err := h.QueryContext(ctx, `
		SELECT DISTINCT ON (offer_id)
		       offer_id,
		       evaluation_type,
		       status,
		       tokens_consumed,
		       completed_at,
		       ai_recommendation_score
		FROM offer_evaluations
		WHERE user_id = $1 AND offer_id = ANY($2)
		ORDER BY offer_id, COALESCE(completed_at, started_at) DESC
	`, userID, pq.Array(offerIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var offerID string
		var evalType, status string
		var tokens sql.NullInt64
		var completedAt sql.NullTime
		var aiScore sql.NullFloat64

		if err := rows.Scan(&offerID, &evalType, &status, &tokens, &completedAt, &aiScore); err != nil {
			return nil, err
		}

		summary := latestEvaluationSummary{
			Type:   evalType,
			Status: status,
		}

		if completedAt.Valid {
			summary.CompletedAt = &completedAt.Time
		}
		if tokens.Valid {
			summary.Tokens = int(tokens.Int64)
		}
		if aiScore.Valid {
			score := aiScore.Float64
			summary.AIScore = &score
		}

		summaries[offerID] = summary
	}

	return summaries, rows.Err()
}
