package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"taskmanager/graph"
	"taskmanager/internal/db"
	"taskmanager/internal/notif"
	"taskmanager/internal/otp"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/jackc/pgx/v5/pgxpool"
)

var gqlCodeRe = regexp.MustCompile(`\b[0-9]{6}\b`)

type fakeSMSSender struct {
	mu       sync.Mutex
	messages []string
	fail     bool
	errs     []error
}

func (f *fakeSMSSender) SendSMSPayload(payload notif.SMSPayload, senderID string) (float64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.fail {
		return 0, errors.New("sms service down")
	}
	f.messages = append(f.messages, payload.Message)
	return 1, nil
}

func (f *fakeSMSSender) lastCode() string {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.messages) == 0 {
		return ""
	}
	m := gqlCodeRe.FindString(f.messages[len(f.messages)-1])
	return m
}

func (f *fakeSMSSender) sentCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.messages)
}

func (f *fakeSMSSender) setFail(fail bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.fail = fail
}

func (f *fakeSMSSender) sendErrorCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.errs)
}

func (f *fakeSMSSender) recordError(err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.errs = append(f.errs, err)
}

func newTestServer(t *testing.T) (*httptest.Server, *pgxpool.Pool, *fakeSMSSender, func()) {
	t.Helper()
	pool, cleanup := PrepareTestDB(t)
	sender := &fakeSMSSender{}

	worker := notif.NewWorker(sender, 2, 16, sender.recordError)
	exec := graph.NewExecutableSchema(graph.Config{Resolvers: graph.NewResolver(pool, worker)})
	h := handler.New(exec)
	h.AddTransport(transport.Options{})
	h.AddTransport(transport.POST{})

	srv := httptest.NewServer(h)
	t.Cleanup(func() {
		srv.Close()
		worker.Close()
	})
	return srv, pool, sender, cleanup
}

func waitUntil(t *testing.T, timeout time.Duration, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("condition not met within %s", timeout)
}

func waitForSMSCode(t *testing.T, sender *fakeSMSSender) string {
	t.Helper()
	var code string
	waitUntil(t, 5*time.Second, func() bool {
		code = sender.lastCode()
		return gqlCodeRe.MatchString(code)
	})
	return code
}

const (
	graphQLURL    = "/query"
	otpPurposeTag = "register"
)

func gqlQuery(t *testing.T, srv *httptest.Server, query string) map[string]any {
	t.Helper()
	body, _ := json.Marshal(map[string]any{"query": query})
	resp, err := http.Post(srv.URL+graphQLURL, "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("graphql request: %v", err)
	}
	defer resp.Body.Close()

	var out map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode graphql response: %v", err)
	}
	return out
}

func gqlData(t *testing.T, resp map[string]any) map[string]any {
	t.Helper()
	data, ok := resp["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing data in response: %v", resp)
	}
	return data
}

func gqlMutation(t *testing.T, resp map[string]any, name string) map[string]any {
	t.Helper()
	res, ok := gqlData(t, resp)[name].(map[string]any)
	if !ok {
		t.Fatalf("missing %q in response: %v", name, resp)
	}
	return res
}

func hasGQLErrors(t *testing.T, resp map[string]any) bool {
	t.Helper()
	errs, ok := resp["errors"].([]any)
	return ok && len(errs) > 0
}

func requestOTPQuery(phone string) string {
	return fmt.Sprintf(`mutation { requestOTP(phone: %q) { success message expiresInSeconds retryAfterSeconds } }`, phone)
}

func verifyOTPQuery(phone, code string) string {
	return fmt.Sprintf(`mutation { verifyOTP(phone: %q, code: %q) { success message } }`, phone, code)
}

func createAccountQuery(phone string) string {
	return fmt.Sprintf(`mutation { createAccount(input: { phone: %q, firstName: "Kojo", surname: "Asante", password: "StrongPass1!", confirmPassword: "StrongPass1!" }) { success message user { id phone firstName } } }`, phone)
}

func createAccountQueryFull(phone, firstName, surname, otherNames, password, confirm string) string {
	other := ""
	if otherNames != "" {
		other = fmt.Sprintf(", otherNames: %q", otherNames)
	}
	return fmt.Sprintf(
		`mutation { createAccount(input: { phone: %q, firstName: %q, surname: %q%s, password: %q, confirmPassword: %q }) { success message user { id phone firstName } } }`,
		phone, firstName, surname, other, password, confirm,
	)
}

func registerUserHTTP(t *testing.T, srv *httptest.Server, sender *fakeSMSSender, phone string) string {
	t.Helper()
	res := gqlMutation(t, gqlQuery(t, srv, requestOTPQuery(phone)), "requestOTP")
	if res["success"] != true {
		t.Fatalf("requestOTP failed: %v", res)
	}
	code := waitForSMSCode(t, sender)
	res = gqlMutation(t, gqlQuery(t, srv, verifyOTPQuery(phone, code)), "verifyOTP")
	if res["success"] != true {
		t.Fatalf("verifyOTP failed: %v", res)
	}
	res = gqlMutation(t, gqlQuery(t, srv, createAccountQuery(phone)), "createAccount")
	if res["success"] != true {
		t.Fatalf("createAccount failed: %v", res)
	}
	return code
}

func TestRequestOTP(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	res := gqlMutation(t, gqlQuery(t, srv, requestOTPQuery("+233537144161")), "requestOTP")
	if res["success"] != true {
		t.Fatalf("expected success, got %+v", res)
	}
	if res["expiresInSeconds"] != float64(600) {
		t.Errorf("expected expiresInSeconds 600, got %v", res["expiresInSeconds"])
	}
	if code := waitForSMSCode(t, sender); code == "" {
		t.Fatal("expected sms to contain a 6-digit code")
	}

	again := gqlMutation(t, gqlQuery(t, srv, requestOTPQuery("+233537144161")), "requestOTP")
	if again["success"] == true {
		t.Fatal("expected resend to be throttled")
	}
	if again["retryAfterSeconds"] == nil {
		t.Fatal("expected retryAfterSeconds on throttled resend")
	}
}

func TestRequestOTPInvalidPhone(t *testing.T) {
	srv, _, _, cleanup := newTestServer(t)
	defer cleanup()

	resp := gqlQuery(t, srv, requestOTPQuery("+15551234567"))
	if !hasGQLErrors(t, resp) {
		t.Fatalf("expected graphql error for invalid phone, got %v", resp)
	}
}

func TestVerifyOTP(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	gqlMutation(t, gqlQuery(t, srv, requestOTPQuery("+233537144161")), "requestOTP")
	code := waitForSMSCode(t, sender)

	res := gqlMutation(t, gqlQuery(t, srv, verifyOTPQuery("+233537144161", code)), "verifyOTP")
	if res["success"] != true {
		t.Fatalf("expected success, got %+v", res)
	}

	wrong := gqlMutation(t, gqlQuery(t, srv, verifyOTPQuery("+233537144161", "000000")), "verifyOTP")
	if wrong["success"] == true {
		t.Fatal("expected wrong code to fail")
	}
}

func TestCreateAccountFullFlow(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	phone := "+233537144161"
	registerUserHTTP(t, srv, sender, phone)

	res := gqlMutation(t, gqlQuery(t, srv, requestOTPQuery(phone)), "requestOTP")
	if res["success"] == true {
		t.Fatal("expected requestOTP to be blocked for an existing account")
	}
	if want := "already exists"; !strings.Contains(res["message"].(string), want) {
		t.Errorf("expected message containing %q, got %q", want, res["message"])
	}
}

func TestCreateAccountRequiresVerification(t *testing.T) {
	srv, _, _, cleanup := newTestServer(t)
	defer cleanup()

	res := gqlMutation(t, gqlQuery(t, srv, createAccountQuery("+233537144161")), "createAccount")
	if res["success"] == true {
		t.Fatal("expected account creation without verification to fail")
	}
}

func TestCreateAccountWithOtherNames(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	phone := "+233537144161"
	res := gqlMutation(t, gqlQuery(t, srv, requestOTPQuery(phone)), "requestOTP")
	if res["success"] != true {
		t.Fatalf("requestOTP failed: %v", res)
	}
	code := waitForSMSCode(t, sender)
	gqlMutation(t, gqlQuery(t, srv, verifyOTPQuery(phone, code)), "verifyOTP")

	res = gqlMutation(t, gqlQuery(t, srv, createAccountQueryFull(phone, "Kojo", "Asante", "Nana", "StrongPass1!", "StrongPass1!")), "createAccount")
	if res["success"] != true {
		t.Fatalf("createAccount failed: %v", res)
	}
	user, _ := res["user"].(map[string]any)
	if user == nil || user["firstName"] != "Kojo" {
		t.Errorf("unexpected user: %v", res["user"])
	}
}

func TestCreateAccountInputValidation(t *testing.T) {
	srv, pool, _, cleanup := newTestServer(t)
	defer cleanup()

	phone := "+233537144161"

	t.Run("weak password", func(t *testing.T) {
		resp := gqlQuery(t, srv, createAccountQueryFull(phone, "Kojo", "Asante", "", "weak", "weak"))
		if !hasGQLErrors(t, resp) {
			t.Fatalf("expected weak password error, got %v", resp)
		}
	})

	t.Run("mismatched passwords", func(t *testing.T) {
		resp := gqlQuery(t, srv, createAccountQueryFull(phone, "Kojo", "Asante", "", "StrongPass1!", "Different1!"))
		if !hasGQLErrors(t, resp) {
			t.Fatalf("expected mismatch error, got %v", resp)
		}
	})

	t.Run("empty name", func(t *testing.T) {
		resp := gqlQuery(t, srv, createAccountQueryFull(phone, "   ", "Asante", "", "StrongPass1!", "StrongPass1!"))
		if !hasGQLErrors(t, resp) {
			t.Fatalf("expected empty name error, got %v", resp)
		}
	})

	if count, err := countUsers(context.Background(), pool); err != nil || count != 0 {
		t.Fatalf("expected 0 users after failed validations, got %d (%v)", count, err)
	}
}

func TestCreateAccountSMSFailure(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	sender.setFail(true)
	resp := gqlQuery(t, srv, requestOTPQuery("+233537144161"))
	if hasGQLErrors(t, resp) {
		t.Fatalf("expected requestOTP to succeed with async delivery, got %v", resp)
	}
	res := gqlMutation(t, resp, "requestOTP")
	if res["success"] != true {
		t.Fatalf("expected requestOTP success regardless of sms availability, got %+v", res)
	}

	waitUntil(t, 5*time.Second, func() bool {
		return sender.sendErrorCount() > 0
	})
}

func TestCreateAccountDuplicatePhone(t *testing.T) {
	srv, pool, sender, cleanup := newTestServer(t)
	defer cleanup()

	phone := "+233537144161"
	registerUserHTTP(t, srv, sender, phone)

	// Provide a fresh verified OTP directly against the store, bypassing the
	// now-blocked requestOTP step.
	code2, hash2, _ := otp.Generate()
	ctx := context.Background()
	if _, err := db.RequestOTP(ctx, pool, phone, otpPurposeTag, hash2, time.Now().Add(otp.DefaultTTL)); err != nil {
		t.Fatal(err)
	}
	if valid, _, _ := db.VerifyOTP(ctx, pool, phone, otpPurposeTag, code2); !valid {
		t.Fatal("could not verify second otp")
	}

	res := gqlMutation(t, gqlQuery(t, srv, createAccountQuery(phone)), "createAccount")
	if res["success"] == true {
		t.Fatal("expected duplicate registration to fail")
	}
	if want := "already exists"; !strings.Contains(res["message"].(string), want) {
		t.Errorf("expected message containing %q, got %q", want, res["message"])
	}
	if res["user"] != nil {
		t.Fatal("expected no user in duplicate result")
	}

	if count, err := countUsers(ctx, pool); err != nil || count != 1 {
		t.Fatalf("expected exactly 1 user after duplicate attempt, got %d (%v)", count, err)
	}
}

func TestRequestOTPBlocksRegisteredPhone(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	phone := "+233537144161"
	registerUserHTTP(t, srv, sender, phone)

	before := sender.sentCount()
	res := gqlMutation(t, gqlQuery(t, srv, requestOTPQuery(phone)), "requestOTP")
	if res["success"] == true {
		t.Fatal("expected requestOTP to be blocked for an existing account")
	}
	if want := "already exists"; !strings.Contains(res["message"].(string), want) {
		t.Errorf("expected message containing %q, got %q", want, res["message"])
	}
	if sender.sentCount() != before {
		t.Errorf("expected no new SMS, sent before=%d after=%d", before, sender.sentCount())
	}
}