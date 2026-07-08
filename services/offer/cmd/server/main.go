// +build dbadmin

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
	apperr "github.com/xxrenzhe/autoads/pkg/errors"
	"github.com/xxrenzhe/autoads/pkg/dbadmin"
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

	// Get db-admin configuration
	dbAdminURL := os.Getenv("DB_ADMIN_URL")
	if dbAdminURL == "" {
		dbAdminURL = "http://db-admin:8080" // 默认服务发现地址
	}

	dbAdminToken := os.Getenv("DB_ADMIN_TOKEN")
	if dbAdminToken == "" {
		// 在生产环境中，这应该通过Secret Manager获取
		log.Fatal().Msg("DB_ADMIN_TOKEN is not set")
	}

	// Connect through db-admin proxy
	var err error
	db, err = dbadmin.OpenDB(dbAdminURL, dbAdminToken, "offer")
	if err != nil {
		log.Fatal().Err(err).Msg("Error connecting to database through db-admin")
	}
	defer db.Close()

	// Test connection
	err = db.Ping()
	if err != nil {
		log.Fatal().Err(err).Msg("Error pinging the database at startup")
	}
	log.Info().Msg("Successfully connected to database through db-admin!")

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

	log.Info().Str("port", port).Msg("Offer service starting with db-admin proxy...")
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

	// 额外检查db-admin服务状态
	dbAdminURL := os.Getenv("DB_ADMIN_URL")
	if dbAdminURL == "" {
		dbAdminURL = "http://db-admin:8080"
	}
	dbAdminToken := os.Getenv("DB_ADMIN_TOKEN")

	client := dbadmin.NewClient(dbAdminURL, dbAdminToken)
	health, err := client.CheckHealth(r.Context())
	if err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		fmt.Fprintf(w, "Health check failed: db-admin service error: %v\n", err)
		return
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "OK - db-admin status: %s", health.Status)
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
	var args []interface{}
	if hasRealData {
		query = `
			SELECT id, name, original_url, final_url, brand_name,
			       description, tagline, brand_colors, brand_fonts,
			       is_demo, created_at, updated_at
			FROM offers
			WHERE user_id = $1
			ORDER BY created_at DESC
		`
		args = []interface{}{userID}
	} else {
		query = `
			SELECT id, name, original_url, final_url, brand_name,
			       description, tagline, brand_colors, brand_fonts,
			       is_demo, created_at, updated_at
			FROM offers
			WHERE user_id = $1 AND is_demo = TRUE
			ORDER BY created_at DESC
		`
		args = []interface{}{userID}
	}

	rows, err := db.QueryContext(r.Context(), query, args...)
	if err != nil {
		log.Error().Err(err).Msg("Failed to query offers")
		apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
		return
	}
	defer rows.Close()

	var offers []domain.Offer
	for rows.Next() {
		var offer domain.Offer
		var brandColors, brandFonts []byte

		err := rows.Scan(
			&offer.ID,
			&offer.Name,
			&offer.OriginalURL,
			&offer.FinalURL,
			&offer.BrandName,
			&offer.Description,
			&offer.Tagline,
			&brandColors,
			&brandFonts,
			&offer.IsDemo,
			&offer.CreatedAt,
			&offer.UpdatedAt,
		)
		if err != nil {
			log.Error().Err(err).Msg("Failed to scan offer row")
			continue
		}

		// Parse JSON fields
		if len(brandColors) > 0 {
			if err := json.Unmarshal(brandColors, &offer.BrandColors); err != nil {
				log.Error().Err(err).Str("offerID", offer.ID).Msg("Failed to parse brand colors")
			}
		}
		if len(brandFonts) > 0 {
			if err := json.Unmarshal(brandFonts, &offer.BrandFonts); err != nil {
				log.Error().Err(err).Str("offerID", offer.ID).Msg("Failed to parse brand fonts")
			}
		}

		offers = append(offers, offer)
	}

	if err = rows.Err(); err != nil {
		log.Error().Err(err).Msg("Error iterating offer rows")
		apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(offers); err != nil {
		log.Error().Err(err).Msg("Failed to encode offers response")
		apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
		return
	}
}

func createOffer(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)

	var req OfferCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
		return
	}

	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.OriginalUrl) == "" {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Name and original URL are required", nil)
		return
	}

	// Generate UUID for the new offer
	offerID := uuid.New().String()
	now := time.Now().UTC()

	// Insert the new offer
	query := `
		INSERT INTO offers (
			id, user_id, name, original_url, is_demo,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, FALSE, $5, $6)
	`
	_, err := db.ExecContext(r.Context(), query, offerID, userID, req.Name, req.OriginalUrl, now, now)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create offer")
		apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Failed to create offer", nil)
		return
	}

	// Return the created offer
	offer := domain.Offer{
		ID:          offerID,
		Name:        req.Name,
		OriginalURL: req.OriginalUrl,
		IsDemo:      false,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(offer); err != nil {
		log.Error().Err(err).Msg("Failed to encode offer response")
		apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
		return
	}

	// Publish event for async processing
	if publisher != nil {
		event := events.OfferCreatedEvent{
			OfferID:     offerID,
			UserID:      userID,
			Name:        req.Name,
			OriginalURL: req.OriginalUrl,
			CreatedAt:   now,
		}
		if err := publisher.Publish("OfferCreated", event); err != nil {
			log.Warn().Err(err).Msg("Failed to publish OfferCreated event")
		}
	}

	log.Info().
		Str("offerID", offerID).
		Str("userID", userID).
		Str("name", req.Name).
		Msg("Offer created successfully")
}

func demoInitializeHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)

	// Check if user already has demo data
	var demoCount int
	checkQuery := `SELECT COUNT(*) FROM offers WHERE user_id = $1 AND is_demo = TRUE`
	err := db.QueryRowContext(r.Context(), checkQuery, userID).Scan(&demoCount)
	if err != nil {
		log.Error().Err(err).Msg("Failed to check existing demo data")
		apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
		return
	}

	if demoCount > 0 {
		apperr.Write(w, r, http.StatusConflict, "DEMO_EXISTS", "Demo data already exists", nil)
		return
	}

	// Create demo offers
	demoOffers := []struct {
		name        string
		originalURL string
		brandName   string
		description string
	}{
		{
			name:        "Tech Startup Landing Page",
			originalURL: "https://example-tech.com",
			brandName:   "TechFlow",
			description: "Innovative SaaS platform for workflow automation",
		},
		{
			name:        "E-commerce Store",
			originalURL: "https://shop-example.com",
			brandName:   "StyleHub",
			description: "Curated fashion marketplace for modern consumers",
		},
		{
			name:        "Mobile App",
			originalURL: "https://app-example.com",
			brandName:   "QuickNote",
			description: "Simple note-taking app with smart organization",
		},
	}

	now := time.Now().UTC()
	for _, demo := range demoOffers {
		offerID := uuid.New().String()
		query := `
			INSERT INTO offers (
				id, user_id, name, original_url, brand_name, description,
				is_demo, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8)
		`
		_, err := db.ExecContext(r.Context(), query,
			offerID, userID, demo.name, demo.originalURL, demo.brandName, demo.description,
			true, now, now)
		if err != nil {
			log.Error().Err(err).Str("demoName", demo.name).Msg("Failed to create demo offer")
			continue
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":    "Demo data initialized successfully",
		"offerCount": len(demoOffers),
	})
}

func demoStatusHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)

	// Check demo data status
	var demoCount, realCount int
	demoQuery := `SELECT COUNT(*) FROM offers WHERE user_id = $1 AND is_demo = TRUE`
	realQuery := `SELECT COUNT(*) FROM offers WHERE user_id = $1 AND is_demo = FALSE`

	err1 := db.QueryRowContext(r.Context(), demoQuery, userID).Scan(&demoCount)
	err2 := db.QueryRowContext(r.Context(), realQuery, userID).Scan(&realCount)

	if err1 != nil || err2 != nil {
		log.Error().Err(err1).Err(err2).Msg("Failed to check demo status")
		apperr.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Internal server error", nil)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"hasDemoData": demoCount > 0,
		"hasRealData": realCount > 0,
		"demoCount":   demoCount,
		"realCount":   realCount,
	})
}