package notif

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

func setupServer(t *testing.T, handler http.HandlerFunc) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Setenv("SMS_API_KEY", "test-key")
	t.Setenv("SMS_KEY", "test-key")
	t.Setenv("SMS_BASE_URL", srv.URL)
	t.Setenv("DEFAULT_SMS_SENDER_ID", "TESTSNDR")
	t.Setenv("SENDER_ID", "TESTSNDR")
	t.Cleanup(srv.Close)
	return srv
}

type requestCounter struct {
	mu      sync.Mutex
	requests int
}

func (c *requestCounter) inc() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.requests++
}

func (c *requestCounter) count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.requests
}

func payload() SMSPayload {
	return SMSPayload{
		PhoneNumbers: []string{"+233537144161"},
		Message:      "Your verification code is 123456.",
	}
}

func TestSendSMSPayloadSuccess(t *testing.T) {
	var counter requestCounter
	srv := setupServer(t, func(w http.ResponseWriter, r *http.Request) {
		counter.inc()
		if r.URL.Query().Get("key") != "test-key" {
			t.Errorf("missing key query param")
		}
		body, _ := io.ReadAll(r.Body)
		var req map[string]any
		if err := json.Unmarshal(body, &req); err != nil {
			t.Errorf("bad request body: %v", err)
		}
		if req["sender"] != "TESTSNDR" {
			t.Errorf("sender = %v, want TESTSNDR", req["sender"])
		}
		recipients, _ := req["recipient"].([]any)
		if len(recipients) != 1 || recipients[0] != "+233537144161" {
			t.Errorf("recipient = %v", req["recipient"])
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"code":"400","message":"successful","status":"success","summary":{"credit_used":1}}`))
	})
	_ = srv

	credit, err := SendSMSPayload(payload(), "")
	if err != nil {
		t.Fatalf("SendSMSPayload: %v", err)
	}
	if credit != 1 {
		t.Errorf("credit = %v, want 1", credit)
	}
	if counter.count() != 1 {
		t.Errorf("expected 1 request, got %d", counter.count())
	}
}

func TestSendSMSPayloadRetriesOn5xx(t *testing.T) {
	var counter requestCounter
	setupServer(t, func(w http.ResponseWriter, r *http.Request) {
		counter.inc()
		if counter.count() < 2 {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`internal error`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"code":"400","message":"ok","status":"success","summary":{"credit_used":1}}`))
	})

	if _, err := SendSMSPayload(payload(), ""); err != nil {
		t.Fatalf("expected success after retry, got %v", err)
	}
	if counter.count() != 2 {
		t.Errorf("expected 2 requests (retry), got %d", counter.count())
	}
}

func TestSendSMSPayloadNoRetryOn4xx(t *testing.T) {
	var counter requestCounter
	setupServer(t, func(w http.ResponseWriter, r *http.Request) {
		counter.inc()
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`bad request`))
	})

	if _, err := SendSMSPayload(payload(), ""); err == nil {
		t.Fatal("expected error on 400")
	}
	if counter.count() != 1 {
		t.Errorf("expected no retry on 400, got %d requests", counter.count())
	}
}

func TestSendSMSPayloadInvalidJSON(t *testing.T) {
	var counter requestCounter
	setupServer(t, func(w http.ResponseWriter, r *http.Request) {
		counter.inc()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`not-json`))
	})

	if _, err := SendSMSPayload(payload(), ""); err == nil {
		t.Fatal("expected error on invalid JSON")
	}
	if counter.count() != smsMaxRetries {
		t.Errorf("expected %d attempts on invalid JSON, got %d", smsMaxRetries, counter.count())
	}
}

func TestSendSMSPayloadAPIError(t *testing.T) {
	setupServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"code":"error","message":"insufficient balance","status":"error"}`))
	})

	_, err := SendSMSPayload(payload(), "")
	if err == nil {
		t.Fatal("expected error from api error response")
	}
}

func TestSendSMSPayloadNoNumbers(t *testing.T) {
	setupServer(t, func(w http.ResponseWriter, r *http.Request) {
		t.Error("request should not be made without recipients")
	})

	if _, err := SendSMSPayload(SMSPayload{PhoneNumbers: []string{}, Message: "x"}, ""); err == nil {
		t.Fatal("expected error when no phone numbers")
	}
}

func TestSendSMSPayloadMissingAPIKey(t *testing.T) {
	t.Setenv("SMS_API_KEY", "")
	t.Setenv("SMS_KEY", "")
	t.Setenv("SMS_BASE_URL", "http://localhost")
	t.Setenv("DEFAULT_SMS_SENDER_ID", "TESTSNDR")

	if _, err := SendSMSPayload(payload(), ""); err == nil {
		t.Fatal("expected error when API key missing")
	}
}

func TestFormatPhoneNumber(t *testing.T) {
	tests := map[string]string{
		"+233537144161": "+233537144161",
		"00233537144161": "+233537144161",
		"233537144161":   "+233537144161",
		"0537144161":     "+233537144161",
		"0537144161 ":    "+233537144161",
	}
	for input, want := range tests {
		if got := formatPhoneNumber(input); got != want {
			t.Errorf("formatPhoneNumber(%q) = %q, want %q", input, got, want)
		}
	}
}