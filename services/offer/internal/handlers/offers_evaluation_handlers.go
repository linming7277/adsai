package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/xxrenzhe/autoads/pkg/errors"
)

// handleEvaluateOffer handles POST /api/v1/offers/{id}/evaluate
// BE-036~BE-039: Enhanced with Billing integration and Pub/Sub publishing
func (h *Handler) handleEvaluateOffer(w http.ResponseWriter, r *http.Request, offerID, userID string) {
	ctx := r.Context()

	// 1. Parse request body
	var req struct {
		EnableAI     bool `json:"enableAI"`
		ForceRefresh bool `json:"forceRefresh"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid request body", nil)
		return
	}

	// 2. Check idempotency key
	idempotencyKey := r.Header.Get("Idempotency-Key")
	if idempotencyKey == "" {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "Idempotency-Key header required", nil)
		return
	}

	// 3. Check if already processing (use cache or database)
	cacheKey := fmt.Sprintf("eval:idempotency:%s", idempotencyKey)
	if h.Cache != nil && h.Cache.Ready() {
		if existing, found := h.Cache.Get(ctx, cacheKey); found {
			// Return cached response
			log.Printf("Evaluation request idempotent hit for key=%s", idempotencyKey)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusAccepted)
			w.Write([]byte(existing))
			return
		}
	}

	// 4. Initialize services
	orchestrator := NewEvaluationOrchestratorWithAdapter(h.Adapter, h.Publisher)
	authHeader := r.Header.Get("Authorization")

	// 5. Verify offer exists and belongs to user
	if err := orchestrator.VerifyOfferOwnership(ctx, offerID, userID); err != nil {
		if err.Error() == "database unavailable" {
			errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "database unavailable", nil)
		} else if err.Error() == "offer not found or does not belong to user" {
			errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "offer not found", nil)
		} else {
			errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "database error", map[string]string{"error": err.Error()})
		}
		return
	}

	// 6. Get token reservation from Gateway middleware (injected via header)
	// Gateway has already checked subscription, token balance, and reserved tokens
	reservationID := r.Header.Get("X-Token-Reservation-ID")
	if reservationID == "" {
		errors.Write(w, r, http.StatusBadRequest, "MISSING_RESERVATION", "Token reservation ID not found (should be injected by Gateway)", nil)
		return
	}

	// 7. Calculate token cost for this operation
	tokensRequired := CalculateTokensRequired(req.EnableAI)

	// 8. Create evaluation task
	evalReq := &EvaluationRequest{
		OfferID:        offerID,
		UserID:         userID,
		EnableAI:       req.EnableAI,
		ForceRefresh:   req.ForceRefresh,
		TokensReserved: tokensRequired,
		ReservationID:  reservationID,
		AuthToken:      authHeader,
	}

	response, err := orchestrator.CreateEvaluation(ctx, evalReq)
	if err != nil {
		log.Printf("Failed to create evaluation: %v", err)
		// Release tokens via Gateway internal API
		if err := h.releaseTokensViaGateway(ctx, authHeader, reservationID, tokensRequired, offerID, "evaluation_failed"); err != nil {
			log.Printf("Warning: Failed to release tokens: %v", err)
		}
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "failed to create evaluation", map[string]string{"error": err.Error()})
		return
	}

	// Note: Token commit will be handled by Siterank worker after evaluation completes
	// The worker will call Gateway's /internal/v1/tokens/commit endpoint

	// 12. Encode response
	responseJSON, err := json.Marshal(response)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "failed to encode response", nil)
		return
	}

	// 13. Cache the response (24 hour TTL for idempotency)
	if h.Cache != nil && h.Cache.Ready() {
		h.Cache.Set(ctx, cacheKey, string(responseJSON), 24*time.Hour)
	}

	// 14. Return response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	w.Write(responseJSON)
}

// handleGetEvaluations handles GET /api/v1/offers/{id}/evaluations
func (h *Handler) handleGetEvaluations(w http.ResponseWriter, r *http.Request, offerID, userID string) {
	ctx := r.Context()

	// 1. Parse optional query parameters
	limitStr := r.URL.Query().Get("limit")
	limit := 20 // default
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}

	// 2. Initialize orchestrator
	orchestrator := NewEvaluationOrchestratorWithAdapter(h.Adapter, h.Publisher)

	// 3. Verify offer exists and belongs to user
	if err := orchestrator.VerifyOfferOwnership(ctx, offerID, userID); err != nil {
		if err.Error() == "database unavailable" {
			errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "database unavailable", nil)
		} else if err.Error() == "offer not found or does not belong to user" {
			errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "offer not found", nil)
		} else {
			errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "database error", map[string]string{"error": err.Error()})
		}
		return
	}

	// 4. Query evaluation history
	evaluations, err := orchestrator.ListEvaluations(ctx, offerID, limit)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "database query error", map[string]string{"error": err.Error()})
		return
	}

	// 5. Return response
	response := map[string]interface{}{
		"items": evaluations,
		"count": len(evaluations),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// handleGetLatestEvaluation handles GET /api/v1/offers/{id}/evaluations/latest
// BE-041: Get the latest evaluation for an offer
func (h *Handler) handleGetLatestEvaluation(w http.ResponseWriter, r *http.Request, offerID, userID string) {
	ctx := r.Context()

	// 1. Initialize orchestrator
	orchestrator := NewEvaluationOrchestratorWithAdapter(h.Adapter, h.Publisher)

	// 2. Verify offer exists and belongs to user
	if err := orchestrator.VerifyOfferOwnership(ctx, offerID, userID); err != nil {
		if err.Error() == "database unavailable" {
			errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "database unavailable", nil)
		} else if err.Error() == "offer not found or does not belong to user" {
			errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "offer not found", nil)
		} else {
			errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "database error", map[string]string{"error": err.Error()})
		}
		return
	}

	// 3. Query latest evaluation
	evaluation, err := orchestrator.GetLatestEvaluation(ctx, offerID)
	if err != nil {
		if err.Error() == "no evaluations found for this offer" {
			errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "no evaluations found for this offer", nil)
			return
		}
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "failed to query evaluation", map[string]string{"error": err.Error()})
		return
	}

	// 4. Return result
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(evaluation)
}

// releaseTokensViaGateway calls Gateway internal API to release reserved tokens
func (h *Handler) releaseTokensViaGateway(ctx context.Context, authToken, reservationID string, amount int, taskID, reason string) error {
	gatewayURL := os.Getenv("GATEWAY_URL")
	if gatewayURL == "" {
		gatewayURL = "http://localhost:8080" // Default
	}

	releaseReq := map[string]interface{}{
		"reservationId": reservationID,
		"amount":        amount,
		"service":       "offer",
		"taskId":        taskID,
		"reason":        reason,
	}

	jsonData, err := json.Marshal(releaseReq)
	if err != nil {
		return fmt.Errorf("failed to marshal release request: %w", err)
	}

	endpoint := fmt.Sprintf("%s/internal/v1/tokens/release", gatewayURL)
	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call gateway: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("gateway returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// CalculateTokensRequired calculates the number of tokens required for an evaluation
func CalculateTokensRequired(enableAI bool) int {
	if enableAI {
		return 3
	}
	return 1
}
