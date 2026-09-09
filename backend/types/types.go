package types

import (
	"time"

	"github.com/google/uuid"
)

type SMSPayload struct {
	PhoneNumbers []string
	Message      string
}

type SMSConfig struct {
	APIKey          string
	BaseURL         string
	DefaultSenderID string
}

type MnotifyResponse struct {
	Code    string `json:"code"`
	Status  string `json:"status"`
	Message string `json:"message"`
	Summary struct {
		CreditUsed float64 `json:"credit_used"`
	} `json:"summary"`
}

type SMSJob struct {
	Payload  SMSPayload
	SenderID string
}

type UserRow struct {
	ID         uuid.UUID
	Phone      string
	FirstName  string
	Surname    string
	OtherNames *string
	CreatedAt  time.Time
}

type SessionEntry struct {
	Key     []byte
	Expires time.Time
}
