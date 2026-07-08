package domain

import (
	"time"
)

// OfferCreatedEvent represents the event when a user creates a new offer.
type OfferCreatedEvent struct {
	OfferID     string    `json:"offerId"`
	UserID      string    `json:"userId"`
	Name        string    `json:"name"`
	OriginalUrl string    `json:"originalUrl"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
}

// EventType returns the type of the event.
func (e OfferCreatedEvent) EventType() string {
	return "offer.created"
}

// EvaluationRequestedEvent represents the event when an offer evaluation is requested.
type EvaluationRequestedEvent struct {
	EvaluationID   string `json:"evaluationId"`
	OfferID        string `json:"offerId"`
	UserID         string `json:"userId"`
	IncludeAI      bool   `json:"includeAI"`
	ForceRefresh   bool   `json:"forceRefresh"`
	TokensReserved int    `json:"tokensReserved"`
	ReservationID  string `json:"reservationId"`
	AuthToken      string `json:"authToken"`
}

// EventType returns the type of the event.
func (e EvaluationRequestedEvent) EventType() string {
	return "evaluation.requested"
}
