package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
	apperr "github.com/xxrenzhe/autoads/pkg/errors"
	"github.com/xxrenzhe/autoads/pkg/logger"
	"github.com/xxrenzhe/autoads/pkg/middleware"
	"github.com/xxrenzhe/autoads/services/offer/internal/domain"
	"github.com/xxrenzhe/autoads/services/offer/internal/events"
	"strings"
)

// OfferCreateRequest defines the expected JSON body for creating an offer.
type OfferCreateRequest struct {
	Name        string `json:"name"`
	OriginalUrl string `json:"originalUrl"`
}

var (
	db        *sql.DB
	ctx       = context.Background()
	log       = logger.Get()
	publisher events.Publisher
)

func main() {
	// Minimal config: use PORT from env (fallback 8080). Avoid external file dependencies in Cloud Run.
	port := os.Getenv("PORT")
	if strings.TrimSpace(port) == "" {
		port = "8080"
	}
	var err error

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal().Msg("DATABASE_URL is not set")
	}
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Error connecting to the database")
	}
	defer db.Close()
	err = db.Ping()
	if err != nil {
		log.Fatal().Err(err).Msg("Error pinging the database at startup")
	}
	log.Info().Msg("Successfully connected to the database!")

	// Initialize the Pub/Sub publisher.
	publisher, err = events.NewPublisher(ctx)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create event publisher")
	}
	if closer, ok := publisher.(interface{ Close() }); ok {
		defer closer.Close()
	}

	// Initialize the Pub/Sub subscriber for BrandNameExtracted events
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID != "" {
		topicID := os.Getenv("PUBSUB_TOPIC_ID")
		if topicID == "" {
			topicID = "autoads-events" // default topic
		}
		subscriptionID := "offer-brandname-subscription"

		subscriber, err := events.NewPubSubSubscriber(ctx, projectID, topicID, subscriptionID)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to create event subscriber (non-critical)")
		} else {
			// Subscribe to BrandNameExtracted event
			subscriber.On("BrandNameExtracted", func(ctx context.Context, event events.DomainEvent) error {
				// Extract raw JSON from RawEvent wrapper
				if rawEvent, ok := event.(*events.RawEvent); ok {
					return events.HandleBrandNameExtracted(ctx, db, rawEvent.Data)
				}
				payloadJSON, _ := json.Marshal(event)
				return events.HandleBrandNameExtracted(ctx, db, payloadJSON)
			})
			subscriber.Start(ctx)
			defer subscriber.Close()
			log.Info().Msg("Event subscriber started for BrandNameExtracted")
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthCheckHandler)

	protectedRoutes := http.NewServeMux()
	protectedRoutes.HandleFunc("/offers", offersHandler)
	protectedRoutes.HandleFunc("/v1/demo/initialize", demoInitializeHandler)
	protectedRoutes.HandleFunc("/v1/demo/status", demoStatusHandler)

	mux.Handle("/api/", http.StripPrefix("/api", middleware.AuthMiddleware(protectedRoutes)))

	log.Info().Str("port", port).Msg("Offer service starting...")
	root := middleware.RequestID()(mux)
	if err := http.ListenAndServe(":"+port, root); err != nil {
		log.Fatal().Err(err).Msg("Failed to start server")
	}
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	err := db.Ping()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, "Health check failed: Database error: %v\n", err)
		return
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "OK")
}

func offersHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		getOffers(w, r)
	case http.MethodPost:
		createOffer(w, r)
	default:
		apperr.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
	}
}

func getOffers(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)

	// Smart filtering: Check if user has real data
	var hasRealData bool
	checkQuery := `SELECT EXISTS(SELECT 1 FROM offers WHERE user_id = $1 AND is_demo = FALSE)`
	err := db.QueryRowContext(r.Context(), checkQuery, userID).Scan(&hasRealData)
	if err != nil {
		log.Error().Err(err).Msg("Failed to check real data")
		apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
		return
	}

	// If user has real data, exclude demo data; otherwise include only demo data
	var query string
	if hasRealData {
		query = `
			SELECT id, name, original_url, status, siterank_score, created_at
			FROM offers
			WHERE user_id = $1 AND is_demo = FALSE
			ORDER BY created_at DESC
		`
	} else {
		query = `
			SELECT id, name, original_url, status, siterank_score, created_at
			FROM offers
			WHERE user_id = $1 AND is_demo = TRUE
			ORDER BY created_at DESC
		`
	}

	rows, err := db.QueryContext(r.Context(), query, userID)
	if err != nil {
		log.Error().Err(err).Str("userID", userID).Msg("Failed to query offers")
		apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
		return
	}
	defer rows.Close()

	var offers []*domain.Offer
	for rows.Next() {
		var o domain.Offer
		var score sql.NullFloat64
		if err := rows.Scan(&o.ID, &o.Name, &o.OriginalURL, &o.Status, &score, &o.CreatedAt); err != nil {
			log.Error().Err(err).Str("userID", userID).Msg("Failed to scan offer row")
			apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
			return
		}
		if score.Valid {
			o.SiterankScore = &score.Float64
		}
		offers = append(offers, &o)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(offers)
}

func createOffer(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)

	var req OfferCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}

	offerID := uuid.New().String()
	// Publish the OfferCreated domain event (CQRS write path)
	evt := domain.OfferCreatedEvent{
		OfferID:     offerID,
		UserID:      userID,
		Name:        req.Name,
		OriginalUrl: req.OriginalUrl,
		Status:      "evaluating",
		CreatedAt:   time.Now(),
	}
	err := publisher.Publish(r.Context(), evt)
	if err != nil {
		log.Error().Err(err).Msg("Failed to publish OfferCreated event")
		apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Failed to create offer", nil)
		return
	}

	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(evt)
}

func demoInitializeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		apperr.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}

	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}

	var req struct {
		Modules []string `json:"modules"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "BAD_REQUEST", "Invalid request body", nil)
		return
	}

	if len(req.Modules) == 0 {
		req.Modules = []string{"offers"}
	}

	resp := struct {
		Success            bool           `json:"success"`
		InitializedModules []string       `json:"initialized_modules"`
		SkippedModules     []string       `json:"skipped_modules"`
		DemoCounts         map[string]int `json:"demo_counts"`
	}{
		Success:            true,
		InitializedModules: []string{},
		SkippedModules:     []string{},
		DemoCounts:         make(map[string]int),
	}

	for _, module := range req.Modules {
		if module == "offers" {
			// Check if user has real offers
			var realCount int
			err := db.QueryRowContext(r.Context(),
				"SELECT COUNT(*) FROM offers WHERE user_id = $1 AND is_demo = FALSE",
				userID).Scan(&realCount)
			if err != nil {
				log.Error().Err(err).Msg("Failed to check real offers")
				apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
				return
			}

			if realCount > 0 {
				resp.SkippedModules = append(resp.SkippedModules, "offers")
			} else {
				// Create demo offers
				count := createDemoOffers(r.Context(), userID)
				resp.InitializedModules = append(resp.InitializedModules, "offers")
				resp.DemoCounts["offers"] = count
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func demoStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		apperr.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}

	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}

	var demoCount, realCount int
	err := db.QueryRowContext(r.Context(),
		"SELECT COUNT(*) FROM offers WHERE user_id = $1 AND is_demo = TRUE",
		userID).Scan(&demoCount)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get demo count")
		apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
		return
	}

	err = db.QueryRowContext(r.Context(),
		"SELECT COUNT(*) FROM offers WHERE user_id = $1 AND is_demo = FALSE",
		userID).Scan(&realCount)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get real count")
		apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
		return
	}

	resp := map[string]interface{}{
		"modules": map[string]interface{}{
			"offers": map[string]interface{}{
				"has_real_data": realCount > 0,
				"demo_count":    demoCount,
				"real_count":    realCount,
			},
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func createDemoOffers(ctx context.Context, userID string) int {
	now := time.Now()
	demoOffers := []struct {
		Name         string
		Brand        string
		URL          string
		Revenue      int
		ROAS         float64
		Clicks       int
		CTR          float64
		AIScore      float64
		DemoCategory string
		Status       string
		EvalStatus   string
	}{
		{"Nike Summer Sale", "Nike", "https://demo.example.com/nike", 250000, 4.2, 15000, 0.08, 92, "success", "scaling", "evaluated"},
		{"Amazon Prime Day", "Amazon", "https://demo.example.com/amazon", 180000, 3.8, 12500, 0.076, 88, "success", "scaling", "evaluated"},
		{"Apple iPhone 15", "Apple", "https://demo.example.com/iphone", 320000, 5.1, 18000, 0.083, 95, "success", "scaling", "evaluated"},
		{"Adidas Fall Collection", "Adidas", "https://demo.example.com/adidas", 0, 0, 0, 0, 85, "pending", "optimizing", "evaluated"},
		{"Samsung Galaxy", "Samsung", "https://demo.example.com/samsung", 0, 0, 0, 0, 87, "pending", "optimizing", "evaluated"},
		{"Sony PlayStation", "Sony", "https://demo.example.com/sony", 0, 0, 0, 0, 0, "pending", "evaluating", "evaluating"},
		{"Microsoft Surface", "Microsoft", "https://demo.example.com/microsoft", 0, 0, 0, 0, 0, "failed", "evaluating", "failed"},
		{"Dell Laptop (Archived)", "Dell", "https://demo.example.com/dell", 150000, 3.2, 10000, 0.07, 82, "archived", "archived", "evaluated"},
	}

	query := `INSERT INTO offers (
		id, user_id, name, original_url, status, evaluation_status,
		domain, impressions, clicks, ctr, total_revenue, roas,
		siterank_score, is_demo, demo_category, created_at, updated_at
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`

	count := 0
	for _, offer := range demoOffers {
		impressions := int64(offer.Clicks) * 100
		_, err := db.ExecContext(ctx, query,
			uuid.New().String(), userID, offer.Name, offer.URL, offer.Status, offer.EvalStatus,
			"demo.example.com", impressions, offer.Clicks, offer.CTR, offer.Revenue, offer.ROAS,
			offer.AIScore, true, offer.DemoCategory, now, now,
		)
		if err != nil {
			log.Error().Err(err).Str("offer", offer.Name).Msg("Failed to create demo offer")
			continue
		}
		count++
	}

	log.Info().Int("count", count).Str("userID", userID).Msg("Created demo offers")
	return count
}
