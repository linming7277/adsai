package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewOffer(t *testing.T) {
	t.Run("creates offer with default values", func(t *testing.T) {
		// Arrange
		id := "offer-1"
		userID := "user-1"
		name := "Test Offer"
		url := "https://example.com"
		countries := []string{"US", "UK"}

		// Act
		offer := NewOffer(id, userID, name, url, countries)

		// Assert
		assert.Equal(t, id, offer.ID)
		assert.Equal(t, userID, offer.UserID)
		assert.Equal(t, name, offer.Name)
		assert.Equal(t, url, offer.OriginalURL)
		assert.Equal(t, countries, offer.TargetCountries)
		assert.Equal(t, "evaluating", offer.Status)
		assert.Equal(t, "not_evaluated", offer.EvaluationStatus)
		assert.Equal(t, "not_simulated", offer.SimulationStatus)
		assert.Equal(t, "not_launched", offer.LaunchStatus)
		assert.Empty(t, offer.LinkedAccountIDs)
		assert.NotZero(t, offer.CreatedAt)
		assert.NotZero(t, offer.UpdatedAt)
	})

	t.Run("uses default US country when empty", func(t *testing.T) {
		// Arrange
		countries := []string{}

		// Act
		offer := NewOffer("id", "user", "name", "url", countries)

		// Assert
		assert.Equal(t, []string{"US"}, offer.TargetCountries)
	})
}

func TestOffer_CompleteEvaluation(t *testing.T) {
	t.Run("updates evaluation fields correctly", func(t *testing.T) {
		// Arrange
		offer := NewOffer("id", "user", "Test", "https://example.com", []string{"US"})
		score := 85.5
		finalURL := "https://example.com/final"
		domain := "example.com"
		brandName := "Example Brand"
		beforeUpdate := offer.UpdatedAt

		// Wait a bit to ensure UpdatedAt changes
		time.Sleep(time.Millisecond)

		// Act
		offer.CompleteEvaluation(score, finalURL, domain, brandName)

		// Assert
		assert.Equal(t, "evaluated", offer.EvaluationStatus)
		assert.NotNil(t, offer.SiterankScore)
		assert.Equal(t, score, *offer.SiterankScore)
		assert.Equal(t, finalURL, offer.FinalURL)
		assert.Equal(t, domain, offer.Domain)
		assert.Equal(t, "Test", offer.Name) // Name should not change if already set
		assert.True(t, offer.UpdatedAt.After(beforeUpdate))
	})

	t.Run("updates name when empty or Unnamed", func(t *testing.T) {
		tests := []struct {
			name         string
			initialName  string
			brandName    string
			expectedName string
		}{
			{"empty name", "", "Brand", "Brand"},
			{"Unnamed", "Unnamed", "Brand", "Brand"},
			{"existing name", "Existing", "Brand", "Existing"},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				// Arrange
				offer := NewOffer("id", "user", tt.initialName, "url", []string{"US"})

				// Act
				offer.CompleteEvaluation(85.0, "url", "domain", tt.brandName)

				// Assert
				assert.Equal(t, tt.expectedName, offer.Name)
			})
		}
	})
}

func TestOffer_StartEvaluation(t *testing.T) {
	t.Run("updates evaluation status", func(t *testing.T) {
		// Arrange
		offer := NewOffer("id", "user", "name", "url", []string{"US"})
		beforeUpdate := offer.UpdatedAt

		time.Sleep(time.Millisecond)

		// Act
		offer.StartEvaluation()

		// Assert
		assert.Equal(t, "evaluating", offer.EvaluationStatus)
		assert.True(t, offer.UpdatedAt.After(beforeUpdate))
	})
}

func TestOffer_FailEvaluation(t *testing.T) {
	t.Run("marks evaluation as failed", func(t *testing.T) {
		// Arrange
		offer := NewOffer("id", "user", "name", "url", []string{"US"})
		offer.StartEvaluation()
		beforeUpdate := offer.UpdatedAt

		time.Sleep(time.Millisecond)

		// Act
		offer.FailEvaluation()

		// Assert
		assert.Equal(t, "failed", offer.EvaluationStatus)
		assert.True(t, offer.UpdatedAt.After(beforeUpdate))
	})
}

func TestOffer_UpdateSiterankScore(t *testing.T) {
	t.Run("updates score and status", func(t *testing.T) {
		// Arrange
		offer := NewOffer("id", "user", "name", "url", []string{"US"})
		score := 90.5
		beforeUpdate := offer.UpdatedAt

		time.Sleep(time.Millisecond)

		// Act
		offer.UpdateSiterankScore(score)

		// Assert
		assert.NotNil(t, offer.SiterankScore)
		assert.Equal(t, score, *offer.SiterankScore)
		assert.Equal(t, "optimizing", offer.Status)
		assert.True(t, offer.UpdatedAt.After(beforeUpdate))
	})
}

func TestOffer_Archive(t *testing.T) {
	t.Run("archives offer", func(t *testing.T) {
		// Arrange
		offer := NewOffer("id", "user", "name", "url", []string{"US"})
		beforeUpdate := offer.UpdatedAt

		time.Sleep(time.Millisecond)

		// Act
		offer.Archive()

		// Assert
		assert.Equal(t, "archived", offer.Status)
		assert.True(t, offer.UpdatedAt.After(beforeUpdate))
	})
}

func TestOffer_UpdateTargetCountries(t *testing.T) {
	t.Run("updates target countries", func(t *testing.T) {
		// Arrange
		offer := NewOffer("id", "user", "name", "url", []string{"US"})
		newCountries := []string{"UK", "CA", "AU"}
		beforeUpdate := offer.UpdatedAt

		time.Sleep(time.Millisecond)

		// Act
		offer.UpdateTargetCountries(newCountries)

		// Assert
		assert.Equal(t, newCountries, offer.TargetCountries)
		assert.True(t, offer.UpdatedAt.After(beforeUpdate))
	})
}

func TestOffer_UpdateName(t *testing.T) {
	t.Run("updates offer name", func(t *testing.T) {
		// Arrange
		offer := NewOffer("id", "user", "Old Name", "url", []string{"US"})
		newName := "New Name"
		beforeUpdate := offer.UpdatedAt

		time.Sleep(time.Millisecond)

		// Act
		offer.UpdateName(newName)

		// Assert
		assert.Equal(t, newName, offer.Name)
		assert.True(t, offer.UpdatedAt.After(beforeUpdate))
	})
}

func TestOffer_AddRevenue(t *testing.T) {
	t.Run("adds revenue and calculates ROAS", func(t *testing.T) {
		// Arrange
		offer := NewOffer("id", "user", "name", "url", []string{"US"})
		offer.AdSpend = 100.0
		beforeUpdate := offer.UpdatedAt

		time.Sleep(time.Millisecond)

		// Act
		offer.AddRevenue(300.0)

		// Assert
		assert.Equal(t, 300.0, offer.TotalRevenue)
		assert.Equal(t, 3.0, offer.ROAS) // 300 / 100 = 3.0
		assert.True(t, offer.UpdatedAt.After(beforeUpdate))
	})

	t.Run("accumulates revenue", func(t *testing.T) {
		// Arrange
		offer := NewOffer("id", "user", "name", "url", []string{"US"})
		offer.AdSpend = 100.0

		// Act
		offer.AddRevenue(100.0)
		offer.AddRevenue(200.0)

		// Assert
		assert.Equal(t, 300.0, offer.TotalRevenue)
		assert.Equal(t, 3.0, offer.ROAS)
	})

	t.Run("handles zero ad spend", func(t *testing.T) {
		// Arrange
		offer := NewOffer("id", "user", "name", "url", []string{"US"})
		offer.AdSpend = 0.0

		// Act
		offer.AddRevenue(100.0)

		// Assert
		assert.Equal(t, 100.0, offer.TotalRevenue)
		assert.Equal(t, 0.0, offer.ROAS) // Should not divide by zero
	})
}

func TestOffer_RemoveRevenue(t *testing.T) {
	t.Run("removes revenue and recalculates ROAS", func(t *testing.T) {
		// Arrange
		offer := NewOffer("id", "user", "name", "url", []string{"US"})
		offer.TotalRevenue = 300.0
		offer.AdSpend = 100.0
		offer.ROAS = 3.0
		beforeUpdate := offer.UpdatedAt

		time.Sleep(time.Millisecond)

		// Act
		offer.RemoveRevenue(100.0)

		// Assert
		assert.Equal(t, 200.0, offer.TotalRevenue)
		assert.Equal(t, 2.0, offer.ROAS) // 200 / 100 = 2.0
		assert.True(t, offer.UpdatedAt.After(beforeUpdate))
	})

	t.Run("prevents negative revenue", func(t *testing.T) {
		// Arrange
		offer := NewOffer("id", "user", "name", "url", []string{"US"})
		offer.TotalRevenue = 50.0
		offer.AdSpend = 100.0

		// Act
		offer.RemoveRevenue(100.0)

		// Assert
		assert.Equal(t, 0.0, offer.TotalRevenue) // Should not go negative
		assert.Equal(t, 0.0, offer.ROAS)
	})
}

func TestOffer_UpdateKPIs(t *testing.T) {
	t.Run("updates all KPI metrics", func(t *testing.T) {
		// Arrange
		offer := NewOffer("id", "user", "name", "url", []string{"US"})
		offer.TotalRevenue = 500.0
		impressions := int64(10000)
		clicks := int64(100)
		adSpend := 200.0
		beforeUpdate := offer.UpdatedAt

		time.Sleep(time.Millisecond)

		// Act
		offer.UpdateKPIs(impressions, clicks, adSpend)

		// Assert
		assert.Equal(t, impressions, offer.Impressions)
		assert.Equal(t, clicks, offer.Clicks)
		assert.Equal(t, adSpend, offer.AdSpend)
		assert.Equal(t, 0.01, offer.CTR)   // 100 / 10000 = 0.01
		assert.Equal(t, 2.0, offer.AvgCPC) // 200 / 100 = 2.0
		assert.Equal(t, 2.5, offer.ROAS)   // 500 / 200 = 2.5
		assert.True(t, offer.UpdatedAt.After(beforeUpdate))
	})

	t.Run("handles zero impressions", func(t *testing.T) {
		// Arrange
		offer := NewOffer("id", "user", "name", "url", []string{"US"})

		// Act
		offer.UpdateKPIs(0, 0, 100.0)

		// Assert
		assert.Equal(t, 0.0, offer.CTR)
		assert.Equal(t, 0.0, offer.AvgCPC)
	})

	t.Run("handles zero clicks", func(t *testing.T) {
		// Arrange
		offer := NewOffer("id", "user", "name", "url", []string{"US"})

		// Act
		offer.UpdateKPIs(10000, 0, 100.0)

		// Assert
		assert.Equal(t, 0.0, offer.CTR)
		assert.Equal(t, 0.0, offer.AvgCPC)
	})

	t.Run("calculates CTR correctly", func(t *testing.T) {
		tests := []struct {
			name        string
			impressions int64
			clicks      int64
			expectedCTR float64
		}{
			{"1% CTR", 10000, 100, 0.01},
			{"5% CTR", 1000, 50, 0.05},
			{"10% CTR", 100, 10, 0.1},
			{"0% CTR", 1000, 0, 0.0},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				// Arrange
				offer := NewOffer("id", "user", "name", "url", []string{"US"})

				// Act
				offer.UpdateKPIs(tt.impressions, tt.clicks, 100.0)

				// Assert
				assert.InDelta(t, tt.expectedCTR, offer.CTR, 0.0001)
			})
		}
	})

	t.Run("calculates AvgCPC correctly", func(t *testing.T) {
		tests := []struct {
			name           string
			clicks         int64
			adSpend        float64
			expectedAvgCPC float64
		}{
			{"$2 CPC", 100, 200.0, 2.0},
			{"$1.5 CPC", 100, 150.0, 1.5},
			{"$0.5 CPC", 100, 50.0, 0.5},
			{"zero clicks", 0, 100.0, 0.0},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				// Arrange
				offer := NewOffer("id", "user", "name", "url", []string{"US"})

				// Act
				offer.UpdateKPIs(10000, tt.clicks, tt.adSpend)

				// Assert
				assert.InDelta(t, tt.expectedAvgCPC, offer.AvgCPC, 0.0001)
			})
		}
	})
}

func TestOffer_calculateROAS(t *testing.T) {
	t.Run("calculates ROAS correctly", func(t *testing.T) {
		tests := []struct {
			name         string
			revenue      float64
			adSpend      float64
			expectedROAS float64
		}{
			{"3x ROAS", 300.0, 100.0, 3.0},
			{"2x ROAS", 200.0, 100.0, 2.0},
			{"1x ROAS", 100.0, 100.0, 1.0},
			{"0.5x ROAS", 50.0, 100.0, 0.5},
			{"zero spend", 100.0, 0.0, 0.0},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				// Arrange
				offer := NewOffer("id", "user", "name", "url", []string{"US"})
				offer.TotalRevenue = tt.revenue
				offer.AdSpend = tt.adSpend

				// Act
				offer.calculateROAS()

				// Assert
				assert.Equal(t, tt.expectedROAS, offer.ROAS)
			})
		}
	})
}

// Benchmark tests
func BenchmarkNewOffer(b *testing.B) {
	for i := 0; i < b.N; i++ {
		NewOffer("id", "user", "name", "url", []string{"US"})
	}
}

func BenchmarkOffer_CompleteEvaluation(b *testing.B) {
	offer := NewOffer("id", "user", "name", "url", []string{"US"})
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		offer.CompleteEvaluation(85.0, "url", "domain", "brand")
	}
}

func BenchmarkOffer_UpdateKPIs(b *testing.B) {
	offer := NewOffer("id", "user", "name", "url", []string{"US"})
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		offer.UpdateKPIs(10000, 100, 200.0)
	}
}
