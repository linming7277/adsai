// github.com/xxrenzhe/autoads/services/offer/internal/events/handler.go
package events

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
)

// SiterankAnalysisCompletedPayload defines the incoming event structure.
type SiterankAnalysisCompletedPayload struct {
	OfferID string  `json:"offerId"`
	Score   float64 `json:"score"`
}

// HandleSiterankAnalysisCompleted updates the offer status after analysis.
func HandleSiterankAnalysisCompleted(ctx context.Context, db *sql.DB, payload []byte) error {
	var data SiterankAnalysisCompletedPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Printf("Processing SiterankAnalysisCompleted event for offerID: %s", data.OfferID)

	// Update the Offer's status and score in the read model.
	// This completes the 'Evaluate' phase of the offer's lifecycle.
	_, err := db.ExecContext(ctx, `
        UPDATE "Offer"
        SET status = 'optimizing', "siterankScore" = $1
        WHERE id = $2
    `, data.Score, data.OfferID)

	if err != nil {
		return fmt.Errorf("failed to update offer status: %w", err)
	}

	log.Printf("Successfully updated offer %s to 'optimizing' with score %.2f", data.OfferID, data.Score)
	return nil
}

// BrandNameExtractedPayload defines the incoming event from Siterank service
type BrandNameExtractedPayload struct {
	OfferID     string  `json:"offerId"`
	BrandName   string  `json:"brandName"`
	Source      string  `json:"source"`      // "auto_extracted" or "domain_fallback"
	Confidence  float64 `json:"confidence"`  // 0.0 to 1.0
	ExtractedAt string  `json:"extractedAt"` // ISO timestamp
}

// HandleBrandNameExtracted processes brand name extraction events from Siterank
// This replaces direct database writes from Siterank service (fixes cross-domain violation)
func HandleBrandNameExtracted(ctx context.Context, db *sql.DB, payload []byte) error {
	var data BrandNameExtractedPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return fmt.Errorf("failed to unmarshal BrandNameExtracted payload: %w", err)
	}

	log.Printf("Processing BrandNameExtracted event for offerID: %s, brandName: %s (source: %s, confidence: %.2f)",
		data.OfferID, data.BrandName, data.Source, data.Confidence)

	// Update Offer.brand_name only if currently empty
	// This ensures Offer service owns its data and validates business rules
	_, err := db.ExecContext(ctx, `
		UPDATE "Offer"
		SET brand_name = $1,
		    brand_name_source = $2,
		    brand_name_confidence = $3
		WHERE id = $4 AND (brand_name IS NULL OR brand_name = '')
	`, data.BrandName, data.Source, data.Confidence, data.OfferID)

	if err != nil {
		return fmt.Errorf("failed to update offer brand_name: %w", err)
	}

	log.Printf("Successfully updated brand_name for offer %s", data.OfferID)
	return nil
}
