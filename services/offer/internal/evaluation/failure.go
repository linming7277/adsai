package evaluation

import (
	"time"

	"github.com/xxrenzhe/autoads/pkg/apierrors"
)

// FailureCategory 评估失败分类
type FailureCategory string

const (
	// FailureCategoryNetwork 网络相关错误(可重试)
	FailureCategoryNetwork FailureCategory = "network"
	// FailureCategoryInvalidURL URL格式或内容无效(不可重试)
	FailureCategoryInvalidURL FailureCategory = "invalid_url"
	// FailureCategoryTimeout 超时错误(可重试)
	FailureCategoryTimeout FailureCategory = "timeout"
	// FailureCategoryRateLimit 限流错误(可重试,需等待)
	FailureCategoryRateLimit FailureCategory = "rate_limit"
	// FailureCategoryInternalError 内部错误(可重试)
	FailureCategoryInternalError FailureCategory = "internal_error"
	// FailureCategoryContentPolicy 内容违规(不可重试)
	FailureCategoryContentPolicy FailureCategory = "content_policy"
)

// EvaluationFailureReason Offer评估失败原因详情
type EvaluationFailureReason struct {
	// Category 失败分类
	Category FailureCategory `json:"category"`
	// Message 错误消息(人类可读)
	Message string `json:"message"`
	// Retryable 是否可重试
	Retryable bool `json:"retryable"`
	// SuggestedAction 建议操作
	SuggestedAction string `json:"suggestedAction,omitempty"`
	// EstimatedRetryTime 建议重试时间(可选)
	EstimatedRetryTime *time.Time `json:"estimatedRetryTime,omitempty"`
	// Details 详细信息(可选)
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewFailureReason 创建评估失败原因
func NewFailureReason(category FailureCategory, message string, details map[string]interface{}) *EvaluationFailureReason {
	reason := &EvaluationFailureReason{
		Category:  category,
		Message:   message,
		Retryable: isRetryable(category),
		Details:   details,
	}

	// 设置建议操作
	reason.SuggestedAction = getSuggestedAction(category)

	// 设置建议重试时间
	if reason.Retryable {
		retryTime := time.Now().Add(getRetryDelay(category))
		reason.EstimatedRetryTime = &retryTime
	}

	return reason
}

// ToAPIError 转换为标准化API错误
func (r *EvaluationFailureReason) ToAPIError() *apierrors.APIError {
	errorCode := getErrorCode(r.Category)

	details := r.Details
	if details == nil {
		details = make(map[string]interface{})
	}
	details["category"] = string(r.Category)
	if r.EstimatedRetryTime != nil {
		details["estimatedRetryTime"] = r.EstimatedRetryTime.Format(time.RFC3339)
	}

	return apierrors.NewWithAction(
		errorCode,
		r.Message,
		r.SuggestedAction,
		details,
	)
}

// isRetryable 判断该类别是否可重试
func isRetryable(category FailureCategory) bool {
	switch category {
	case FailureCategoryNetwork,
		FailureCategoryTimeout,
		FailureCategoryRateLimit,
		FailureCategoryInternalError:
		return true
	case FailureCategoryInvalidURL,
		FailureCategoryContentPolicy:
		return false
	default:
		return false
	}
}

// getSuggestedAction 获取建议操作
func getSuggestedAction(category FailureCategory) string {
	switch category {
	case FailureCategoryNetwork:
		return "网络连接失败,请检查URL是否可访问或稍后重试"
	case FailureCategoryInvalidURL:
		return "请检查URL格式是否正确,确保是有效的HTTP/HTTPS地址"
	case FailureCategoryTimeout:
		return "评估超时,请稍后重试或联系支持团队"
	case FailureCategoryRateLimit:
		return "请求过于频繁,请等待一段时间后重试"
	case FailureCategoryInternalError:
		return "服务内部错误,请稍后重试"
	case FailureCategoryContentPolicy:
		return "该URL内容不符合平台政策,无法创建Offer"
	default:
		return "请联系支持团队获取帮助"
	}
}

// getRetryDelay 获取建议重试延迟
func getRetryDelay(category FailureCategory) time.Duration {
	switch category {
	case FailureCategoryNetwork:
		return 30 * time.Second
	case FailureCategoryTimeout:
		return 1 * time.Minute
	case FailureCategoryRateLimit:
		return 5 * time.Minute
	case FailureCategoryInternalError:
		return 2 * time.Minute
	default:
		return 1 * time.Minute
	}
}

// getErrorCode 获取对应的API错误码
func getErrorCode(category FailureCategory) string {
	switch category {
	case FailureCategoryNetwork:
		return apierrors.CodeNetworkConnectionFailed
	case FailureCategoryInvalidURL:
		return apierrors.CodeOfferInvalidURL
	case FailureCategoryTimeout:
		return apierrors.CodeTimeout
	case FailureCategoryRateLimit:
		return apierrors.CodeRateLimitExceeded
	case FailureCategoryContentPolicy:
		return apierrors.CodeOfferInvalidState
	case FailureCategoryInternalError:
		return apierrors.CodeOfferEvaluationFailed
	default:
		return apierrors.CodeOfferEvaluationFailed
	}
}

// ClassifyError 分类评估错误
// 根据错误类型自动分类为对应的失败原因
func ClassifyError(err error) *EvaluationFailureReason {
	if err == nil {
		return nil
	}

	errMsg := err.Error()

	// 网络错误
	if containsAny(errMsg, []string{
		"connection refused",
		"connection reset",
		"no such host",
		"network unreachable",
		"dns",
	}) {
		return NewFailureReason(
			FailureCategoryNetwork,
			"无法连接到目标URL",
			map[string]interface{}{"error": errMsg},
		)
	}

	// 超时错误
	if containsAny(errMsg, []string{
		"timeout",
		"deadline exceeded",
		"context deadline exceeded",
	}) {
		return NewFailureReason(
			FailureCategoryTimeout,
			"评估请求超时",
			map[string]interface{}{"error": errMsg},
		)
	}

	// URL格式错误
	if containsAny(errMsg, []string{
		"invalid url",
		"malformed url",
		"unsupported protocol",
	}) {
		return NewFailureReason(
			FailureCategoryInvalidURL,
			"URL格式无效",
			map[string]interface{}{"error": errMsg},
		)
	}

	// 限流错误
	if containsAny(errMsg, []string{
		"rate limit",
		"too many requests",
		"429",
	}) {
		return NewFailureReason(
			FailureCategoryRateLimit,
			"请求过于频繁",
			map[string]interface{}{"error": errMsg},
		)
	}

	// 默认为内部错误
	return NewFailureReason(
		FailureCategoryInternalError,
		"评估过程发生错误",
		map[string]interface{}{"error": errMsg},
	)
}

// containsAny 检查字符串是否包含列表中的任意关键词
func containsAny(s string, keywords []string) bool {
	s = toLower(s)
	for _, keyword := range keywords {
		if contains(s, toLower(keyword)) {
			return true
		}
	}
	return false
}

// toLower 转小写(简化版)
func toLower(s string) string {
	result := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			result[i] = c + 32
		} else {
			result[i] = c
		}
	}
	return string(result)
}

// contains 检查字符串包含(简化版)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && indexOf(s, substr) >= 0
}

// indexOf 查找子字符串位置
func indexOf(s, substr string) int {
	n := len(substr)
	if n == 0 {
		return 0
	}
	for i := 0; i+n <= len(s); i++ {
		if s[i:i+n] == substr {
			return i
		}
	}
	return -1
}
