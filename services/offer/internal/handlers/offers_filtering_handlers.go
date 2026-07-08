package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// listModernOffersFiltered returns filtered, sorted, and paginated offers from the modern table
func (h *Handler) listModernOffersFiltered(ctx context.Context, userID, status, search, sortBy, sortOrder string, page, limit int) ([]map[string]interface{}, int, error) {
	// Build WHERE clause
	whereClauses := []string{"user_id = $1"}
	args := []interface{}{userID}
	argIdx := 2

	if status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(brand_name ILIKE $%d OR landing_page_url ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereClause := strings.Join(whereClauses, " AND ")

	// Build ORDER BY clause
	orderByClause := "created_at DESC" // Default
	if sortBy != "" {
		orderColumn := "created_at"
		switch sortBy {
		case "updatedAt":
			orderColumn = "updated_at"
		case "healthScore", "aiScore":
			orderColumn = "ai_score"
		case "createdAt":
			orderColumn = "created_at"
		}

		orderDirection := "DESC"
		if sortOrder == "asc" {
			orderDirection = "ASC"
		}

		orderByClause = fmt.Sprintf("%s %s", orderColumn, orderDirection)
	}

	// Count total matching records
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM public.offers WHERE %s", whereClause)
	var totalCount int
	if err := h.QueryRowContext(ctx, countQuery, args...).Scan(&totalCount); err != nil {
		return nil, 0, err
	}

	// Calculate offset
	offset := (page - 1) * limit

	// Build main query
	query := fmt.Sprintf(`
		SELECT id::text, user_id::text, title, landing_page_url, status, brand_name, ai_score, metadata, created_at, updated_at
		FROM public.offers
		WHERE %s
		ORDER BY %s
		LIMIT $%d OFFSET $%d
	`, whereClause, orderByClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := h.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	results := make([]map[string]interface{}, 0)
	for rows.Next() {
		var (
			id             string
			userID         string
			title          string
			landingPageURL string
			status         string
			brandName      sql.NullString
			aiScore        sql.NullFloat64
			metadata       sql.NullString
			createdAt      time.Time
			updatedAt      time.Time
		)

		if err := rows.Scan(&id, &userID, &title, &landingPageURL, &status, &brandName, &aiScore, &metadata, &createdAt, &updatedAt); err != nil {
			return nil, 0, err
		}

		item := map[string]interface{}{
			"id":          id,
			"userId":      userID,
			"name":        title,
			"originalUrl": landingPageURL,
			"status":      status,
			"brandName":   brandName.String,
			"createdAt":   createdAt,
			"updatedAt":   updatedAt,
		}

		if aiScore.Valid {
			item["healthScore"] = aiScore.Float64
		}

		results = append(results, item)
	}

	if err = rows.Err(); err != nil {
		return nil, 0, err
	}

	return results, totalCount, nil
}

// P3-4: listModernOffersCursor implements cursor-based pagination for efficient large dataset handling
// Returns: (results, nextCursor, hasMore, error)
func (h *Handler) listModernOffersCursor(ctx context.Context, userID, cursor string, limit int, status, search string) ([]map[string]interface{}, string, bool, error) {
	// Build WHERE clause
	whereClauses := []string{"user_id = $1"}
	args := []interface{}{userID}
	argIdx := 2

	// Parse cursor (RFC3339 timestamp) - "start" means fetch from the beginning
	var cursorTime time.Time
	if cursor != "" && cursor != "start" {
		var err error
		cursorTime, err = time.Parse(time.RFC3339, cursor)
		if err != nil {
			return nil, "", false, fmt.Errorf("invalid cursor format: %w", err)
		}
		whereClauses = append(whereClauses, fmt.Sprintf("created_at < $%d", argIdx))
		args = append(args, cursorTime)
		argIdx++
	}

	// Add status filter
	if status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	// Add search filter
	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(brand_name ILIKE $%d OR landing_page_url ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereClause := strings.Join(whereClauses, " AND ")

	// Fetch limit + 1 records to determine if there are more pages
	fetchLimit := limit + 1
	query := fmt.Sprintf(`
		SELECT id::text, user_id::text, title, landing_page_url, status, brand_name, ai_score, metadata, created_at, updated_at
		FROM public.offers
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d
	`, whereClause, argIdx)

	args = append(args, fetchLimit)

	rows, err := h.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, "", false, err
	}
	defer rows.Close()

	allResults := make([]map[string]interface{}, 0, fetchLimit)
	var lastCreatedAt time.Time

	for rows.Next() {
		var (
			id             string
			userID         string
			title          string
			landingPageURL string
			status         string
			brandName      sql.NullString
			aiScore        sql.NullFloat64
			metadata       sql.NullString
			createdAt      time.Time
			updatedAt      time.Time
		)

		if err := rows.Scan(&id, &userID, &title, &landingPageURL, &status, &brandName, &aiScore, &metadata, &createdAt, &updatedAt); err != nil {
			return nil, "", false, err
		}

		item := map[string]interface{}{
			"id":          id,
			"userId":      userID,
			"name":        title,
			"originalUrl": landingPageURL,
			"status":      status,
			"brandName":   brandName.String,
			"createdAt":   createdAt,
			"updatedAt":   updatedAt,
		}

		if aiScore.Valid {
			item["healthScore"] = aiScore.Float64
		}

		allResults = append(allResults, item)
		lastCreatedAt = createdAt
	}

	if err = rows.Err(); err != nil {
		return nil, "", false, err
	}

	// Determine if there are more pages
	hasMore := len(allResults) > limit

	// Return only up to limit records
	results := allResults
	if hasMore {
		results = allResults[:limit]
		// Use the last returned record's created_at as next cursor
		if lastItem, ok := results[len(results)-1]["createdAt"].(time.Time); ok {
			lastCreatedAt = lastItem
		}
	}

	// Generate next cursor
	var nextCursor string
	if hasMore && !lastCreatedAt.IsZero() {
		nextCursor = lastCreatedAt.Format(time.RFC3339)
	}

	return results, nextCursor, hasMore, nil
}
