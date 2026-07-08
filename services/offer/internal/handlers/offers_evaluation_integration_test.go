package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xxrenzhe/autoads/services/offer/internal/domain"
	"github.com/xxrenzhe/autoads/services/offer/internal/events"

	_ "github.com/lib/pq"
)

// TestOfferEvaluationIntegration_SuccessfulBasicEvaluation tests the complete evaluation flow
// for a basic (non-AI) evaluation with successful token reservation
func TestOfferEvaluationIntegration_SuccessfulBasicEvaluation(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Skip if no database URL is provided
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	// Setup test database
	db, err := sql.Open("postgres", dbURL)
	require.NoError(t, err)
	defer db.Close()

	ctx := context.Background()

	// Clean up test data
	defer func() {
		_, _ = db.ExecContext(ctx, `DELETE FROM offer_evaluations WHERE id LIKE 'test_eval_%'`)
		_, _ = db.ExecContext(ctx, `DELETE FROM "Offer" WHERE id LIKE 'test_offer_%'`)
	}()

	// Create test offer
	testOfferID := "test_offer_" + fmt.Sprint(time.Now().Unix())
	testUserID := "test_user_123"

	_, err = db.ExecContext(ctx, `
		INSERT INTO "Offer" (id, "userId", name, "targetDomain", status, "createdAt", "updatedAt")
		VALUES ($1, $2, 'Test Offer', 'example.com', 'opportunity', NOW(), NOW())
	`, testOfferID, testUserID)
	require.NoError(t, err)

	// Setup mock billing service
	reservationID := "test_reservation_123"
	billingServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/users/me/subscription":
			// Return subscription with Professional plan (allows AI)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"id":     "sub_123",
				"userId": testUserID,
				"plan":   "professional",
				"status": "active",
			})

		case "/api/v1/users/me/tokens/balance":
			// Return sufficient token balance
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"userId":    testUserID,
				"available": 100,
				"reserved":  0,
				"total":     100,
			})

		case "/api/v1/users/" + testUserID + "/tokens/reserve":
			// Return successful reservation
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"reservationId": reservationID,
				"userId":        testUserID,
				"amount":        1,
				"expiresAt":     time.Now().Add(15 * time.Minute).Format(time.RFC3339),
				"createdAt":     time.Now().Format(time.RFC3339),
			})

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer billingServer.Close()

	// Set billing service URL
	os.Setenv("BILLING_SERVICE_URL", billingServer.URL)
	defer os.Unsetenv("BILLING_SERVICE_URL")

	// Setup mock publisher to capture events
	var publishedEvent *domain.EvaluationRequestedEvent
	mockPublisher := &MockPublisher{
		PublishFunc: func(ctx context.Context, event events.DomainEvent) error {
			if evalEvent, ok := event.(*domain.EvaluationRequestedEvent); ok {
				publishedEvent = evalEvent
			}
			return nil
		},
	}

	// Setup mock cache
	cache := &MockCache{
		GetFunc: func(ctx context.Context, key string) (string, bool) {
			return "", false
		},
		SetFunc: func(ctx context.Context, key, val string, ttl time.Duration) {},
		ReadyFunc: func() bool {
			return true
		},
	}

	// Create handler
	handler := &Handler{
		Adapter:   nil, // Using nil adapter for tests
		Publisher: mockPublisher,
		Cache:     cache,
	}

	// Create evaluation request
	requestBody := map[string]interface{}{
		"enableAI":     false,
		"forceRefresh": false,
	}
	bodyBytes, err := json.Marshal(requestBody)
	require.NoError(t, err)

	// Send request
	req := httptest.NewRequest("POST", "/api/v1/offers/"+testOfferID+"/evaluate", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test_token")
	req.Header.Set("Idempotency-Key", "test_idempotency_123")
	req = withUserContext(req, testUserID)

	w := httptest.NewRecorder()
	handler.handleEvaluateOffer(w, req, testOfferID, testUserID)

	// Assertions
	assert.Equal(t, http.StatusAccepted, w.Code)

	// Parse response
	var response map[string]interface{}
	err = json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	// Verify response fields
	assert.NotEmpty(t, response["evaluationId"])
	assert.Equal(t, testOfferID, response["offerId"])
	assert.Equal(t, "pending", response["status"])
	assert.Equal(t, float64(1), response["tokensReserved"])
	assert.Equal(t, reservationID, response["reservationId"])

	evaluationID := response["evaluationId"].(string)

	// Verify database record was created
	var dbEvalID, dbStatus, dbEvalType string
	var dbTokensConsumed int
	err = db.QueryRowContext(ctx, `
		SELECT id, status, evaluation_type, tokens_consumed
		FROM offer_evaluations
		WHERE id = $1
	`, evaluationID).Scan(&dbEvalID, &dbStatus, &dbEvalType, &dbTokensConsumed)
	require.NoError(t, err)
	assert.Equal(t, evaluationID, dbEvalID)
	assert.Equal(t, "pending", dbStatus)
	assert.Equal(t, "basic", dbEvalType)
	assert.Equal(t, 0, dbTokensConsumed) // Tokens consumed is 0 until completion

	// Verify Pub/Sub event was published
	require.NotNil(t, publishedEvent, "Expected Pub/Sub event to be published")
	assert.Equal(t, evaluationID, publishedEvent.EvaluationID)
	assert.Equal(t, testOfferID, publishedEvent.OfferID)
	assert.Equal(t, testUserID, publishedEvent.UserID)
	assert.False(t, publishedEvent.IncludeAI)
	assert.False(t, publishedEvent.ForceRefresh)
	assert.Equal(t, 1, publishedEvent.TokensReserved)
	assert.Equal(t, reservationID, publishedEvent.ReservationID)
}

// TestOfferEvaluationIntegration_AIEvaluationWithProPlan tests AI evaluation
// with a Professional plan subscription
func TestOfferEvaluationIntegration_AIEvaluationWithProPlan(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	db, err := sql.Open("postgres", dbURL)
	require.NoError(t, err)
	defer db.Close()

	ctx := context.Background()

	testOfferID := "test_offer_ai_" + fmt.Sprint(time.Now().Unix())
	testUserID := "test_user_pro_123"

	defer func() {
		_, _ = db.ExecContext(ctx, `DELETE FROM offer_evaluations WHERE offer_id = $1`, testOfferID)
		_, _ = db.ExecContext(ctx, `DELETE FROM "Offer" WHERE id = $1`, testOfferID)
	}()

	// Create test offer
	_, err = db.ExecContext(ctx, `
		INSERT INTO "Offer" (id, "userId", name, "targetDomain", status, "createdAt", "updatedAt")
		VALUES ($1, $2, 'AI Test Offer', 'example.com', 'opportunity', NOW(), NOW())
	`, testOfferID, testUserID)
	require.NoError(t, err)

	// Mock billing service with Professional plan
	billingServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/users/me/subscription":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"id":     "sub_pro",
				"userId": testUserID,
				"plan":   "professional",
				"status": "active",
			})

		case "/api/v1/users/me/tokens/balance":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"userId":    testUserID,
				"available": 50,
				"reserved":  0,
				"total":     50,
			})

		case "/api/v1/users/" + testUserID + "/tokens/reserve":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"reservationId": "res_ai_123",
				"userId":        testUserID,
				"amount":        3, // AI evaluation costs 3 tokens
				"expiresAt":     time.Now().Add(15 * time.Minute).Format(time.RFC3339),
				"createdAt":     time.Now().Format(time.RFC3339),
			})

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer billingServer.Close()

	os.Setenv("BILLING_SERVICE_URL", billingServer.URL)
	defer os.Unsetenv("BILLING_SERVICE_URL")

	var publishedEvent *domain.EvaluationRequestedEvent
	mockPublisher := &MockPublisher{
		PublishFunc: func(ctx context.Context, event events.DomainEvent) error {
			if evalEvent, ok := event.(*domain.EvaluationRequestedEvent); ok {
				publishedEvent = evalEvent
			}
			return nil
		},
	}

	cache := &MockCache{
		GetFunc:   func(ctx context.Context, key string) (string, bool) { return "", false },
		SetFunc:   func(ctx context.Context, key, val string, ttl time.Duration) {},
		ReadyFunc: func() bool { return true },
	}

	handler := &Handler{
		Adapter:   nil, // Using nil adapter for tests
		Publisher: mockPublisher,
		Cache:     cache,
	}

	// Request with AI enabled
	requestBody := map[string]interface{}{
		"enableAI":     true,
		"forceRefresh": true,
	}
	bodyBytes, err := json.Marshal(requestBody)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/api/v1/offers/"+testOfferID+"/evaluate", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test_token_pro")
	req.Header.Set("Idempotency-Key", "test_ai_idempotency_456")
	req = withUserContext(req, testUserID)

	w := httptest.NewRecorder()
	handler.handleEvaluateOffer(w, req, testOfferID, testUserID)

	// Assertions
	assert.Equal(t, http.StatusAccepted, w.Code)

	var response map[string]interface{}
	err = json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	assert.NotEmpty(t, response["evaluationId"])
	assert.Equal(t, float64(3), response["tokensReserved"]) // AI costs 3 tokens

	evaluationID := response["evaluationId"].(string)

	// Verify database record
	var evalType string
	err = db.QueryRowContext(ctx, `
		SELECT evaluation_type FROM offer_evaluations WHERE id = $1
	`, evaluationID).Scan(&evalType)
	require.NoError(t, err)
	assert.Equal(t, "ai_enhanced", evalType)

	// Verify event
	require.NotNil(t, publishedEvent)
	assert.True(t, publishedEvent.IncludeAI)
	assert.True(t, publishedEvent.ForceRefresh)
	assert.Equal(t, 3, publishedEvent.TokensReserved)
}

// TestOfferEvaluationIntegration_InsufficientTokens tests the insufficient tokens scenario
func TestOfferEvaluationIntegration_InsufficientTokens(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	db, err := sql.Open("postgres", dbURL)
	require.NoError(t, err)
	defer db.Close()

	ctx := context.Background()

	testOfferID := "test_offer_no_tokens_" + fmt.Sprint(time.Now().Unix())
	testUserID := "test_user_no_tokens"

	defer func() {
		_, _ = db.ExecContext(ctx, `DELETE FROM "Offer" WHERE id = $1`, testOfferID)
	}()

	// Create test offer
	_, err = db.ExecContext(ctx, `
		INSERT INTO "Offer" (id, "userId", name, "targetDomain", status, "createdAt", "updatedAt")
		VALUES ($1, $2, 'No Tokens Offer', 'example.com', 'opportunity', NOW(), NOW())
	`, testOfferID, testUserID)
	require.NoError(t, err)

	// Mock billing service with insufficient balance
	billingServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/users/me/subscription":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"id":     "sub_123",
				"userId": testUserID,
				"plan":   "professional",
				"status": "active",
			})

		case "/api/v1/users/me/tokens/balance":
			// Return insufficient balance
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"userId":    testUserID,
				"available": 0,
				"reserved":  0,
				"total":     0,
			})

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer billingServer.Close()

	os.Setenv("BILLING_SERVICE_URL", billingServer.URL)
	defer os.Unsetenv("BILLING_SERVICE_URL")

	handler := &Handler{
		Adapter:   nil, // Using nil adapter for tests
		Publisher: &MockPublisher{},
		Cache:     &MockCache{ReadyFunc: func() bool { return true }},
	}

	requestBody := map[string]interface{}{
		"enableAI":     false,
		"forceRefresh": false,
	}
	bodyBytes, err := json.Marshal(requestBody)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/api/v1/offers/"+testOfferID+"/evaluate", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test_token")
	req.Header.Set("Idempotency-Key", "test_no_tokens_123")
	req = withUserContext(req, testUserID)

	w := httptest.NewRecorder()
	handler.handleEvaluateOffer(w, req, testOfferID, testUserID)

	// Should return 402 Payment Required
	assert.Equal(t, http.StatusPaymentRequired, w.Code)

	var response map[string]interface{}
	err = json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	errorData := response["error"].(map[string]interface{})
	assert.Equal(t, "INSUFFICIENT_TOKENS", errorData["code"])
}

// TestOfferEvaluationIntegration_StarterPlanAIRestriction tests that Starter plan
// cannot use AI evaluation
func TestOfferEvaluationIntegration_StarterPlanAIRestriction(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	db, err := sql.Open("postgres", dbURL)
	require.NoError(t, err)
	defer db.Close()

	ctx := context.Background()

	testOfferID := "test_offer_starter_ai_" + fmt.Sprint(time.Now().Unix())
	testUserID := "test_user_starter"

	defer func() {
		_, _ = db.ExecContext(ctx, `DELETE FROM "Offer" WHERE id = $1`, testOfferID)
	}()

	// Create test offer
	_, err = db.ExecContext(ctx, `
		INSERT INTO "Offer" (id, "userId", name, "targetDomain", status, "createdAt", "updatedAt")
		VALUES ($1, $2, 'Starter Plan Offer', 'example.com', 'opportunity', NOW(), NOW())
	`, testOfferID, testUserID)
	require.NoError(t, err)

	// Mock billing service with Starter plan
	billingServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/users/me/subscription":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"id":     "sub_starter",
				"userId": testUserID,
				"plan":   "starter",
				"status": "active",
			})

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer billingServer.Close()

	os.Setenv("BILLING_SERVICE_URL", billingServer.URL)
	defer os.Unsetenv("BILLING_SERVICE_URL")

	handler := &Handler{
		Adapter:   nil, // Using nil adapter for tests
		Publisher: &MockPublisher{},
		Cache:     &MockCache{ReadyFunc: func() bool { return true }},
	}

	// Request AI evaluation with Starter plan
	requestBody := map[string]interface{}{
		"enableAI":     true,
		"forceRefresh": false,
	}
	bodyBytes, err := json.Marshal(requestBody)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/api/v1/offers/"+testOfferID+"/evaluate", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test_token")
	req.Header.Set("Idempotency-Key", "test_starter_ai_123")
	req = withUserContext(req, testUserID)

	w := httptest.NewRecorder()
	handler.handleEvaluateOffer(w, req, testOfferID, testUserID)

	// Should return 403 Forbidden
	assert.Equal(t, http.StatusForbidden, w.Code)

	var response map[string]interface{}
	err = json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	errorData := response["error"].(map[string]interface{})
	assert.Equal(t, "PLAN_RESTRICTION", errorData["code"])

	details := errorData["details"].(map[string]interface{})
	assert.Equal(t, "starter", details["currentPlan"])
}

// TestOfferEvaluationIntegration_IdempotencyKey tests idempotency key handling
func TestOfferEvaluationIntegration_IdempotencyKey(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	db, err := sql.Open("postgres", dbURL)
	require.NoError(t, err)
	defer db.Close()

	ctx := context.Background()

	testOfferID := "test_offer_idempotency_" + fmt.Sprint(time.Now().Unix())
	testUserID := "test_user_idempotency"

	defer func() {
		_, _ = db.ExecContext(ctx, `DELETE FROM offer_evaluations WHERE offer_id = $1`, testOfferID)
		_, _ = db.ExecContext(ctx, `DELETE FROM "Offer" WHERE id = $1`, testOfferID)
	}()

	// Create test offer
	_, err = db.ExecContext(ctx, `
		INSERT INTO "Offer" (id, "userId", name, "targetDomain", status, "createdAt", "updatedAt")
		VALUES ($1, $2, 'Idempotency Test Offer', 'example.com', 'opportunity', NOW(), NOW())
	`, testOfferID, testUserID)
	require.NoError(t, err)

	// Setup cache with cached response
	cachedResponse := `{"evaluationId":"eval_cached_123","offerId":"` + testOfferID + `","status":"pending","tokensReserved":1}`

	cache := &MockCache{
		GetFunc: func(ctx context.Context, key string) (string, bool) {
			if key == "eval:idempotency:cached_key_789" {
				return cachedResponse, true
			}
			return "", false
		},
		SetFunc:   func(ctx context.Context, key, val string, ttl time.Duration) {},
		ReadyFunc: func() bool { return true },
	}

	handler := &Handler{
		Adapter:   nil, // Using nil adapter for tests
		Publisher: &MockPublisher{},
		Cache:     cache,
	}

	requestBody := map[string]interface{}{
		"enableAI":     false,
		"forceRefresh": false,
	}
	bodyBytes, err := json.Marshal(requestBody)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/api/v1/offers/"+testOfferID+"/evaluate", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test_token")
	req.Header.Set("Idempotency-Key", "cached_key_789")
	req = withUserContext(req, testUserID)

	w := httptest.NewRecorder()
	handler.handleEvaluateOffer(w, req, testOfferID, testUserID)

	// Should return 202 Accepted with cached response
	assert.Equal(t, http.StatusAccepted, w.Code)

	var response map[string]interface{}
	err = json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	// Verify it's the cached response
	assert.Equal(t, "eval_cached_123", response["evaluationId"])
	assert.Equal(t, "pending", response["status"])
}

// TestOfferEvaluationIntegration_OfferNotFound tests evaluation of non-existent offer
func TestOfferEvaluationIntegration_OfferNotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	db, err := sql.Open("postgres", dbURL)
	require.NoError(t, err)
	defer db.Close()

	handler := &Handler{
		Adapter:   nil, // Using nil adapter for tests
		Publisher: &MockPublisher{},
		Cache:     &MockCache{ReadyFunc: func() bool { return true }},
	}

	requestBody := map[string]interface{}{
		"enableAI":     false,
		"forceRefresh": false,
	}
	bodyBytes, err := json.Marshal(requestBody)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/api/v1/offers/nonexistent_offer/evaluate", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test_token")
	req.Header.Set("Idempotency-Key", "test_not_found_123")
	req = withUserContext(req, "test_user_123")

	w := httptest.NewRecorder()
	handler.handleEvaluateOffer(w, req, "nonexistent_offer", "test_user_123")

	// Should return 404 Not Found
	assert.Equal(t, http.StatusNotFound, w.Code)

	var response map[string]interface{}
	err = json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	errorData := response["error"].(map[string]interface{})
	assert.Equal(t, "NOT_FOUND", errorData["code"])
}
