package otp

import (
	"crypto/rand"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const (
	DefaultTTL      = 10 * time.Minute
	ResendMinPeriod = 60 * time.Second
)

// Generate creates a fresh 6-digit code and its bcrypt hash.
func Generate() (code, hash string, err error) {
	code, err = randomDigits(6)
	if err != nil {
		return "", "", err
	}
	hashed, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
	if err != nil {
		return "", "", err
	}
	return code, string(hashed), nil
}

func randomDigits(n int) (string, error) {
	const max = 10
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	digits := make([]byte, n)
	for i := range b {
		digits[i] = '0' + b[i]%max
	}
	return string(digits), nil
}

func Message(code string, ttl time.Duration) string {
	return fmt.Sprintf(
		"Your Task Manager verification code is %s. It is valid for %d minutes.",
		code, int(ttl.Minutes()),
	)
}