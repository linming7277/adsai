package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/xxrenzhe/autoads/pkg/errors"
	"github.com/xxrenzhe/autoads/pkg/middleware"
)

// getOffers retrieves the list of offers for the authenticated user from the read model.
func (h *Handler) getOffers(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok || userID == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized: User ID is missing", nil)
		return
	}

	// Parse query parameters for filtering, sorting, and pagination
	query := r.URL.Query()
	status := query.Get("status")
	search := query.Get("search")
	sortBy := query.Get("sortBy")
	sortOrder := query.Get("sortOrder")
	pageStr := query.Get("page")
	limitStr := query.Get("limit")
	cursor := query.Get("cursor") // P3-4: Cursor-based pagination

	// Set defaults
	page := 1
	limit := 1000 // Default: return all (backward compatible)

	if pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	// P3-4: Use cursor-based pagination if cursor parameter is provided
	if cursor != "" {
		results, nextCursor, hasMore, err := h.listModernOffersCursor(r.Context(), userID, cursor, limit, status, search)
		if err != nil {
			log.Printf("listModernOffersCursor error: %v", err)
			errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Failed to fetch offers", nil)
			return
		}

		response := map[string]interface{}{
			"data":       results,
			"nextCursor": nextCursor,
			"hasMore":    hasMore,
			"limit":      limit,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// If any filter/sort/pagination parameters are present, use filtered endpoint
	if status != "" || search != "" || sortBy != "" || pageStr != "" || limitStr != "" {
		results, totalCount, err := h.listModernOffersFiltered(r.Context(), userID, status, search, sortBy, sortOrder, page, limit)
		if err != nil {
			log.Printf("listModernOffersFiltered error: %v", err)
			errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Failed to fetch offers", nil)
			return
		}

		// Calculate pagination metadata
		totalPages := (totalCount + limit - 1) / limit
		hasMore := page < totalPages

		response := map[string]interface{}{
			"items": results,
			"pagination": map[string]interface{}{
				"page":       page,
				"limit":      limit,
				"totalCount": totalCount,
				"totalPages": totalPages,
				"hasMore":    hasMore,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// Legacy behavior: return all offers without pagination
	offers, err := h.listModernOffers(r.Context(), userID)
	if err != nil {
		if isUndefinedTableErr(err) {
			log.Printf("modernOffers table not yet ready, falling back to legacy Offer table")
			// Fallback to legacy "Offer" table if modern table doesn't exist yet
			rows, err := h.QueryContext(r.Context(), `
				SELECT id, "userId" AS "userId", name, "originalUrl" AS "originalUrl", status, siterankScore, created_at AS "createdAt", updated_at AS "updatedAt"
				FROM "Offer" WHERE "userId"=$1 ORDER BY created_at DESC
			`, userID)
			if err != nil {
				log.Printf("Offer query error: %v", err)
				errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
				return
			}
			defer rows.Close()

			legacyOffers := []Offer{}
			for rows.Next() {
				var o Offer
				var createdAt, updatedAt time.Time
				if err := rows.Scan(&o.ID, &o.UserID, &o.Name, &o.OriginalUrl, &o.Status, &o.SiterankScore, &createdAt, &updatedAt); err != nil {
					log.Printf("Offer scan error: %v", err)
					continue
				}
				o.CreatedAt = createdAt
				o.UpdatedAt = updatedAt
				legacyOffers = append(legacyOffers, o)
			}

			// Convert to frontend-expected format with items and total
			response := map[string]interface{}{
				"items":      legacyOffers,
				"total":      len(legacyOffers),
				"totalPages": 1,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
			return
		}
		log.Printf("listModernOffers error: %v", err)
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
		return
	}

	// Enrich offers with favorites and evaluation data
	if len(offers) > 0 {
		pointers := toOfferPointers(offers)
		h.enrichOffers(r.Context(), userID, pointers)
		// Convert back to values
		for i := range pointers {
			offers[i] = *pointers[i]
		}
	}

	// Convert to frontend-expected format with items and total
	response := map[string]interface{}{
		"items":      offers,
		"total":      len(offers),
		"totalPages": 1, // TODO: Implement proper pagination
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
