package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xxrenzhe/autoads/pkg/middleware"
	"github.com/xxrenzhe/autoads/services/offer/internal/events"
)

// MockPublisher implements events.Publisher for testing
type MockPublisher struct {
	PublishFunc func(ctx context.Context, event events.DomainEvent) error
}

func (m *MockPublisher) Publish(ctx context.Context, event events.DomainEvent) error {
	if m.PublishFunc != nil {
		return m.PublishFunc(ctx, event)
	}
	return nil
}

// MockCache implements CacheInterface for testing
type MockCache struct {
	GetFunc   func(ctx context.Context, key string) (string, bool)
	SetFunc   func(ctx context.Context, key, val string, ttl time.Duration)
	DelFunc   func(ctx context.Context, key string)
	ReadyFunc func() bool
}

func (m *MockCache) Get(ctx context.Context, key string) (string, bool) {
	if m.GetFunc != nil {
		return m.GetFunc(ctx, key)
	}
	return "", false
}

func (m *MockCache) Set(ctx context.Context, key, val string, ttl time.Duration) {
	if m.SetFunc != nil {
		m.SetFunc(ctx, key, val, ttl)
	}
}

func (m *MockCache) Del(ctx context.Context, key string) {
	if m.DelFunc != nil {
		m.DelFunc(ctx, key)
	}
}

func (m *MockCache) Ready() bool {
	if m.ReadyFunc != nil {
		return m.ReadyFunc()
	}
	return true
}

// withUserContext adds a user ID to the request context
func withUserContext(r *http.Request, userID string) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, userID)
	return r.WithContext(ctx)
}

// TestHandler_healthz tests the health check endpoint
func TestHandler_healthz(t *testing.T) {
	handler := &Handler{
		Adapter:   nil,
		Publisher: &MockPublisher{},
		Cache:     &MockCache{},
	}

	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()

	handler.healthz(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// TestHandler_offersHandler tests the offers handler routing
func TestHandler_offersHandler(t *testing.T) {
	tests := []struct {
		name           string
		method         string
		userID         string
		wantStatusCode int
	}{
		{
			name:           "GET without user context",
			method:         "GET",
			userID:         "",
			wantStatusCode: http.StatusUnauthorized,
		},
		{
			name:           "POST without user context",
			method:         "POST",
			userID:         "",
			wantStatusCode: http.StatusUnauthorized,
		},
		{
			name:           "unsupported method",
			method:         "DELETE",
			userID:         "test-user-1",
			wantStatusCode: http.StatusMethodNotAllowed,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := &Handler{
				Adapter:   nil,
				Publisher: &MockPublisher{},
				Cache:     &MockCache{},
			}

			req := httptest.NewRequest(tt.method, "/api/v1/offers", nil)
			if tt.userID != "" {
				req = withUserContext(req, tt.userID)
			}
			w := httptest.NewRecorder()

			handler.offersHandler(w, req)

			assert.Equal(t, tt.wantStatusCode, w.Code)
		})
	}
}

// TestHandler_offerTreeHandler tests the offer tree handler routing
func TestHandler_offerTreeHandler(t *testing.T) {
	tests := []struct {
		name           string
		method         string
		path           string
		userID         string
		wantStatusCode int
	}{
		{
			name:           "GET without user context",
			method:         "GET",
			path:           "/api/v1/offers/123",
			userID:         "",
			wantStatusCode: http.StatusUnauthorized,
		},
		{
			name:           "GET with empty ID",
			method:         "GET",
			path:           "/api/v1/offers/",
			userID:         "test-user-1",
			wantStatusCode: http.StatusBadRequest,
		},
		{
			name:           "unsupported method",
			method:         "PATCH",
			path:           "/api/v1/offers/123",
			userID:         "test-user-1",
			wantStatusCode: http.StatusMethodNotAllowed,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := &Handler{
				Adapter:   nil,
				Publisher: &MockPublisher{},
				Cache:     &MockCache{},
			}

			req := httptest.NewRequest(tt.method, tt.path, nil)
			if tt.userID != "" {
				req = withUserContext(req, tt.userID)
			}
			w := httptest.NewRecorder()

			handler.offerTreeHandler(w, req)

			assert.Equal(t, tt.wantStatusCode, w.Code)
		})
	}
}

// TestHandler_createOffer tests offer creation
func TestHandler_createOffer(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	tests := []struct {
		name           string
		userID         string
		payload        interface{}
		wantStatusCode int
	}{
		{
			name:           "missing user context",
			userID:         "",
			payload:        map[string]interface{}{"name": "Test Offer"},
			wantStatusCode: http.StatusUnauthorized,
		},
		{
			name:           "invalid JSON payload",
			userID:         "test-user-1",
			payload:        "invalid json",
			wantStatusCode: http.StatusBadRequest,
		},
		{
			name:   "missing required fields",
			userID: "test-user-1",
			payload: map[string]interface{}{
				"name": "",
			},
			wantStatusCode: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := &Handler{
				Adapter:   nil,
				Publisher: &MockPublisher{},
				Cache:     &MockCache{},
			}

			var body []byte
			var err error
			if str, ok := tt.payload.(string); ok {
				body = []byte(str)
			} else {
				body, err = json.Marshal(tt.payload)
				require.NoError(t, err)
			}

			req := httptest.NewRequest("POST", "/api/v1/offers", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			if tt.userID != "" {
				req = withUserContext(req, tt.userID)
			}
			w := httptest.NewRecorder()

			handler.createOffer(w, req)

			assert.Equal(t, tt.wantStatusCode, w.Code)
		})
	}
}

// TestHandler_getOffers tests listing offers
func TestHandler_getOffers(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	tests := []struct {
		name           string
		userID         string
		wantStatusCode int
	}{
		{
			name:           "missing user context",
			userID:         "",
			wantStatusCode: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := &Handler{
				Adapter:   nil,
				Publisher: &MockPublisher{},
				Cache:     &MockCache{},
			}

			req := httptest.NewRequest("GET", "/api/v1/offers", nil)
			if tt.userID != "" {
				req = withUserContext(req, tt.userID)
			}
			w := httptest.NewRecorder()

			handler.getOffers(w, req)

			assert.Equal(t, tt.wantStatusCode, w.Code)
		})
	}
}

// TestHandler_deriveStatus tests status derivation logic
func TestHandler_deriveStatus(t *testing.T) {
	handler := &Handler{
		Adapter:   nil,
		Publisher: &MockPublisher{},
		Cache:     &MockCache{},
	}

	tests := []struct {
		name           string
		currentStatus  string
		siterankScore  *float64
		wantStatus     string
		wantReasonPart string
	}{
		{
			name:           "archived status",
			currentStatus:  "archived",
			siterankScore:  nil,
			wantStatus:     "archived",
			wantReasonPart: "已归档",
		},
		{
			name:           "no score - evaluating",
			currentStatus:  "opportunity",
			siterankScore:  nil,
			wantStatus:     "evaluating",
			wantReasonPart: "未完成评估",
		},
		{
			name:           "high score - scaling",
			currentStatus:  "opportunity",
			siterankScore:  ptr(75.0),
			wantStatus:     "scaling",
			wantReasonPart: "评分较高",
		},
		{
			name:           "medium score - simulating",
			currentStatus:  "opportunity",
			siterankScore:  ptr(50.0),
			wantStatus:     "simulating",
			wantReasonPart: "评分一般",
		},
		{
			name:           "low score - declining",
			currentStatus:  "opportunity",
			siterankScore:  ptr(15.0),
			wantStatus:     "declining",
			wantReasonPart: "评分偏低",
		},
		{
			name:           "medium-low score - optimizing",
			currentStatus:  "opportunity",
			siterankScore:  ptr(30.0),
			wantStatus:     "optimizing",
			wantReasonPart: "评分中等",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			createdAt := time.Now().Add(-10 * 24 * time.Hour) // 10 days ago

			status, reason := handler.deriveStatus(ctx, tt.currentStatus, tt.siterankScore, createdAt)

			assert.Equal(t, tt.wantStatus, status)
			assert.Contains(t, reason, tt.wantReasonPart)
		})
	}
}

// TestHandler_deriveStatus_LongTermLowScore tests long-term low score detection
func TestHandler_deriveStatus_LongTermLowScore(t *testing.T) {
	handler := &Handler{
		Adapter:   nil,
		Publisher: &MockPublisher{},
		Cache:     &MockCache{},
	}

	ctx := context.Background()
	score := 15.0
	createdAt := time.Now().Add(-35 * 24 * time.Hour) // 35 days ago

	status, reason := handler.deriveStatus(ctx, "opportunity", &score, createdAt)

	assert.Equal(t, "declining", status)
	assert.Contains(t, reason, "创建已超过30天")
}

// Helper function to create pointer to float64
func ptr(f float64) *float64 {
	return &f
}

// TestNewHandler tests handler creation
func TestNewHandler(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping test that requires database")
	}

	// NewHandler tries to execute SQL, so we skip this test
	// In a real test, we would provide a test database
	t.Skip("NewHandler requires database connection")
}

// TestHandler_RegisterRoutes tests route registration
func TestHandler_RegisterRoutes(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping test that requires database")
	}

	// NewHandler tries to execute SQL, so we skip this test
	t.Skip("RegisterRoutes test requires database connection")
}

// TestHandler_handleEvaluateOffer tests the evaluate offer endpoint
func TestHandler_handleEvaluateOffer(t *testing.T) {
	tests := []struct {
		name              string
		offerID           string
		userID            string
		payload           map[string]interface{}
		idempotencyKey    string
		setupDB           func() error
		setupCache        *MockCache
		wantStatusCode    int
		wantErrorCode     string
		wantResponseField string
	}{
		{
			name:    "missing idempotency key",
			offerID: "offer-123",
			userID:  "user-1",
			payload: map[string]interface{}{
				"enableAI":     false,
				"forceRefresh": false,
			},
			idempotencyKey: "",
			wantStatusCode: http.StatusBadRequest,
			wantErrorCode:  "INVALID_ARGUMENT",
		},
		{
			name:    "invalid request body",
			offerID: "offer-123",
			userID:  "user-1",
			payload: map[string]interface{}{
				"invalid": "data",
			},
			idempotencyKey: "test-key-123",
			wantStatusCode: http.StatusBadRequest,
		},
		{
			name:    "idempotent request - cache hit",
			offerID: "offer-123",
			userID:  "user-1",
			payload: map[string]interface{}{
				"enableAI":     false,
				"forceRefresh": false,
			},
			idempotencyKey: "test-key-cached",
			setupCache: &MockCache{
				GetFunc: func(ctx context.Context, key string) (string, bool) {
					if key == "eval:idempotency:test-key-cached" {
						return `{"status":"evaluating","evaluationId":"eval_abc123","offerId":"offer-123","tokenCost":1,"estimatedDuration":30,"message":"评估任务已启动"}`, true
					}
					return "", false
				},
				ReadyFunc: func() bool {
					return true
				},
			},
			wantStatusCode:    http.StatusAccepted,
			wantResponseField: "evaluationId",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mock cache
			cache := tt.setupCache
			if cache == nil {
				cache = &MockCache{
					GetFunc: func(ctx context.Context, key string) (string, bool) {
						return "", false
					},
					SetFunc: func(ctx context.Context, key, val string, ttl time.Duration) {},
					ReadyFunc: func() bool {
						return true
					},
				}
			}

			handler := &Handler{
				Adapter:   nil,
				Publisher: &MockPublisher{},
				Cache:     cache,
			}

			body, err := json.Marshal(tt.payload)
			require.NoError(t, err)

			req := httptest.NewRequest("POST", "/api/v1/offers/"+tt.offerID+"/evaluate", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			if tt.idempotencyKey != "" {
				req.Header.Set("Idempotency-Key", tt.idempotencyKey)
			}
			req = withUserContext(req, tt.userID)
			w := httptest.NewRecorder()

			handler.handleEvaluateOffer(w, req, tt.offerID, tt.userID)

			assert.Equal(t, tt.wantStatusCode, w.Code)

			if tt.wantErrorCode != "" {
				var response map[string]interface{}
				err := json.NewDecoder(w.Body).Decode(&response)
				require.NoError(t, err)
				if errBody, ok := response["error"].(map[string]interface{}); ok {
					assert.Equal(t, tt.wantErrorCode, errBody["code"])
				}
			}

			if tt.wantResponseField != "" {
				var response map[string]interface{}
				err := json.NewDecoder(w.Body).Decode(&response)
				require.NoError(t, err)
				assert.Contains(t, response, tt.wantResponseField)
			}
		})
	}
}

// TestHandler_offerTreeHandler_EvaluateEndpoint tests the evaluate endpoint routing
func TestHandler_offerTreeHandler_EvaluateEndpoint(t *testing.T) {
	tests := []struct {
		name           string
		method         string
		path           string
		userID         string
		body           map[string]interface{}
		idempotencyKey string
		setupCache     *MockCache
		wantStatusCode int
	}{
		{
			name:   "evaluate endpoint without idempotency key",
			method: "POST",
			path:   "/api/v1/offers/offer-123/evaluate",
			userID: "user-1",
			body: map[string]interface{}{
				"enableAI":     false,
				"forceRefresh": false,
			},
			idempotencyKey: "",
			wantStatusCode: http.StatusBadRequest,
		},
		{
			name:   "evaluate endpoint with idempotency key",
			method: "POST",
			path:   "/api/v1/offers/offer-456/evaluate",
			userID: "user-2",
			body: map[string]interface{}{
				"enableAI":     true,
				"forceRefresh": true,
			},
			idempotencyKey: "eval-key-456",
			setupCache: &MockCache{
				GetFunc: func(ctx context.Context, key string) (string, bool) {
					return "", false
				},
				SetFunc: func(ctx context.Context, key, val string, ttl time.Duration) {},
				ReadyFunc: func() bool {
					return true
				},
			},
			wantStatusCode: http.StatusInternalServerError, // Will fail on DB check but that's OK for routing test
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cache := tt.setupCache
			if cache == nil {
				cache = &MockCache{
					ReadyFunc: func() bool { return true },
				}
			}

			handler := &Handler{
				Adapter:   nil,
				Publisher: &MockPublisher{},
				Cache:     cache,
			}

			body, err := json.Marshal(tt.body)
			require.NoError(t, err)

			req := httptest.NewRequest(tt.method, tt.path, bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			if tt.idempotencyKey != "" {
				req.Header.Set("Idempotency-Key", tt.idempotencyKey)
			}
			req = withUserContext(req, tt.userID)
			w := httptest.NewRecorder()

			handler.offerTreeHandler(w, req)

			assert.Equal(t, tt.wantStatusCode, w.Code)
		})
	}
}
