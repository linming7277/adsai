package domain

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOfferCreatedEvent_EventType(t *testing.T) {
	t.Run("returns correct event type", func(t *testing.T) {
		// Arrange
		event := OfferCreatedEvent{}

		// Act
		eventType := event.EventType()

		// Assert
		assert.Equal(t, "offer.created", eventType)
	})
}

func TestOfferCreatedEvent_Serialization(t *testing.T) {
	t.Run("serializes to JSON correctly", func(t *testing.T) {
		// Arrange
		now := time.Date(2025, 10, 8, 10, 0, 0, 0, time.UTC)
		event := OfferCreatedEvent{
			OfferID:     "offer-123",
			UserID:      "user-456",
			Name:        "Test Offer",
			OriginalUrl: "https://example.com",
			Status:      "evaluating",
			CreatedAt:   now,
		}

		// Act
		jsonData, err := json.Marshal(event)

		// Assert
		require.NoError(t, err)
		assert.NotEmpty(t, jsonData)

		// Verify JSON structure
		var decoded map[string]interface{}
		err = json.Unmarshal(jsonData, &decoded)
		require.NoError(t, err)

		assert.Equal(t, "offer-123", decoded["offerId"])
		assert.Equal(t, "user-456", decoded["userId"])
		assert.Equal(t, "Test Offer", decoded["name"])
		assert.Equal(t, "https://example.com", decoded["originalUrl"])
		assert.Equal(t, "evaluating", decoded["status"])
		assert.NotNil(t, decoded["createdAt"])
	})

	t.Run("deserializes from JSON correctly", func(t *testing.T) {
		// Arrange
		jsonData := `{
			"offerId": "offer-123",
			"userId": "user-456",
			"name": "Test Offer",
			"originalUrl": "https://example.com",
			"status": "evaluating",
			"createdAt": "2025-10-08T10:00:00Z"
		}`

		// Act
		var event OfferCreatedEvent
		err := json.Unmarshal([]byte(jsonData), &event)

		// Assert
		require.NoError(t, err)
		assert.Equal(t, "offer-123", event.OfferID)
		assert.Equal(t, "user-456", event.UserID)
		assert.Equal(t, "Test Offer", event.Name)
		assert.Equal(t, "https://example.com", event.OriginalUrl)
		assert.Equal(t, "evaluating", event.Status)
		assert.False(t, event.CreatedAt.IsZero())
	})

	t.Run("round-trip serialization preserves data", func(t *testing.T) {
		// Arrange
		original := OfferCreatedEvent{
			OfferID:     "offer-123",
			UserID:      "user-456",
			Name:        "Test Offer",
			OriginalUrl: "https://example.com",
			Status:      "evaluating",
			CreatedAt:   time.Now().UTC(),
		}

		// Act - Serialize
		jsonData, err := json.Marshal(original)
		require.NoError(t, err)

		// Act - Deserialize
		var decoded OfferCreatedEvent
		err = json.Unmarshal(jsonData, &decoded)
		require.NoError(t, err)

		// Assert
		assert.Equal(t, original.OfferID, decoded.OfferID)
		assert.Equal(t, original.UserID, decoded.UserID)
		assert.Equal(t, original.Name, decoded.Name)
		assert.Equal(t, original.OriginalUrl, decoded.OriginalUrl)
		assert.Equal(t, original.Status, decoded.Status)
		// Compare timestamps with tolerance for serialization precision
		assert.WithinDuration(t, original.CreatedAt, decoded.CreatedAt, time.Second)
	})
}

func TestOfferCreatedEvent_Validation(t *testing.T) {
	t.Run("handles empty fields", func(t *testing.T) {
		// Arrange
		event := OfferCreatedEvent{}

		// Act
		jsonData, err := json.Marshal(event)

		// Assert
		require.NoError(t, err)
		assert.NotEmpty(t, jsonData)

		// Verify empty fields are serialized
		var decoded map[string]interface{}
		err = json.Unmarshal(jsonData, &decoded)
		require.NoError(t, err)

		assert.Equal(t, "", decoded["offerId"])
		assert.Equal(t, "", decoded["userId"])
		assert.Equal(t, "", decoded["name"])
	})

	t.Run("handles special characters in fields", func(t *testing.T) {
		// Arrange
		event := OfferCreatedEvent{
			OfferID:     "offer-123",
			UserID:      "user-456",
			Name:        "Test \"Offer\" with 'quotes' & special <chars>",
			OriginalUrl: "https://example.com/path?param=value&other=123",
			Status:      "evaluating",
			CreatedAt:   time.Now(),
		}

		// Act
		jsonData, err := json.Marshal(event)
		require.NoError(t, err)

		var decoded OfferCreatedEvent
		err = json.Unmarshal(jsonData, &decoded)

		// Assert
		require.NoError(t, err)
		assert.Equal(t, event.Name, decoded.Name)
		assert.Equal(t, event.OriginalUrl, decoded.OriginalUrl)
	})

	t.Run("handles unicode characters", func(t *testing.T) {
		// Arrange
		event := OfferCreatedEvent{
			OfferID:     "offer-123",
			UserID:      "user-456",
			Name:        "测试优惠 🎉",
			OriginalUrl: "https://例え.com",
			Status:      "evaluating",
			CreatedAt:   time.Now(),
		}

		// Act
		jsonData, err := json.Marshal(event)
		require.NoError(t, err)

		var decoded OfferCreatedEvent
		err = json.Unmarshal(jsonData, &decoded)

		// Assert
		require.NoError(t, err)
		assert.Equal(t, event.Name, decoded.Name)
		assert.Equal(t, event.OriginalUrl, decoded.OriginalUrl)
	})
}

func TestOfferCreatedEvent_EdgeCases(t *testing.T) {
	t.Run("handles very long strings", func(t *testing.T) {
		// Arrange
		longString := string(make([]byte, 10000))
		for i := range longString {
			longString = longString[:i] + "a" + longString[i+1:]
		}

		event := OfferCreatedEvent{
			OfferID:     "offer-123",
			UserID:      "user-456",
			Name:        longString,
			OriginalUrl: "https://example.com",
			Status:      "evaluating",
			CreatedAt:   time.Now(),
		}

		// Act
		jsonData, err := json.Marshal(event)
		require.NoError(t, err)

		var decoded OfferCreatedEvent
		err = json.Unmarshal(jsonData, &decoded)

		// Assert
		require.NoError(t, err)
		assert.Equal(t, len(event.Name), len(decoded.Name))
	})

	t.Run("handles zero time", func(t *testing.T) {
		// Arrange
		event := OfferCreatedEvent{
			OfferID:     "offer-123",
			UserID:      "user-456",
			Name:        "Test",
			OriginalUrl: "https://example.com",
			Status:      "evaluating",
			CreatedAt:   time.Time{}, // Zero time
		}

		// Act
		jsonData, err := json.Marshal(event)
		require.NoError(t, err)

		var decoded OfferCreatedEvent
		err = json.Unmarshal(jsonData, &decoded)

		// Assert
		require.NoError(t, err)
		assert.True(t, decoded.CreatedAt.IsZero())
	})

	t.Run("handles future timestamps", func(t *testing.T) {
		// Arrange
		futureTime := time.Now().Add(365 * 24 * time.Hour) // 1 year in future
		event := OfferCreatedEvent{
			OfferID:     "offer-123",
			UserID:      "user-456",
			Name:        "Test",
			OriginalUrl: "https://example.com",
			Status:      "evaluating",
			CreatedAt:   futureTime,
		}

		// Act
		jsonData, err := json.Marshal(event)
		require.NoError(t, err)

		var decoded OfferCreatedEvent
		err = json.Unmarshal(jsonData, &decoded)

		// Assert
		require.NoError(t, err)
		assert.WithinDuration(t, futureTime, decoded.CreatedAt, time.Second)
	})
}

func TestOfferCreatedEvent_JSONFieldNames(t *testing.T) {
	t.Run("uses correct JSON field names", func(t *testing.T) {
		// Arrange
		event := OfferCreatedEvent{
			OfferID:     "offer-123",
			UserID:      "user-456",
			Name:        "Test",
			OriginalUrl: "https://example.com",
			Status:      "evaluating",
			CreatedAt:   time.Now(),
		}

		// Act
		jsonData, err := json.Marshal(event)
		require.NoError(t, err)

		// Assert - Check JSON field names match struct tags
		jsonString := string(jsonData)
		assert.Contains(t, jsonString, "offerId")
		assert.Contains(t, jsonString, "userId")
		assert.Contains(t, jsonString, "name")
		assert.Contains(t, jsonString, "originalUrl")
		assert.Contains(t, jsonString, "status")
		assert.Contains(t, jsonString, "createdAt")

		// Should NOT contain Go field names
		assert.NotContains(t, jsonString, "OfferID")
		assert.NotContains(t, jsonString, "UserID")
		assert.NotContains(t, jsonString, "OriginalUrl")
		assert.NotContains(t, jsonString, "CreatedAt")
	})
}

func TestOfferCreatedEvent_Comparison(t *testing.T) {
	t.Run("two events with same data are equal", func(t *testing.T) {
		// Arrange
		now := time.Now().UTC()
		event1 := OfferCreatedEvent{
			OfferID:     "offer-123",
			UserID:      "user-456",
			Name:        "Test",
			OriginalUrl: "https://example.com",
			Status:      "evaluating",
			CreatedAt:   now,
		}
		event2 := OfferCreatedEvent{
			OfferID:     "offer-123",
			UserID:      "user-456",
			Name:        "Test",
			OriginalUrl: "https://example.com",
			Status:      "evaluating",
			CreatedAt:   now,
		}

		// Assert
		assert.Equal(t, event1, event2)
	})

	t.Run("two events with different data are not equal", func(t *testing.T) {
		// Arrange
		event1 := OfferCreatedEvent{
			OfferID: "offer-123",
			UserID:  "user-456",
		}
		event2 := OfferCreatedEvent{
			OfferID: "offer-789",
			UserID:  "user-456",
		}

		// Assert
		assert.NotEqual(t, event1, event2)
	})
}

// Benchmark tests
func BenchmarkOfferCreatedEvent_Marshal(b *testing.B) {
	event := OfferCreatedEvent{
		OfferID:     "offer-123",
		UserID:      "user-456",
		Name:        "Test Offer",
		OriginalUrl: "https://example.com",
		Status:      "evaluating",
		CreatedAt:   time.Now(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = json.Marshal(event)
	}
}

func BenchmarkOfferCreatedEvent_Unmarshal(b *testing.B) {
	jsonData := []byte(`{
		"offerId": "offer-123",
		"userId": "user-456",
		"name": "Test Offer",
		"originalUrl": "https://example.com",
		"status": "evaluating",
		"createdAt": "2025-10-08T10:00:00Z"
	}`)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var event OfferCreatedEvent
		_ = json.Unmarshal(jsonData, &event)
	}
}

func BenchmarkOfferCreatedEvent_EventType(b *testing.B) {
	event := OfferCreatedEvent{}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = event.EventType()
	}
}
