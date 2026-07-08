package evaluation

import (
	"errors"
	"testing"
	"time"

	"github.com/xxrenzhe/autoads/pkg/apierrors"
)

func TestNewFailureReason(t *testing.T) {
	tests := []struct {
		name     string
		category FailureCategory
		message  string
		details  map[string]interface{}
	}{
		{
			name:     "Network failure",
			category: FailureCategoryNetwork,
			message:  "连接失败",
			details:  map[string]interface{}{"url": "https://example.com"},
		},
		{
			name:     "Invalid URL",
			category: FailureCategoryInvalidURL,
			message:  "URL格式无效",
			details:  nil,
		},
		{
			name:     "Timeout",
			category: FailureCategoryTimeout,
			message:  "请求超时",
			details:  map[string]interface{}{"timeout": "30s"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reason := NewFailureReason(tt.category, tt.message, tt.details)

			if reason.Category != tt.category {
				t.Errorf("Expected category %s, got %s", tt.category, reason.Category)
			}
			if reason.Message != tt.message {
				t.Errorf("Expected message %s, got %s", tt.message, reason.Message)
			}
			if reason.SuggestedAction == "" {
				t.Error("Expected non-empty SuggestedAction")
			}

			// Check retryable logic
			expectedRetryable := isRetryable(tt.category)
			if reason.Retryable != expectedRetryable {
				t.Errorf("Expected retryable %v, got %v", expectedRetryable, reason.Retryable)
			}

			// Check EstimatedRetryTime
			if reason.Retryable && reason.EstimatedRetryTime == nil {
				t.Error("Expected EstimatedRetryTime for retryable failure")
			}
			if !reason.Retryable && reason.EstimatedRetryTime != nil {
				t.Error("Expected nil EstimatedRetryTime for non-retryable failure")
			}
		})
	}
}

func TestIsRetryable(t *testing.T) {
	tests := []struct {
		category FailureCategory
		expected bool
	}{
		{FailureCategoryNetwork, true},
		{FailureCategoryTimeout, true},
		{FailureCategoryRateLimit, true},
		{FailureCategoryInternalError, true},
		{FailureCategoryInvalidURL, false},
		{FailureCategoryContentPolicy, false},
	}

	for _, tt := range tests {
		t.Run(string(tt.category), func(t *testing.T) {
			result := isRetryable(tt.category)
			if result != tt.expected {
				t.Errorf("Expected %v for %s, got %v", tt.expected, tt.category, result)
			}
		})
	}
}

func TestGetSuggestedAction(t *testing.T) {
	categories := []FailureCategory{
		FailureCategoryNetwork,
		FailureCategoryInvalidURL,
		FailureCategoryTimeout,
		FailureCategoryRateLimit,
		FailureCategoryInternalError,
		FailureCategoryContentPolicy,
	}

	for _, category := range categories {
		t.Run(string(category), func(t *testing.T) {
			action := getSuggestedAction(category)
			if action == "" {
				t.Errorf("Expected non-empty suggested action for %s", category)
			}
		})
	}
}

func TestGetRetryDelay(t *testing.T) {
	tests := []struct {
		category FailureCategory
		minDelay time.Duration
		maxDelay time.Duration
	}{
		{FailureCategoryNetwork, 20 * time.Second, 40 * time.Second},
		{FailureCategoryTimeout, 50 * time.Second, 70 * time.Second},
		{FailureCategoryRateLimit, 4 * time.Minute, 6 * time.Minute},
		{FailureCategoryInternalError, 1 * time.Minute, 3 * time.Minute},
	}

	for _, tt := range tests {
		t.Run(string(tt.category), func(t *testing.T) {
			delay := getRetryDelay(tt.category)
			if delay < tt.minDelay || delay > tt.maxDelay {
				t.Errorf("Expected delay between %v and %v, got %v", tt.minDelay, tt.maxDelay, delay)
			}
		})
	}
}

func TestGetErrorCode(t *testing.T) {
	tests := []struct {
		category     FailureCategory
		expectedCode string
	}{
		{FailureCategoryNetwork, apierrors.CodeNetworkConnectionFailed},
		{FailureCategoryInvalidURL, apierrors.CodeOfferInvalidURL},
		{FailureCategoryTimeout, apierrors.CodeTimeout},
		{FailureCategoryRateLimit, apierrors.CodeRateLimitExceeded},
		{FailureCategoryContentPolicy, apierrors.CodeOfferInvalidState},
		{FailureCategoryInternalError, apierrors.CodeOfferEvaluationFailed},
	}

	for _, tt := range tests {
		t.Run(string(tt.category), func(t *testing.T) {
			code := getErrorCode(tt.category)
			if code != tt.expectedCode {
				t.Errorf("Expected code %s, got %s", tt.expectedCode, code)
			}
		})
	}
}

func TestToAPIError(t *testing.T) {
	reason := NewFailureReason(
		FailureCategoryNetwork,
		"连接失败",
		map[string]interface{}{"url": "https://example.com"},
	)

	apiErr := reason.ToAPIError()

	if apiErr.Code != apierrors.CodeNetworkConnectionFailed {
		t.Errorf("Expected code %s, got %s", apierrors.CodeNetworkConnectionFailed, apiErr.Code)
	}
	if apiErr.Message != "连接失败" {
		t.Errorf("Expected message '连接失败', got %s", apiErr.Message)
	}
	if apiErr.Retryable != true {
		t.Error("Expected retryable to be true")
	}
	if apiErr.SuggestedAction == "" {
		t.Error("Expected non-empty SuggestedAction")
	}

	// Check details
	details, ok := apiErr.Details.(map[string]interface{})
	if !ok {
		t.Fatal("Expected Details to be map[string]interface{}")
	}
	if details["category"] != string(FailureCategoryNetwork) {
		t.Errorf("Expected category in details, got %v", details["category"])
	}
	if details["url"] != "https://example.com" {
		t.Errorf("Expected url in details, got %v", details["url"])
	}
}

func TestClassifyError(t *testing.T) {
	tests := []struct {
		name             string
		err              error
		expectedCategory FailureCategory
	}{
		{
			name:             "Network - connection refused",
			err:              errors.New("connection refused"),
			expectedCategory: FailureCategoryNetwork,
		},
		{
			name:             "Network - no such host",
			err:              errors.New("no such host"),
			expectedCategory: FailureCategoryNetwork,
		},
		{
			name:             "Network - DNS error",
			err:              errors.New("DNS lookup failed"),
			expectedCategory: FailureCategoryNetwork,
		},
		{
			name:             "Timeout - deadline exceeded",
			err:              errors.New("context deadline exceeded"),
			expectedCategory: FailureCategoryTimeout,
		},
		{
			name:             "Timeout - timeout",
			err:              errors.New("request timeout"),
			expectedCategory: FailureCategoryTimeout,
		},
		{
			name:             "Invalid URL - malformed",
			err:              errors.New("malformed URL"),
			expectedCategory: FailureCategoryInvalidURL,
		},
		{
			name:             "Invalid URL - unsupported protocol",
			err:              errors.New("unsupported protocol scheme"),
			expectedCategory: FailureCategoryInvalidURL,
		},
		{
			name:             "Rate limit - too many requests",
			err:              errors.New("too many requests"),
			expectedCategory: FailureCategoryRateLimit,
		},
		{
			name:             "Rate limit - 429",
			err:              errors.New("HTTP 429 rate limit exceeded"),
			expectedCategory: FailureCategoryRateLimit,
		},
		{
			name:             "Internal error - unknown",
			err:              errors.New("some unknown error"),
			expectedCategory: FailureCategoryInternalError,
		},
		{
			name:             "Nil error",
			err:              nil,
			expectedCategory: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reason := ClassifyError(tt.err)

			if tt.err == nil {
				if reason != nil {
					t.Error("Expected nil reason for nil error")
				}
				return
			}

			if reason == nil {
				t.Fatal("Expected non-nil reason")
			}

			if reason.Category != tt.expectedCategory {
				t.Errorf("Expected category %s, got %s", tt.expectedCategory, reason.Category)
			}

			if reason.Message == "" {
				t.Error("Expected non-empty message")
			}
		})
	}
}

func TestContainsAny(t *testing.T) {
	tests := []struct {
		name     string
		s        string
		keywords []string
		expected bool
	}{
		{
			name:     "Match found",
			s:        "Connection refused by server",
			keywords: []string{"refused", "timeout"},
			expected: true,
		},
		{
			name:     "No match",
			s:        "Some error message",
			keywords: []string{"timeout", "refused"},
			expected: false,
		},
		{
			name:     "Case insensitive",
			s:        "CONNECTION REFUSED",
			keywords: []string{"connection"},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := containsAny(tt.s, tt.keywords)
			if result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestToLower(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"HELLO", "hello"},
		{"Hello World", "hello world"},
		{"ABC123", "abc123"},
		{"already lowercase", "already lowercase"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := toLower(tt.input)
			if result != tt.expected {
				t.Errorf("Expected %s, got %s", tt.expected, result)
			}
		})
	}
}

func TestContains(t *testing.T) {
	tests := []struct {
		s        string
		substr   string
		expected bool
	}{
		{"hello world", "world", true},
		{"hello world", "foo", false},
		{"test", "", true},
		{"", "test", false},
	}

	for _, tt := range tests {
		t.Run(tt.s+"_"+tt.substr, func(t *testing.T) {
			result := contains(tt.s, tt.substr)
			if result != tt.expected {
				t.Errorf("Expected %v for contains(%q, %q)", tt.expected, tt.s, tt.substr)
			}
		})
	}
}
