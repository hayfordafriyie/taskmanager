package tests

import (
	"fmt"
	"regexp"
	"strings"
	"testing"

	"taskmanager/internal/otp"

	"golang.org/x/crypto/bcrypt"
)

var otpCodeRe = regexp.MustCompile(`^[0-9]{6}$`)

func TestGenerate(t *testing.T) {
	for i := 0; i < 25; i++ {
		code, hash, err := otp.Generate()
		if err != nil {
			t.Fatalf("Generate: %v", err)
		}
		if !otpCodeRe.MatchString(code) {
			t.Fatalf("code %q is not 6 digits", code)
		}
		if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(code)); err != nil {
			t.Fatalf("hash does not match code: %v", err)
		}
	}
}

func TestGenerateUniqueness(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		code, _, err := otp.Generate()
		if err != nil {
			t.Fatal(err)
		}
		seen[code] = true
	}
	if len(seen) < 50 {
		t.Errorf("codes look insufficiently random: got %d unique of 200", len(seen))
	}
}

func TestMessage(t *testing.T) {
	msg := otp.Message("123456", otp.DefaultTTL)
	if !strings.Contains(msg, "123456") {
		t.Errorf("message missing code: %q", msg)
	}
	if !strings.Contains(msg, fmt.Sprintf("%d", int(otp.DefaultTTL.Minutes()))) {
		t.Errorf("message missing ttl: %q", msg)
	}
}