package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/xxrenzhe/autoads/pkg/database"
	"github.com/xxrenzhe/autoads/services/offer/internal/events"
)

// EvaluationTaskCreatedEvent represents an evaluation task creation event
type EvaluationTaskCreatedEvent struct {
	EvaluationID    string `json:"evaluationId"`
	OfferID         string `json:"offerId"`
	UserID          string `json:"userId"`
	IncludeAI       bool   `json:"includeAI"`
	ForceRefresh    bool   `json:"forceRefresh"`
	AccessToken     string `json:"accessToken"`
	ReserveTxID     string `json:"reserveTxId"`
	EstimatedTokens int    `json:"estimatedTokens"`
}

// EventType implements the DomainEvent interface
func (e EvaluationTaskCreatedEvent) EventType() string {
	return "EvaluationTaskCreated"
}

// EvaluationOrchestrator handles the business logic for evaluations
type EvaluationOrchestrator struct {
	db        *sql.DB
	adapter   database.DatabaseAdapter
	publisher events.Publisher
}

// NewEvaluationOrchestrator creates a new evaluation orchestrator
func NewEvaluationOrchestrator(db *sql.DB, publisher events.Publisher) *EvaluationOrchestrator {
	return &EvaluationOrchestrator{
		db:        db,
		publisher: publisher,
	}
}

// NewEvaluationOrchestratorWithAdapter creates a new evaluation orchestrator with a DatabaseAdapter
func NewEvaluationOrchestratorWithAdapter(adapter database.DatabaseAdapter, publisher events.Publisher) *EvaluationOrchestrator {
	return &EvaluationOrchestrator{
		adapter:   adapter,
		publisher: publisher,
	}
}

// EvaluationRequest holds the request parameters for creating an evaluation
type EvaluationRequest struct {
	OfferID        string
	UserID         string
	EnableAI       bool
	ForceRefresh   bool
	TokensReserved int
	ReservationID  string
	AuthToken      string
}

// EvaluationResponse holds the response data for an evaluation
type EvaluationResponse struct {
	EvaluationID   string    `json:"evaluationId"`
	OfferID        string    `json:"offerId"`
	Status         string    `json:"status"`
	Message        string    `json:"message"`
	TokensReserved int       `json:"tokensReserved"`
	ReservationID  string    `json:"reservationId"`
	CreatedAt      time.Time `json:"createdAt"`
}

// CreateEvaluation creates a new evaluation record and calls Siterank HTTP API
func (o *EvaluationOrchestrator) CreateEvaluation(ctx context.Context, req *EvaluationRequest) (*EvaluationResponse, error) {
	// Generate evaluation ID
	evaluationID := fmt.Sprintf("eval_%d", time.Now().UnixNano())

	// Determine evaluation type
	evalType := "basic"
	if req.EnableAI {
		evalType = "ai_enhanced"
	}

	// Create evaluation record with status='pending'
	var err error
	if o.db != nil {
		_, err = o.db.ExecContext(ctx, `
			INSERT INTO offer_evaluations (
				id, offer_id, status, evaluation_type, tokens_consumed,
				created_at, started_at
			) VALUES ($1, $2, 'pending', $3, 0, NOW(), NOW())
		`, evaluationID, req.OfferID, evalType)
	} else if o.adapter != nil {
		_, err = o.adapter.Exec(ctx, `
			INSERT INTO offer_evaluations (
				id, offer_id, status, evaluation_type, tokens_consumed,
				created_at, started_at
			) VALUES ($1, $2, 'pending', $3, 0, NOW(), NOW())
		`, evaluationID, req.OfferID, evalType)
	} else {
		return nil, fmt.Errorf("no database connection available")
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create evaluation record: %w", err)
	}

	log.Printf("Created evaluation record: %s (type=%s, enableAI=%v)", evaluationID, evalType, req.EnableAI)

	// Publish EvaluationTaskCreated event for asynchronous processing by Siterank worker
	// This implements event-driven architecture: Offer orchestrates, Siterank executes asynchronously
	event := EvaluationTaskCreatedEvent{
		EvaluationID:    evaluationID,
		OfferID:         req.OfferID,
		UserID:          req.UserID,
		IncludeAI:       req.EnableAI,
		ForceRefresh:    req.ForceRefresh,
		AccessToken:     req.AuthToken,
		ReserveTxID:     req.ReservationID,
		EstimatedTokens: req.TokensReserved,
	}

	if err := o.publisher.Publish(ctx, event); err != nil {
		log.Printf("Failed to publish evaluation event: %v", err)
		// Update evaluation status to failed
		_, _ = o.db.ExecContext(ctx, `
			UPDATE offer_evaluations
			SET status = 'failed', error_message = $2
			WHERE id = $1
		`, evaluationID, err.Error())
		return nil, fmt.Errorf("failed to publish evaluation event: %w", err)
	}

	log.Printf("Successfully published evaluation event for %s (will be processed asynchronously)", evaluationID)

	// Prepare response
	response := &EvaluationResponse{
		EvaluationID:   evaluationID,
		OfferID:        req.OfferID,
		Status:         "pending",
		Message:        "Evaluation started successfully",
		TokensReserved: req.TokensReserved,
		ReservationID:  req.ReservationID,
		CreatedAt:      time.Now().UTC(),
	}

	log.Printf("Evaluation %s created for offer %s (type=%s, enableAI=%v, tokensReserved=%d)",
		evaluationID, req.OfferID, evalType, req.EnableAI, req.TokensReserved)

	return response, nil
}

// VerifyOfferOwnership checks if the offer exists and belongs to the user
func (o *EvaluationOrchestrator) VerifyOfferOwnership(ctx context.Context, offerID, userID string) error {
	if o.db == nil {
		return fmt.Errorf("database unavailable")
	}

	var exists bool
	err := o.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM "Offer" WHERE id=$1 AND "userId"=$2)`, offerID, userID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("database error: %w", err)
	}

	if !exists {
		return fmt.Errorf("offer not found or does not belong to user")
	}

	return nil
}

// Evaluation represents an evaluation record
type Evaluation struct {
	EvaluationID          string     `json:"evaluationId"`
	OfferID               string     `json:"offerId"`
	Status                string     `json:"status"`
	EvaluationType        string     `json:"evaluationType"`
	TokensConsumed        int        `json:"tokensConsumed"`
	SimilarWebScore       *float64   `json:"similarWebScore,omitempty"`
	AIRecommendationScore *float64   `json:"aiRecommendationScore,omitempty"`
	AIRecommendation      *string    `json:"aiRecommendation,omitempty"`
	ErrorMessage          *string    `json:"errorMessage,omitempty"`
	CreatedAt             time.Time  `json:"createdAt"`
	StartedAt             *time.Time `json:"startedAt,omitempty"`
	CompletedAt           *time.Time `json:"completedAt,omitempty"`
}

// ListEvaluations retrieves evaluation history for an offer
func (o *EvaluationOrchestrator) ListEvaluations(ctx context.Context, offerID string, limit int) ([]Evaluation, error) {
	query := `
		SELECT
			id,
			offer_id,
			status,
			evaluation_type,
			tokens_consumed,
			similarweb_score,
			ai_recommendation_score,
			ai_recommendation,
			error_message,
			created_at,
			started_at,
			completed_at
		FROM offer_evaluations
		WHERE offer_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`

	rows, err := o.db.QueryContext(ctx, query, offerID, limit)
	if err != nil {
		return nil, fmt.Errorf("database query error: %w", err)
	}
	defer rows.Close()

	evaluations := []Evaluation{}
	for rows.Next() {
		var e Evaluation
		err := rows.Scan(
			&e.EvaluationID,
			&e.OfferID,
			&e.Status,
			&e.EvaluationType,
			&e.TokensConsumed,
			&e.SimilarWebScore,
			&e.AIRecommendationScore,
			&e.AIRecommendation,
			&e.ErrorMessage,
			&e.CreatedAt,
			&e.StartedAt,
			&e.CompletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan evaluation: %w", err)
		}
		evaluations = append(evaluations, e)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	return evaluations, nil
}

// GetLatestEvaluation retrieves the latest evaluation for an offer
func (o *EvaluationOrchestrator) GetLatestEvaluation(ctx context.Context, offerID string) (*Evaluation, error) {
	query := `
		SELECT
			id,
			offer_id,
			status,
			evaluation_type,
			tokens_consumed,
			similarweb_score,
			ai_recommendation_score,
			ai_recommendation,
			error_message,
			created_at,
			started_at,
			completed_at
		FROM offer_evaluations
		WHERE offer_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`

	var evaluation Evaluation
	err := o.db.QueryRowContext(ctx, query, offerID).Scan(
		&evaluation.EvaluationID,
		&evaluation.OfferID,
		&evaluation.Status,
		&evaluation.EvaluationType,
		&evaluation.TokensConsumed,
		&evaluation.SimilarWebScore,
		&evaluation.AIRecommendationScore,
		&evaluation.AIRecommendation,
		&evaluation.ErrorMessage,
		&evaluation.CreatedAt,
		&evaluation.StartedAt,
		&evaluation.CompletedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("no evaluations found for this offer")
		}
		return nil, fmt.Errorf("failed to query evaluation: %w", err)
	}

	return &evaluation, nil
}
