package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func corsTestHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
}

func doCORS(t *testing.T, method, origin string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(method, "/api/v1/query", nil)
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	CORS(corsTestHandler()).ServeHTTP(rec, req)
	return rec
}

func TestCORSReflectsConfiguredOrigin(t *testing.T) {
	t.Setenv("CORS_ORIGINS", "https://app.example.com, https://acs.edspike.com/")

	rec := doCORS(t, http.MethodPost, "https://app.example.com")
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Fatalf("allowed origin not reflected, got %q", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Fatalf("credentials header missing for allowed origin, got %q", got)
	}

	// Trailing slash and surrounding whitespace in config must still match.
	rec = doCORS(t, http.MethodPost, "https://acs.edspike.com")
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://acs.edspike.com" {
		t.Fatalf("normalised allow-list entry did not match, got %q", got)
	}
}

func TestCORSRejectsOriginOutsideAllowList(t *testing.T) {
	t.Setenv("CORS_ORIGINS", "https://app.example.com")

	rec := doCORS(t, http.MethodPost, "https://evil.example.com")
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("disallowed origin must not be granted CORS, got %q", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "" {
		t.Fatalf("credentials must not be granted to a disallowed origin, got %q", got)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("actual request should still be served, got status %d", rec.Code)
	}
}

func TestCORSPreflight(t *testing.T) {
	t.Setenv("CORS_ORIGINS", "https://app.example.com")

	rec := doCORS(t, http.MethodOptions, "https://app.example.com")
	if rec.Code != http.StatusNoContent {
		t.Fatalf("allowed preflight should return 204, got %d", rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Fatalf("preflight should advertise allowed methods")
	}

	rec = doCORS(t, http.MethodOptions, "https://evil.example.com")
	if rec.Code != http.StatusForbidden {
		t.Fatalf("disallowed preflight should be forbidden, got %d", rec.Code)
	}
}

func TestCORSWithoutAllowListPermitsLoopbackOnly(t *testing.T) {
	t.Setenv("CORS_ORIGINS", "")

	for _, origin := range []string{"http://localhost:5173", "https://localhost:8443", "http://127.0.0.1:5173"} {
		rec := doCORS(t, http.MethodPost, origin)
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != origin {
			t.Fatalf("loopback origin %q should be allowed in development, got %q", origin, got)
		}
	}

	rec := doCORS(t, http.MethodPost, "https://acs.edspike.com")
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("non-loopback origin must not be reflected without an allow-list, got %q", got)
	}
}

func TestCORSAlwaysVariesOnOrigin(t *testing.T) {
	t.Setenv("CORS_ORIGINS", "")
	rec := doCORS(t, http.MethodPost, "https://evil.example.com")
	if got := rec.Header().Get("Vary"); got != "Origin" {
		t.Fatalf("responses must Vary on Origin even when rejected, got %q", got)
	}
}
