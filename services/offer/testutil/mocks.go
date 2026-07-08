package testutil

import (
	"context"
	"database/sql"
)

// MockDB is a mock implementation of *sql.DB for testing
type MockDB struct {
	QueryFunc    func(query string, args ...interface{}) (*sql.Rows, error)
	QueryRowFunc func(query string, args ...interface{}) *sql.Row
	ExecFunc     func(query string, args ...interface{}) (sql.Result, error)
	BeginFunc    func() (*sql.Tx, error)
	PingFunc     func() error
}

// MockTx is a mock implementation of *sql.Tx for testing
type MockTx struct {
	CommitFunc   func() error
	RollbackFunc func() error
	ExecFunc     func(query string, args ...interface{}) (sql.Result, error)
	QueryFunc    func(query string, args ...interface{}) (*sql.Rows, error)
	QueryRowFunc func(query string, args ...interface{}) *sql.Row
}

// Commit mocks the Commit method
func (m *MockTx) Commit() error {
	if m.CommitFunc != nil {
		return m.CommitFunc()
	}
	return nil
}

// Rollback mocks the Rollback method
func (m *MockTx) Rollback() error {
	if m.RollbackFunc != nil {
		return m.RollbackFunc()
	}
	return nil
}

// Exec mocks the Exec method
func (m *MockTx) Exec(query string, args ...interface{}) (sql.Result, error) {
	if m.ExecFunc != nil {
		return m.ExecFunc(query, args...)
	}
	return nil, nil
}

// Query mocks the Query method
func (m *MockTx) Query(query string, args ...interface{}) (*sql.Rows, error) {
	if m.QueryFunc != nil {
		return m.QueryFunc(query, args...)
	}
	return nil, nil
}

// QueryRow mocks the QueryRow method
func (m *MockTx) QueryRow(query string, args ...interface{}) *sql.Row {
	if m.QueryRowFunc != nil {
		return m.QueryRowFunc(query, args...)
	}
	return nil
}

// MockEventPublisher is a mock implementation of event publisher for testing
type MockEventPublisher struct {
	PublishFunc func(ctx context.Context, event interface{}) error
	Events      []interface{} // Store published events for verification
}

// Publish mocks the Publish method and stores events
func (m *MockEventPublisher) Publish(ctx context.Context, event interface{}) error {
	m.Events = append(m.Events, event)
	if m.PublishFunc != nil {
		return m.PublishFunc(ctx, event)
	}
	return nil
}

// GetEvents returns all published events
func (m *MockEventPublisher) GetEvents() []interface{} {
	return m.Events
}

// GetEventCount returns the number of published events
func (m *MockEventPublisher) GetEventCount() int {
	return len(m.Events)
}

// GetLastEvent returns the last published event
func (m *MockEventPublisher) GetLastEvent() interface{} {
	if len(m.Events) == 0 {
		return nil
	}
	return m.Events[len(m.Events)-1]
}

// Reset clears all stored events
func (m *MockEventPublisher) Reset() {
	m.Events = []interface{}{}
}

// MockSiterankClient is a mock implementation of siterank client for testing
type MockSiterankClient struct {
	EvaluateFunc func(ctx context.Context, url string) (*SiterankResult, error)
}

// SiterankResult represents the result from siterank service
type SiterankResult struct {
	Score     float64
	FinalURL  string
	Domain    string
	BrandName string
}

// Evaluate mocks the Evaluate method
func (m *MockSiterankClient) Evaluate(ctx context.Context, url string) (*SiterankResult, error) {
	if m.EvaluateFunc != nil {
		return m.EvaluateFunc(ctx, url)
	}
	// Default mock response
	score := 85.5
	return &SiterankResult{
		Score:     score,
		FinalURL:  url,
		Domain:    "example.com",
		BrandName: "Example",
	}, nil
}

// MockOfferRepository is a mock implementation of offer repository for testing
type MockOfferRepository struct {
	CreateFunc func(ctx context.Context, offer interface{}) error
	GetFunc    func(ctx context.Context, id string) (interface{}, error)
	UpdateFunc func(ctx context.Context, offer interface{}) error
	DeleteFunc func(ctx context.Context, id string) error
	ListFunc   func(ctx context.Context, userID string) ([]interface{}, error)
}

// Create mocks the Create method
func (m *MockOfferRepository) Create(ctx context.Context, offer interface{}) error {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, offer)
	}
	return nil
}

// Get mocks the Get method
func (m *MockOfferRepository) Get(ctx context.Context, id string) (interface{}, error) {
	if m.GetFunc != nil {
		return m.GetFunc(ctx, id)
	}
	return NewTestOffer(), nil
}

// Update mocks the Update method
func (m *MockOfferRepository) Update(ctx context.Context, offer interface{}) error {
	if m.UpdateFunc != nil {
		return m.UpdateFunc(ctx, offer)
	}
	return nil
}

// Delete mocks the Delete method
func (m *MockOfferRepository) Delete(ctx context.Context, id string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, id)
	}
	return nil
}

// List mocks the List method
func (m *MockOfferRepository) List(ctx context.Context, userID string) ([]interface{}, error) {
	if m.ListFunc != nil {
		return m.ListFunc(ctx, userID)
	}
	return []interface{}{NewTestOffer()}, nil
}

// NewMockEventPublisher creates a new MockEventPublisher
func NewMockEventPublisher() *MockEventPublisher {
	return &MockEventPublisher{
		Events: []interface{}{},
	}
}

// NewMockSiterankClient creates a new MockSiterankClient with default behavior
func NewMockSiterankClient() *MockSiterankClient {
	return &MockSiterankClient{}
}

// NewMockOfferRepository creates a new MockOfferRepository with default behavior
func NewMockOfferRepository() *MockOfferRepository {
	return &MockOfferRepository{}
}
