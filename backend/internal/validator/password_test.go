package validator

import (
	"errors"
	"strings"
	"testing"
)

func TestValidatePassword(t *testing.T) {
	tooLong := strings.Repeat("a", 62) + "A1!"

	tests := []struct {
		name    string
		pw      string
		wantErr error
	}{
		{"valid", "StrongPass1!", nil},
		{"valid with symbols", "p@ssW0rd!xY", nil},
		{"too short", "A1!abcd", ErrPasswordTooShort},
		{"too long", tooLong, ErrPasswordTooLong},
		{"no uppercase", "strongpass1!", ErrPasswordUpper},
		{"no lowercase", "STRONGPASS1!", ErrPasswordLower},
		{"no digit", "StrongPass!", ErrPasswordDigit},
		{"no special", "StrongPass1", ErrPasswordSpecial},
		{"empty", "", ErrPasswordTooShort},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePassword(tt.pw)
			if tt.wantErr == nil {
				if err != nil {
					t.Fatalf("ValidatePassword(%q) = %v, want nil", tt.pw, err)
				}
				return
			}
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("ValidatePassword(%q) = %v, want %v", tt.pw, err, tt.wantErr)
			}
		})
	}
}

func TestValidatePasswordConfirmation(t *testing.T) {
	if err := ValidatePasswordConfirmation("SamePass1!", "SamePass1!"); err != nil {
		t.Errorf("expected match to pass, got %v", err)
	}
	if err := ValidatePasswordConfirmation("SamePass1!", "Different1!"); err != ErrPasswordMismatch {
		t.Errorf("expected mismatch error, got %v", err)
	}
}

func TestValidateName(t *testing.T) {
	if err := ValidateName("Kojo", "first name"); err != nil {
		t.Errorf("expected valid name to pass, got %v", err)
	}
	if err := ValidateName("   ", "first name"); err == nil {
		t.Error("expected whitespace-only name to fail")
	}
	if err := ValidateName(strings.Repeat("a", 101), "first name"); err == nil {
		t.Error("expected >100 char name to fail")
	}
}