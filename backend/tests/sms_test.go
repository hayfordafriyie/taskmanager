package tests

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"taskmanager/internal/notif"
)

type smsServer struct {
	counter     requestCounter
	recipients  []string
	recipientsMu sync.Mutex
}

func setupSMSServer(t *testing.T, handler http.HandlerFunc) *httptest.Server {
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
	mu       sync.Mutex
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

func smsPayload() notif.SMSPayload {
	return notif.SMSPayload{
		PhoneNumbers: []string{"+233537144161"},
		Message:      "Your verification code is 123456.",
	}
}

func TestSendSMSPayloadSuccess(t *testing.T) {
	var server smsServer
	setupSMSServer(t, func(w http.ResponseWriter, r *http.Request) {
		server.counter.inc()
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

	credit, err := notif.SendSMSPayload(smsPayload(), "")
	if err != nil {
		t.Fatalf("SendSMSPayload: %v", err)
	}
	if credit != 1 {
		t.Errorf("credit = %v, want 1", credit)
	}
	if server.counter.count() != 1 {
		t.Errorf("expected 1 request, got %d", server.counter.count())
	}
}

func TestSendSMSPayloadFormatsPhoneNumbers(t *testing.T) {
	inputs := []string{
		"+233537144161",
		"233537144161",
		"00233537144161",
		"0537144161",
		" 0537144161 ",
	}

	var server smsServer
	setupSMSServer(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var req map[string]any
		_ = json.Unmarshal(body, &req)
		recipients, _ := req["recipient"].([]any)
		server.recipientsMu.Lock()
		server.recipients = append(server.recipients, recipients[0].(string))
		server.recipientsMu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"code":"400","message":"ok","status":"success","summary":{"credit_used":1}}`))
	})

	for _, in := range inputs {
		if _, err := notif.SendSMSPayload(notif.SMSPayload{
			PhoneNumbers: []string{in},
			Message:      "test",
		}, ""); err != nil {
			t.Fatalf("SendSMSPayload(%q): %v", in, err)
		}
	}

	if len(server.recipients) != len(inputs) {
		t.Fatalf("expected %d recipients, got %d", len(inputs), len(server.recipients))
	}
	for i, got := range server.recipients {
		if got != "+233537144161" {
			t.Errorf("recipient %d = %q, want +233537144161", i, got)
		}
	}
}

func TestSendSMSPayloadRetriesOn5xx(t *testing.T) {
	var counter requestCounter
	setupSMSServer(t, func(w http.ResponseWriter, r *http.Request) {
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

	if _, err := notif.SendSMSPayload(smsPayload(), ""); err != nil {
		t.Fatalf("expected success after retry, got %v", err)
	}
	if counter.count() != 2 {
		t.Errorf("expected 2 requests (retry), got %d", counter.count())
	}
}

func TestSendSMSPayloadNoRetryOn4xx(t *testing.T) {
	var counter requestCounter
	setupSMSServer(t, func(w http.ResponseWriter, r *http.Request) {
		counter.inc()
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`bad request`))
	})

	if _, err := notif.SendSMSPayload(smsPayload(), ""); err == nil {
		t.Fatal("expected error on 400")
	}
	if counter.count() != 1 {
		t.Errorf("expected no retry on 400, got %d requests", counter.count())
	}
}

func TestSendSMSPayloadInvalidJSON(t *testing.T) {
	var counter requestCounter
	setupSMSServer(t, func(w http.ResponseWriter, r *http.Request) {
		counter.inc()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`not-json`))
	})

	if _, err := notif.SendSMSPayload(smsPayload(), ""); err == nil {
		t.Fatal("expected error on invalid JSON")
	}
	if counter.count() != 3 {
		t.Errorf("expected 3 attempts on invalid JSON, got %d", counter.count())
	}
}

func TestSendSMSPayloadAPIError(t *testing.T) {
	setupSMSServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"code":"error","message":"insufficient balance","status":"error"}`))
	})

	_, err := notif.SendSMSPayload(smsPayload(), "")
	if err == nil {
		t.Fatal("expected error from api error response")
	}
}

func TestSendSMSPayloadNoNumbers(t *testing.T) {
	setupSMSServer(t, func(w http.ResponseWriter, r *http.Request) {
		t.Error("request should not be made without recipients")
	})

	if _, err := notif.SendSMSPayload(notif.SMSPayload{PhoneNumbers: []string{}, Message: "x"}, ""); err == nil {
		t.Fatal("expected error when no phone numbers")
	}
}

func TestSendSMSPayloadMissingAPIKey(t *testing.T) {
	t.Setenv("SMS_API_KEY", "")
	t.Setenv("SMS_KEY", "")
	t.Setenv("SMS_BASE_URL", "http://localhost")
	t.Setenv("DEFAULT_SMS_SENDER_ID", "TESTSNDR")

	if _, err := notif.SendSMSPayload(smsPayload(), ""); err == nil {
		t.Fatal("expected error when API key missing")
	}
}