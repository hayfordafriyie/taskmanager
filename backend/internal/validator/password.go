package validator

import (
	"errors"
	"strings"
	"unicode"
)

const (
	MinPasswordLength = 8
	MaxPasswordLength = 64
)

var (
	ErrPasswordTooShort    = errors.New("password must be at least 8 characters")
	ErrPasswordTooLong     = errors.New("password must be at most 64 characters")
	ErrPasswordUpper       = errors.New("password must contain at least one uppercase letter")
	ErrPasswordLower       = errors.New("password must contain at least one lowercase letter")
	ErrPasswordDigit       = errors.New("password must contain at least one digit")
	ErrPasswordSpecial     = errors.New("password must contain at least one special character")
	ErrPasswordMismatch    = errors.New("password and confirmation do not match")
)

// ValidatePassword enforces a realistic password policy.
func ValidatePassword(pw string) error {
	if len(pw) < MinPasswordLength {
		return ErrPasswordTooShort
	}
	if len(pw) > MaxPasswordLength {
		return ErrPasswordTooLong
	}

	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, r := range pw {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		case unicode.IsPunct(r) || unicode.IsSymbol(r) || unicode.IsSpace(r):
			hasSpecial = true
		}
	}

	switch {
	case !hasUpper:
		return ErrPasswordUpper
	case !hasLower:
		return ErrPasswordLower
	case !hasDigit:
		return ErrPasswordDigit
	case !hasSpecial:
		return ErrPasswordSpecial
	}
	return nil
}

func ValidatePasswordConfirmation(pw, confirm string) error {
	if pw != confirm {
		return ErrPasswordMismatch
	}
	return nil
}

func ValidateName(name string, label string) error {
	if strings.TrimSpace(name) == "" {
		return errors.New(label + " is required")
	}
	if len([]rune(strings.TrimSpace(name))) > 100 {
		return errors.New(label + " must be at most 100 characters")
	}
	return nil
}