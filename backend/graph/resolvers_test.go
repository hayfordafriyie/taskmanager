package graph

import (
	"context"
	"errors"
	"os"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"taskmanager/graph/model"
	"taskmanager/internal/db"
	"taskmanager/internal/notif"
	"taskmanager/internal/otp"
	"taskmanager/internal/testutil"
)

func TestMain(m *testing.M) {
	testutil.LoadPackageEnv()
	os.Exit(m.Run())
}

type fakeSMSSender struct {
	mu       sync.Mutex
	messages []string
	fail     bool
}

func newFakeSMSSender() *fakeSMSSender {
	return &fakeSMSSender{}
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

var codeRe = regexp.MustCompile(`\b[0-9]{6}\b`)

func (f *fakeSMSSender) lastCode() string {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.messages) == 0 {
		return ""
	}
	m := codeRe.FindString(f.messages[len(f.messages)-1])
	return m
}

func (f *fakeSMSSender) sentCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.messages)
}

func contains(haystack, needle string) bool {
	return strings.Contains(haystack, needle)
}

func resolver(t *testing.T) (*Resolver, *fakeSMSSender, func()) {
	t.Helper()
	pool, cleanup := testutil.PrepareTestDB(t)
	sender := newFakeSMSSender()
	return NewResolver(pool, sender), sender, cleanup
}

func TestRequestOTPResolver(t *testing.T) {
	r, sender, cleanup := resolver(t)
	defer cleanup()

	ctx := context.Background()

	res, err := (&mutationResolver{r}).RequestOtp(ctx, "+233537144161")
	if err != nil {
		t.Fatalf("RequestOtp: %v", err)
	}
	if !res.Success {
		t.Fatalf("expected success, got %+v", res)
	}
	if res.ExpiresInSeconds == nil || *res.ExpiresInSeconds != 600 {
		t.Errorf("expected expiresInSeconds 600, got %+v", res.ExpiresInSeconds)
	}
	if code := sender.lastCode(); !codeRe.MatchString(code) {
		t.Fatalf("expected sms to contain a 6-digit code, got %q", code)
	}

	again, err := (&mutationResolver{r}).RequestOtp(ctx, "+233537144161")
	if err != nil {
		t.Fatal(err)
	}
	if again.Success {
		t.Fatal("expected resend to be throttled")
	}
	if again.RetryAfterSeconds == nil {
		t.Fatal("expected retryAfterSeconds on throttled resend")
	}
}

func TestRequestOTPResolverInvalidPhone(t *testing.T) {
	r, _, cleanup := resolver(t)
	defer cleanup()

	_, err := (&mutationResolver{r}).RequestOtp(context.Background(), "+15551234567")
	if err == nil {
		t.Fatal("expected error for invalid phone")
	}
}

func TestVerifyOTPResolver(t *testing.T) {
	r, sender, cleanup := resolver(t)
	defer cleanup()

	ctx := context.Background()
	m := &mutationResolver{r}

	if _, err := m.RequestOtp(ctx, "+233537144161"); err != nil {
		t.Fatal(err)
	}
	code := sender.lastCode()

	res, err := m.VerifyOtp(ctx, "+233537144161", code)
	if err != nil {
		t.Fatalf("VerifyOtp: %v", err)
	}
	if !res.Success {
		t.Fatalf("expected success, got %+v", res)
	}

	wrong, err := m.VerifyOtp(ctx, "+233537144161", "000000")
	if err != nil {
		t.Fatal(err)
	}
	if wrong.Success {
		t.Fatal("expected wrong code to fail")
	}
}

func TestCreateAccountResolverFullFlow(t *testing.T) {
	r, sender, cleanup := resolver(t)
	defer cleanup()

	ctx := context.Background()
	m := &mutationResolver{r}

	if _, err := m.RequestOtp(ctx, "+233537144161"); err != nil {
		t.Fatal(err)
	}
	code := sender.lastCode()
	if _, err := m.VerifyOtp(ctx, "+233537144161", code); err != nil {
		t.Fatal(err)
	}

	other := "Nana"
	res, err := m.CreateAccount(ctx, model.CreateAccountInput{
		Phone:           "+233537144161",
		FirstName:       "Kojo",
		Surname:         "Asante",
		OtherNames:      &other,
		Password:        "StrongPass1!",
		ConfirmPassword: "StrongPass1!",
	})
	if err != nil {
		t.Fatalf("CreateAccount: %v", err)
	}
	if !res.Success {
		t.Fatalf("expected success, got %+v", res)
	}
	if res.User == nil {
		t.Fatal("expected user in result")
	}
	if res.User.FirstName != "Kojo" || res.User.Surname != "Asante" {
		t.Errorf("unexpected user: %+v", res.User)
	}
	if res.User.OtherNames == nil || *res.User.OtherNames != other {
		t.Errorf("unexpected other names: %v", res.User.OtherNames)
	}
}

func TestCreateAccountResolverRequiresVerification(t *testing.T) {
	r, _, cleanup := resolver(t)
	defer cleanup()

	res, err := (&mutationResolver{r}).CreateAccount(context.Background(), model.CreateAccountInput{
		Phone:           "+233537144161",
		FirstName:       "Kojo",
		Surname:         "Asante",
		Password:        "StrongPass1!",
		ConfirmPassword: "StrongPass1!",
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Success {
		t.Fatal("expected account creation without verification to fail")
	}
}

func createUserThroughResolver(t *testing.T, r *Resolver, phone string) *model.User {
	t.Helper()
	ctx := context.Background()
	m := &mutationResolver{r}

	code, hash, err := otp.Generate()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.RequestOTP(ctx, r.Pool, phone, "register", hash, time.Now().Add(otp.DefaultTTL)); err != nil {
		t.Fatal(err)
	}
	if valid, _, _ := db.VerifyOTP(ctx, r.Pool, phone, "register", code); !valid {
		t.Fatal("could not verify fallback otp")
	}

	res, err := m.CreateAccount(ctx, model.CreateAccountInput{
		Phone:           phone,
		FirstName:       "Kojo",
		Surname:         "Asante",
		Password:        "StrongPass1!",
		ConfirmPassword: "StrongPass1!",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Success || res.User == nil {
		t.Fatalf("expected successful create, got %+v", res)
	}
	return res.User
}

func countUsersIn(t *testing.T, r *Resolver) int64 {
	t.Helper()
	var count int64
	if err := r.Pool.QueryRow(context.Background(), "SELECT count(*) FROM users").Scan(&count); err != nil {
		t.Fatal(err)
	}
	return count
}

func TestCreateAccountResolverDuplicatePhone(t *testing.T) {
	r, _, cleanup := resolver(t)
	defer cleanup()

	phone := "+233537144161"
	createUserThroughResolver(t, r, phone)

	// Try to register the same number again, with a fresh verified OTP.
	code2, hash2, _ := otp.Generate()
	ctx := context.Background()
	if _, err := db.RequestOTP(ctx, r.Pool, phone, "register", hash2, time.Now().Add(otp.DefaultTTL)); err != nil {
		t.Fatal(err)
	}
	if valid, _, _ := db.VerifyOTP(ctx, r.Pool, phone, "register", code2); !valid {
		t.Fatal("could not verify second otp")
	}

	res, err := (&mutationResolver{r}).CreateAccount(ctx, model.CreateAccountInput{
		Phone:           phone,
		FirstName:       "Ama",
		Surname:         "Mensah",
		Password:        "StrongPass1!",
		ConfirmPassword: "StrongPass1!",
	})
	if err != nil {
		t.Fatalf("expected friendly result, got error: %v", err)
	}
	if res.Success {
		t.Fatal("expected duplicate registration to fail")
	}
	if res.User != nil {
		t.Fatal("expected no user in duplicate result")
	}
	if want := "already exists"; !contains(res.Message, want) {
		t.Errorf("expected message containing %q, got %q", want, res.Message)
	}

	if count := countUsersIn(t, r); count != 1 {
		t.Fatalf("expected exactly 1 user after duplicate attempt, got %d", count)
	}
}

func TestRequestOTPBlocksRegisteredPhone(t *testing.T) {
	r, sender, cleanup := resolver(t)
	defer cleanup()

	phone := "+233537144161"
	createUserThroughResolver(t, r, phone)

	res, err := (&mutationResolver{r}).RequestOtp(context.Background(), phone)
	if err != nil {
		t.Fatal(err)
	}
	if res.Success {
		t.Fatal("expected requestOTP to be blocked for an existing account")
	}
	if want := "already exists"; !contains(res.Message, want) {
		t.Errorf("expected message containing %q, got %q", want, res.Message)
	}
	if sender.sentCount() != 0 {
		t.Errorf("expected no SMS to be sent, got %d", sender.sentCount())
	}
}

func TestCreateAccountResolverPasswordValidation(t *testing.T) {
	r, sender, cleanup := resolver(t)
	defer cleanup()

	ctx := context.Background()
	m := &mutationResolver{r}

	t.Run("weak password", func(t *testing.T) {
		_, err := m.CreateAccount(ctx, model.CreateAccountInput{
			Phone:           "+233537144161",
			FirstName:       "Kojo",
			Surname:         "Asante",
			Password:        "weak",
			ConfirmPassword: "weak",
		})
		if err == nil {
			t.Fatal("expected weak password error")
		}
	})

	t.Run("mismatched passwords", func(t *testing.T) {
		_, err := m.CreateAccount(ctx, model.CreateAccountInput{
			Phone:           "+233537144161",
			FirstName:       "Kojo",
			Surname:         "Asante",
			Password:        "StrongPass1!",
			ConfirmPassword: "Different1!",
		})
		if err == nil {
			t.Fatal("expected mismatch error")
		}
	})

	t.Run("empty name", func(t *testing.T) {
		_, err := m.CreateAccount(context.Background(), model.CreateAccountInput{
			Phone:           "+233537144161",
			FirstName:       "   ",
			Surname:         "Asante",
			Password:        "StrongPass1!",
			ConfirmPassword: "StrongPass1!",
		})
		if err == nil {
			t.Fatal("expected empty name error")
		}
	})

	t.Run("sms failure fails requestOTP and no otp stored as verified", func(t *testing.T) {
		sender.fail = true
		_, err := m.RequestOtp(ctx, "+233537144161")
		if err == nil {
			t.Fatal("expected error when sms fails")
		}
	})
}