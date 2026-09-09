package otp

import (
	"fmt"
	"regexp"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

var codeRe = regexp.MustCompile(`^[0-9]{6}$`)

func TestGenerate(t *testing.T) {
	for i := 0; i < 25; i++ {
		code, hash, err := Generate()
		if err != nil {
			t.Fatalf("Generate: %v", err)
		}
		if !codeRe.MatchString(code) {
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
		code, _, err := Generate()
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
	msg := Message("123456", DefaultTTL)
	if !strings.Contains(msg, "123456") {
		t.Errorf("message missing code: %q", msg)
	}
	if !strings.Contains(msg, fmt.Sprintf("%d", int(DefaultTTL.Minutes()))) {
		t.Errorf("message missing ttl: %q", msg)
	}
}