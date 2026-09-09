package validator

import (
	"errors"
	"strings"
)

const GhanaCountryCode = "233"

var ErrInvalidPhone = errors.New("invalid ghana phone number, expected format like +233537144161")

// NormalizeGhanaPhone normalizes a Ghana mobile number into
// international E.164 form (+233XXXXXXXXX). Accepted inputs:
//
//	+233537144161, 233537144161, 00233537144161, 0537144161
func NormalizeGhanaPhone(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "-", "")
	s = strings.ReplaceAll(s, "(", "")
	s = strings.ReplaceAll(s, ")", "")
	s = strings.TrimPrefix(s, "+")
	s = strings.TrimPrefix(s, "00")

	switch {
	case strings.HasPrefix(s, "00"):
		s = strings.TrimPrefix(s, "00")
	case strings.HasPrefix(s, GhanaCountryCode):
		s = strings.TrimPrefix(s, GhanaCountryCode)
	case strings.HasPrefix(s, "0"):
		s = strings.TrimPrefix(s, "0")
	default:
		return "", ErrInvalidPhone
	}

	if len(s) != 9 {
		return "", ErrInvalidPhone
	}

	if s[0] != '2' && s[0] != '5' {
		return "", ErrInvalidPhone
	}

	if _, err := digitsOnly(s); err != nil {
		return "", ErrInvalidPhone
	}

	return "+" + GhanaCountryCode + s, nil
}

func IsValidGhanaPhone(raw string) bool {
	_, err := NormalizeGhanaPhone(raw)
	return err == nil
}

func digitsOnly(s string) (string, error) {
	var b strings.Builder
	for _, r := range s {
		if r < '0' || r > '9' {
			return "", errors.New("non-digit character")
		}
		b.WriteRune(r)
	}
	return b.String(), nil
}