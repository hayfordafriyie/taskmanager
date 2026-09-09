// Package types holds the shared data structures used across the backend so
// that individual packages work with centrally defined types instead of
// declaring their own inline.
package types

import (
	"time"

	"github.com/google/uuid"
)

// SMSPayload is a single SMS message destined for one or more recipients.
type SMSPayload struct {
	PhoneNumbers []string
	Message      string
}

// SMSConfig holds the configuration used to talk to the SMS provider.
type SMSConfig struct {
	APIKey          string
	BaseURL         string
	DefaultSenderID string
}

// MnotifyResponse is the JSON response envelope returned by the SMS provider.
type MnotifyResponse struct {
	Code    string `json:"code"`
	Status  string `json:"status"`
	Message string `json:"message"`
	Summary struct {
		CreditUsed float64 `json:"credit_used"`
	} `json:"summary"`
}

// SMSJob is a queued SMS delivery request awaiting pickup by the background
// worker.
type SMSJob struct {
	Payload  SMSPayload
	SenderID string
}

// UserRow mirrors a row in the users table.
type UserRow struct {
	ID         uuid.UUID
	Phone      string
	FirstName  string
	Surname    string
	OtherNames *string
	CreatedAt  time.Time
}