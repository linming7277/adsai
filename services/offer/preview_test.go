//go:build integration
// +build integration

package main

import (
	"net/http"
	"testing"
)

const previewURL = "https://offer-preview-yt54xvsg5q-an.a.run.app"

func TestOfferPreviewHealth(t *testing.T) {
	resp, err := http.Get(previewURL + "/health")
	if err != nil {
		t.Fatalf("Failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
	t.Logf("✅ Offer health: %d", resp.StatusCode)
}

func TestOfferPreviewReadiness(t *testing.T) {
	resp, err := http.Get(previewURL + "/readyz")
	if err != nil {
		t.Fatalf("Failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
	t.Logf("✅ Offer readyz: %d", resp.StatusCode)
}

func TestOfferPreviewMetrics(t *testing.T) {
	resp, err := http.Get(previewURL + "/metrics")
	if err != nil {
		t.Fatalf("Failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
	t.Logf("✅ Offer metrics: %d", resp.StatusCode)
}
