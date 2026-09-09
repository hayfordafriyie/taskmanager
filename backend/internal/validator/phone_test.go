package validator

import (
	"testing"
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
		got, err := NormalizeGhanaPhone(tt.raw)
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
	if !IsValidGhanaPhone("+233537144161") {
		t.Error("expected +233537144161 to be valid")
	}
	if IsValidGhanaPhone("+233997144161") {
		t.Error("expected +233997144161 to be invalid (bad network prefix)")
	}
	if IsValidGhanaPhone("+1234567890123") {
		t.Error("expected foreign number to be invalid")
	}
}