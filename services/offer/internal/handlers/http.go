package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/xxrenzhe/autoads/pkg/database"
	"github.com/xxrenzhe/autoads/pkg/errors"
	"github.com/xxrenzhe/autoads/pkg/middleware"
	"github.com/xxrenzhe/autoads/services/offer/internal/events"
)

// Offer represents the read model for an offer.
type Offer struct {
	ID            string    `json:"id"`
	UserID        string    `json:"userId"`
	Name          string    `json:"name"`
	OriginalUrl   string    `json:"originalUrl"`
	Status        string    `json:"status"`
	SiterankScore *float64  `json:"siterankScore,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt,omitempty"`
	BrandName     string    `json:"brandName,omitempty"`
	Country       string    `json:"country,omitempty"`
	// v2 补充：派生状态（后端计算，只读）
	DerivedStatus        string     `json:"derivedStatus,omitempty"`
	StatusReason         string     `json:"statusReason,omitempty"`
	Favorite             bool       `json:"favorite"`
	LastEvaluatedAt      *time.Time `json:"lastEvaluatedAt,omitempty"`
	LastEvaluationType   string     `json:"lastEvaluationType,omitempty"`
	LastEvaluationStatus string     `json:"lastEvaluationStatus,omitempty"`
	LastEvaluationScore  *float64   `json:"lastEvaluationScore,omitempty"`
	LastEvaluationTokens *int       `json:"lastEvaluationTokens,omitempty"`
}

type latestEvaluationSummary struct {
	CompletedAt *time.Time
	Type        string
	Status      string
	Tokens      int
	AIScore     *float64
}

// Handler holds dependencies for the HTTP handlers.
type Handler struct {
	Adapter   database.DatabaseAdapter
	Publisher  events.Publisher
	Cache     CacheInterface
}

// CacheInterface defines cache operations
type CacheInterface interface {
	Get(ctx context.Context, key string) (string, bool)
	Set(ctx context.Context, key, val string, ttl time.Duration)
	Del(ctx context.Context, key string)
	Ready() bool
}

// Helper methods to maintain compatibility with existing code
func (h *Handler) GetDB() *sql.DB {
	// This is a compatibility method for existing code
	// Prefer using h.Adapter directly for new code
	if finalAdapter, ok := h.Adapter.(*database.FinalAdapter); ok {
		// For FinalAdapter, we need to create a compatibility wrapper
		// that provides *sql.DB interface using the underlying pgxpool
		return createSQLDBWrapper(finalAdapter)
	}

	// For other adapters, try to get the Supabase DB if available
	return h.Adapter.GetSupabaseDB()
}

// createSQLDBWrapper creates a compatibility wrapper that implements *sql.DB interface
// This is a temporary solution for legacy code that expects *sql.DB
func createSQLDBWrapper(finalAdapter *database.FinalAdapter) *sql.DB {
	// For now, we'll return nil and handle the nil case in calling code
	// TODO: Implement proper pgx to sql.DB wrapper if needed
	return nil
}

// ExecContext executes a query with the adapter
func (h *Handler) ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return h.Adapter.Exec(ctx, query, args...)
}

// QueryContext executes a query with the adapter
func (h *Handler) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return h.Adapter.Query(ctx, query, args...)
}

// QueryRowContext executes a query with the adapter
func (h *Handler) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	return h.Adapter.QueryRow(ctx, query, args...)
}

// PingContext checks database connection health
func (h *Handler) PingContext(ctx context.Context) error {
	return h.Adapter.Ping(ctx)
}

// BeginTx begins a transaction
func (h *Handler) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	return h.Adapter.BeginTx(ctx, opts)
}

const (
	queryModernOffersList = `
SELECT id::text,
       user_id::text,
       title,
       landing_page_url,
       status,
       brand_name,
       ai_score,
       metadata,
       created_at,
       updated_at
  FROM public.offers
 WHERE user_id = $1
 ORDER BY created_at DESC`

	queryModernOfferByID = `
SELECT id::text,
       user_id::text,
       title,
       landing_page_url,
       status,
       brand_name,
       ai_score,
       metadata,
       created_at,
       updated_at
  FROM public.offers
 WHERE id = $1 AND user_id = $2`
)

// NewHandler creates a new Handler.
func NewHandler(adapter database.DatabaseAdapter, publisher events.Publisher, cache CacheInterface) *Handler {
	// Note: Schema is now managed by db-admin service through YAML migrations
	// No need for embedded ALTER TABLE statements
	return &Handler{Adapter: adapter, Publisher: publisher, Cache: cache}
}

// RegisterRoutes registers all offer-related routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux, authMiddleware func(http.Handler) http.Handler) {
	// Health endpoints (no auth)
	mux.HandleFunc("/healthz", h.healthz)
	mux.HandleFunc("/readyz", h.readyz)

	// Main offer endpoints (with auth)
	mux.Handle("/api/v1/offers", authMiddleware(http.HandlerFunc(h.OffersHandler)))
	mux.Handle("/api/v1/offers/", authMiddleware(http.HandlerFunc(h.OfferTreeHandler)))
}

// OffersHandler is the public wrapper for offersHandler to satisfy http.Handler interface
func (h *Handler) OffersHandler(w http.ResponseWriter, r *http.Request) { h.offersHandler(w, r) }

// OfferTreeHandler is the public wrapper for offerTreeHandler to satisfy http.Handler interface
func (h *Handler) OfferTreeHandler(w http.ResponseWriter, r *http.Request) { h.offerTreeHandler(w, r) }

// offersHandler handles requests to /api/v1/offers
func (h *Handler) offersHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.getOffers(w, r)
	case http.MethodPost:
		h.createOffer(w, r)
	default:
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
	}
}

// offerTreeHandler handles requests to /api/v1/offers/{id}/*
func (h *Handler) offerTreeHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok || userID == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized: User ID is missing", nil)
		return
	}
	// Support both "/api/v1/offers/..." and "/offers/..." paths (depending on router mount)
	path := r.URL.Path
	if i := strings.Index(path, "/offers/"); i >= 0 {
		path = path[i+len("/offers/"):]
	} else {
		path = strings.TrimPrefix(path, "/api/v1/offers/")
	}
	parts := strings.Split(path, "/")
	if len(parts) == 0 || parts[0] == "" {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "id required", nil)
		return
	}
	id := parts[0]
	sub := ""
	if len(parts) >= 2 {
		sub = parts[1]
	}

	switch r.Method {
	case http.MethodGet:
		// GET /api/v1/offers/{id}
		if sub == "kpi" {
			// GET /api/v1/offers/{id}/kpi
			h.getOfferKPI(w, r, id, userID)
			return
		}
		if sub == "accounts" {
			// GET /api/v1/offers/{id}/accounts
			h.getOfferAccounts(w, r, id, userID)
			return
		}
		if sub == "preferences" {
			// GET /api/v1/offers/{id}/preferences
			h.getOfferPreferences(w, r, id, userID)
			return
		}
		if sub == "evaluations" {
			// GET /api/v1/offers/{id}/evaluations
			h.handleGetEvaluations(w, r, id, userID)
			return
		}
		if sub != "" {
			errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "not found", nil)
			return
		}
		// GET /api/v1/offers/{id}
		h.getOfferByID(w, r, id, userID)
		return

	case http.MethodPut:
		if sub == "status" {
			// PUT /api/v1/offers/{id}/status
			h.updateOfferStatus(w, r, id, userID)
			return
		}
		if sub == "preferences" {
			// PUT /api/v1/offers/{id}/preferences
			h.updateOfferPreferences(w, r, id, userID)
			return
		}
		if sub == "" {
			// PUT /api/v1/offers/{id}
			h.updateOffer(w, r, id, userID)
			return
		}
		errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "unsupported subresource", nil)
		return

	case http.MethodPost:
		// POST /api/v1/offers/{id}/accounts
		if sub == "accounts" {
			h.addOfferAccount(w, r, id, userID)
			return
		}
		// POST /api/v1/offers/{id}/evaluate
		if sub == "evaluate" {
			h.handleEvaluateOffer(w, r, id, userID)
			return
		}
		errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "unsupported subresource", nil)
		return

	case http.MethodDelete:
		if sub == "" {
			// DELETE /api/v1/offers/{id}
			h.deleteOffer(w, r, id, userID)
			return
		}
		if sub == "accounts" && len(parts) >= 3 {
			// DELETE /api/v1/offers/{id}/accounts/{accountId}
			accountID := parts[2]
			h.deleteOfferAccount(w, r, id, userID, accountID)
			return
		}
		errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "unsupported subresource", nil)
		return

	default:
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
}

// debugOffers is a debug endpoint to inspect offer data
func (h *Handler) debugOffers(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok || userID == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized: User ID is missing", nil)
		return
	}

	// Query both modern and legacy tables for comparison
	modern, err := h.listModernOffers(r.Context(), userID)
	if err != nil {
		log.Printf("Modern offers query failed: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"modern":%d,"modernErr":"%v"}`, len(modern), err)
}
