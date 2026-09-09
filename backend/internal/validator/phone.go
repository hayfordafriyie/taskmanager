package validator

import (
	"errors"
	"strings"
)

type phoneRule struct {
	length int
	lead   string
}

var phoneRules = map[string]phoneRule{
	"233": {9, "25"},
	"234": {10, "789"},
	"225": {8, ""},
	"221": {9, "78"},
	"226": {8, "567"},
	"223": {8, "67"},
	"220": {7, ""},
	"228": {8, "79"},
	"229": {8, "09"},
	"227": {8, "9"},
	"224": {8, "67"},
	"245": {7, "9"},
}

var ErrInvalidPhone = errors.New("invalid phone number, expected a West African number like +233537144161")

func NormalizePhone(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "-", "")
	s = strings.ReplaceAll(s, "(", "")
	s = strings.ReplaceAll(s, ")", "")
	s = strings.TrimPrefix(s, "+")
	s = strings.TrimPrefix(s, "00")

	for code, rule := range phoneRules {
		if strings.HasPrefix(s, code) {
			if validNational(s[len(code):], rule) {
				return "+" + code + s[len(code):], nil
			}
		}
	}

	if strings.HasPrefix(s, "0") {
		candidate := s[1:]
		if rule, ok := phoneRules["233"]; ok && validNational(candidate, rule) {
			return "+233" + candidate, nil
		}
	}

	return "", ErrInvalidPhone
}

func IsValidPhone(raw string) bool {
	_, err := NormalizePhone(raw)
	return err == nil
}

func validNational(s string, rule phoneRule) bool {
	if len(s) != rule.length {
		return false
	}
	if _, err := digitsOnly(s); err != nil {
		return false
	}
	return rule.lead == "" || strings.Contains(rule.lead, s[:1])
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
