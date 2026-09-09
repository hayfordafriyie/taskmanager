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

type UserCredentials struct {
	UserRow
	PasswordHash string
}

type TeamRow struct {
	ID        uuid.UUID
	Name      string
	CreatedAt time.Time
}

type TeamMemberRow struct {
	ID        uuid.UUID
	Phone     string
	FirstName string
	Surname   string
	Role      string
	CreatedAt time.Time
}

type InviteRow struct {
	ID                 uuid.UUID
	TeamID             uuid.UUID
	TeamName           string
	Phone              string
	Role               string
	Status             string
	InvitedBy          uuid.UUID
	InvitedByFirstName string
	InvitedBySurname   string
	ExpiresAt          time.Time
	CreatedAt          time.Time
}
