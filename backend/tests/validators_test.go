package tests

import (
	"errors"
	"strings"
	"testing"

	"taskmanager/internal/validator"
)

func TestNormalizeGhanaPhone(t *testing.T) {
	tests := []struct {
		raw     string
		want    string
		wantErr bool
	}{
		{"+233537144161", "+233537144161", false},
		{"233537144161", "+233537144161", false},
		{"0537144161", "+233537144161", false},
		{"00233537144161", "+233537144161", false},
		{"+233 53 714 4161", "+233537144161", false},
		{"+233-537-144-161", "+233537144161", false},
		{"(+233) 537 144 161", "+233537144161", false},
		{"+233241234567", "+233241234567", false},
		{"0241234567", "+233241234567", false},

		{"+15551234567", "", true},
		{"+2330537144161", "", true},
		{"+23353714416", "", true},
		{"+2335371441612", "", true},
		{"+233997144161", "", true},
		{"537144161", "", true},
		{"+23353-714-416x1", "", true},
		{"", "", true},
	}

	for _, tt := range tests {
		got, err := validator.NormalizeGhanaPhone(tt.raw)
		if tt.wantErr {
			if err == nil {
				t.Errorf("NormalizeGhanaPhone(%q): expected error, got %q", tt.raw, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("NormalizeGhanaPhone(%q): unexpected error %v", tt.raw, err)
			continue
		}
		if got != tt.want {
			t.Errorf("NormalizeGhanaPhone(%q) = %q, want %q", tt.raw, got, tt.want)
		}
	}
}

func TestIsValidGhanaPhone(t *testing.T) {
	if !validator.IsValidGhanaPhone("+233537144161") {
		t.Error("expected +233537144161 to be valid")
	}
	if validator.IsValidGhanaPhone("+233997144161") {
		t.Error("expected +233997144161 to be invalid (bad network prefix)")
	}
	if validator.IsValidGhanaPhone("+1234567890123") {
		t.Error("expected foreign number to be invalid")
	}
}

func TestValidatePassword(t *testing.T) {
	tooLong := strings.Repeat("a", 62) + "A1!"

	tests := []struct {
		name    string
		pw      string
		wantErr error
	}{
		{"valid", "StrongPass1!", nil},
		{"valid with symbols", "p@ssW0rd!xY", nil},
		{"too short", "A1!abcd", validator.ErrPasswordTooShort},
		{"too long", tooLong, validator.ErrPasswordTooLong},
		{"no uppercase", "strongpass1!", validator.ErrPasswordUpper},
		{"no lowercase", "STRONGPASS1!", validator.ErrPasswordLower},
		{"no digit", "StrongPass!", validator.ErrPasswordDigit},
		{"no special", "StrongPass1", validator.ErrPasswordSpecial},
		{"empty", "", validator.ErrPasswordTooShort},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.ValidatePassword(tt.pw)
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
	if err := validator.ValidatePasswordConfirmation("SamePass1!", "SamePass1!"); err != nil {
		t.Errorf("expected match to pass, got %v", err)
	}
	if err := validator.ValidatePasswordConfirmation("SamePass1!", "Different1!"); err != validator.ErrPasswordMismatch {
		t.Errorf("expected mismatch error, got %v", err)
	}
}

func TestValidateName(t *testing.T) {
	if err := validator.ValidateName("Kojo", "first name"); err != nil {
		t.Errorf("expected valid name to pass, got %v", err)
	}
	if err := validator.ValidateName("   ", "first name"); err == nil {
		t.Error("expected whitespace-only name to fail")
	}
	if err := validator.ValidateName(strings.Repeat("a", 101), "first name"); err == nil {
		t.Error("expected >100 char name to fail")
	}
}
