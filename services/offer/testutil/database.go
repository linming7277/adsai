package testutil

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"testing"

	_ "github.com/lib/pq" // PostgreSQL driver
)

// TestDB represents a test database connection
type TestDB struct {
	DB *sql.DB
	t  *testing.T
}

// NewTestDB creates a new test database connection
// It uses the TEST_DATABASE_URL environment variable or falls back to a default
func NewTestDB(t *testing.T) *TestDB {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		// Default test database URL
		dbURL = "postgresql://postgres:postgres@localhost:5432/offer_test?sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	// Ping to verify connection
	if err := db.Ping(); err != nil {
		t.Fatalf("Failed to ping test database: %v", err)
	}

	return &TestDB{
		DB: db,
		t:  t,
	}
}

// Close closes the test database connection
func (tdb *TestDB) Close() {
	if err := tdb.DB.Close(); err != nil {
		tdb.t.Errorf("Failed to close test database: %v", err)
	}
}

// Cleanup cleans up test data from the database
func (tdb *TestDB) Cleanup() {
	ctx := context.Background()

	// Clean up test tables in reverse order of dependencies
	tables := []string{
		"OfferKpiDeadLetter",
		"OfferPreferences",
		"OfferStatusHistory",
		"Offer",
	}

	for _, table := range tables {
		query := fmt.Sprintf("DELETE FROM %s WHERE id LIKE 'test-%%'", table)
		if _, err := tdb.DB.ExecContext(ctx, query); err != nil {
			tdb.t.Logf("Warning: Failed to clean up table %s: %v", table, err)
		}
	}
}

// BeginTx starts a new transaction for testing
func (tdb *TestDB) BeginTx(ctx context.Context) (*sql.Tx, error) {
	return tdb.DB.BeginTx(ctx, nil)
}

// SetupTestTables creates test tables if they don't exist
// This is useful for integration tests
func (tdb *TestDB) SetupTestTables() {
	ctx := context.Background()

	// Create Offer table
	offerTable := `
	CREATE TABLE IF NOT EXISTS "Offer" (
		id VARCHAR(255) PRIMARY KEY,
		user_id VARCHAR(255) NOT NULL,
		name VARCHAR(255) NOT NULL,
		original_url TEXT NOT NULL,
		final_url TEXT,
		domain VARCHAR(255),
		description TEXT,
		status VARCHAR(50) NOT NULL DEFAULT 'evaluating',
		evaluation_status VARCHAR(50),
		siterank_score FLOAT,
		created_at TIMESTAMP NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMP NOT NULL DEFAULT NOW()
	);
	`

	if _, err := tdb.DB.ExecContext(ctx, offerTable); err != nil {
		tdb.t.Fatalf("Failed to create Offer table: %v", err)
	}

	// Create OfferStatusHistory table
	statusHistoryTable := `
	CREATE TABLE IF NOT EXISTS "OfferStatusHistory" (
		id BIGSERIAL PRIMARY KEY,
		offer_id VARCHAR(255) NOT NULL,
		old_status VARCHAR(50),
		new_status VARCHAR(50) NOT NULL,
		changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
		FOREIGN KEY (offer_id) REFERENCES "Offer"(id) ON DELETE CASCADE
	);
	`

	if _, err := tdb.DB.ExecContext(ctx, statusHistoryTable); err != nil {
		tdb.t.Fatalf("Failed to create OfferStatusHistory table: %v", err)
	}

	// Create OfferPreferences table
	preferencesTable := `
	CREATE TABLE IF NOT EXISTS "OfferPreferences" (
		offer_id VARCHAR(255) PRIMARY KEY,
		preferences JSONB NOT NULL DEFAULT '{}',
		updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
		FOREIGN KEY (offer_id) REFERENCES "Offer"(id) ON DELETE CASCADE
	);
	`

	if _, err := tdb.DB.ExecContext(ctx, preferencesTable); err != nil {
		tdb.t.Fatalf("Failed to create OfferPreferences table: %v", err)
	}

	// Create idempotency_keys table
	idempotencyTable := `
	CREATE TABLE IF NOT EXISTS idempotency_keys (
		key VARCHAR(255) PRIMARY KEY,
		created_at TIMESTAMP NOT NULL DEFAULT NOW()
	);
	`

	if _, err := tdb.DB.ExecContext(ctx, idempotencyTable); err != nil {
		tdb.t.Fatalf("Failed to create idempotency_keys table: %v", err)
	}
}

// TeardownTestTables drops test tables
// Use with caution - only for test cleanup
func (tdb *TestDB) TeardownTestTables() {
	ctx := context.Background()

	tables := []string{
		"OfferKpiDeadLetter",
		"OfferPreferences",
		"OfferStatusHistory",
		"Offer",
		"idempotency_keys",
	}

	for _, table := range tables {
		query := fmt.Sprintf("DROP TABLE IF EXISTS %s CASCADE", table)
		if _, err := tdb.DB.ExecContext(ctx, query); err != nil {
			tdb.t.Logf("Warning: Failed to drop table %s: %v", table, err)
		}
	}
}

// InsertTestOffer inserts a test offer into the database
func (tdb *TestDB) InsertTestOffer(ctx context.Context, offer interface{}) error {
	// This is a simplified version - adjust based on actual Offer struct
	query := `
		INSERT INTO "Offer" (id, user_id, name, original_url, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	// Type assertion would be needed here based on actual Offer type
	// For now, using test offer
	testOffer := NewTestOffer()

	_, err := tdb.DB.ExecContext(ctx, query,
		testOffer.ID,
		testOffer.UserID,
		testOffer.Name,
		testOffer.OriginalURL,
		testOffer.Status,
		testOffer.CreatedAt,
		testOffer.UpdatedAt,
	)

	return err
}

// GetTestOffer retrieves a test offer from the database
func (tdb *TestDB) GetTestOffer(ctx context.Context, id string) (interface{}, error) {
	query := `
		SELECT id, user_id, name, original_url, final_url, domain,
		       status, evaluation_status, siterank_score, created_at, updated_at
		FROM "Offer"
		WHERE id = $1
	`

	row := tdb.DB.QueryRowContext(ctx, query, id)

	offer := NewTestOffer()
	err := row.Scan(
		&offer.ID,
		&offer.UserID,
		&offer.Name,
		&offer.OriginalURL,
		&offer.FinalURL,
		&offer.Domain,
		&offer.Status,
		&offer.EvaluationStatus,
		&offer.SiterankScore,
		&offer.CreatedAt,
		&offer.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return offer, nil
}
