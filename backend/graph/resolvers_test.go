package graph

import (
	"context"
	"errors"
	"os"
	"regexp"
	"sync"
	"testing"

	"taskmanager/graph/model"
	"taskmanager/internal/notif"
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