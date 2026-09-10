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

type TaskRow struct {
	ID          uuid.UUID
	TeamID      uuid.UUID
	CreatedBy   uuid.UUID
	AssigneeID  *uuid.UUID
	Title       string
	Description string
	Status      string
	Priority    string
	DueAt       *time.Time
	CompletedAt *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time

	CreatorFirst   string
	CreatorSurname string
	// Assignee details (nil when there is no assignee).
	AssigneePhone   *string
	AssigneeFirst   *string
	AssigneeSurname *string
}

type NotificationRow struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	Kind      string
	Title     string
	Body      string
	TaskID    *uuid.UUID
	Read      bool
	CreatedAt time.Time
}

type ConversationRow struct {
	ID          uuid.UUID
	TeamID      uuid.UUID
	Kind        string
	CreatedAt   time.Time
	LastAt      time.Time
	PeerID      *uuid.UUID
	PeerFirst   *string
	PeerSurname *string
	PeerPhone   *string
	LastBody    *string
	LastSender  *uuid.UUID
	UnreadCount int64
}

type MessageRow struct {
	ID             uuid.UUID
	ConversationID uuid.UUID
	SenderID       uuid.UUID
	SenderFirst    string
	SenderSurname  string
	SenderPhone    string
	Body           string
	CreatedAt      time.Time
}

type RecipientRow struct {
	UserID    uuid.UUID
	FirstName string
	Surname   string
	Phone     string
}
