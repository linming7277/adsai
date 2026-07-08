package testutil

import (
	"time"

	"github.com/xxrenzhe/autoads/services/offer/internal/domain"
)

// NewTestOffer creates a test Offer with default values
func NewTestOffer() *domain.Offer {
	now := time.Now()
	score := 85.5

	return &domain.Offer{
		ID:               "test-offer-1",
		UserID:           "test-user-1",
		Name:             "Test Offer",
		OriginalURL:      "https://example.com",
		TargetCountries:  []string{"US"},
		FinalURL:         "https://example.com",
		Domain:           "example.com",
		Status:           "evaluating",
		EvaluationStatus: "not_evaluated",
		SimulationStatus: "not_simulated",
		LaunchStatus:     "not_launched",
		SiterankScore:    &score,
		LinkedAccountIDs: []string{},
		CreatedAt:        now,
		UpdatedAt:        now,
	}
}

// NewTestOfferWithStatus creates a test Offer with specific status
func NewTestOfferWithStatus(status string) *domain.Offer {
	offer := NewTestOffer()
	offer.Status = status
	return offer
}

// NewTestOfferEvaluated creates a test Offer that has been evaluated
func NewTestOfferEvaluated() *domain.Offer {
	offer := NewTestOffer()
	offer.Status = "evaluated"
	offer.EvaluationStatus = "evaluated"
	score := 85.5
	offer.SiterankScore = &score
	offer.FinalURL = "https://example.com"
	offer.Domain = "example.com"
	return offer
}

// NewTestOfferCreatedEvent creates a test OfferCreatedEvent
func NewTestOfferCreatedEvent() *domain.OfferCreatedEvent {
	return &domain.OfferCreatedEvent{
		OfferID:     "test-offer-1",
		UserID:      "test-user-1",
		Name:        "Test Offer",
		OriginalUrl: "https://example.com",
		Status:      "evaluating",
		CreatedAt:   time.Now(),
	}
}

// TestOfferBuilder provides a fluent interface for building test Offers
type TestOfferBuilder struct {
	offer *domain.Offer
}

// NewOfferBuilder creates a new TestOfferBuilder
func NewOfferBuilder() *TestOfferBuilder {
	return &TestOfferBuilder{
		offer: NewTestOffer(),
	}
}

// WithID sets the offer ID
func (b *TestOfferBuilder) WithID(id string) *TestOfferBuilder {
	b.offer.ID = id
	return b
}

// WithUserID sets the user ID
func (b *TestOfferBuilder) WithUserID(userID string) *TestOfferBuilder {
	b.offer.UserID = userID
	return b
}

// WithName sets the offer name
func (b *TestOfferBuilder) WithName(name string) *TestOfferBuilder {
	b.offer.Name = name
	return b
}

// WithURL sets the offer URL
func (b *TestOfferBuilder) WithURL(url string) *TestOfferBuilder {
	b.offer.OriginalURL = url
	b.offer.FinalURL = url
	return b
}

// WithStatus sets the offer status
func (b *TestOfferBuilder) WithStatus(status string) *TestOfferBuilder {
	b.offer.Status = status
	return b
}

// WithScore sets the siterank score
func (b *TestOfferBuilder) WithScore(score float64) *TestOfferBuilder {
	b.offer.SiterankScore = &score
	return b
}

// WithDomain sets the domain
func (b *TestOfferBuilder) WithDomain(domain string) *TestOfferBuilder {
	b.offer.Domain = domain
	return b
}

// Build returns the built Offer
func (b *TestOfferBuilder) Build() *domain.Offer {
	return b.offer
}
