package db

import (
	"context"
	"errors"
	"time"

	"taskmanager/types"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotConversationMember = errors.New("you are not part of this conversation")
	ErrSelfConversation      = errors.New("you cannot start a conversation with yourself")
	ErrEmptyMessage          = errors.New("message cannot be empty")
)

func mapChatError(err error) (error, bool) {
	pgErr, ok := err.(*pgconn.PgError)
	if !ok {
		return nil, false
	}
	switch pgErr.Code {
	case "45040":
		return ErrNotConversationMember, true
	case "45041":
		return ErrSelfConversation, true
	case "45042":
		return ErrEmptyMessage, true
	}
	return nil, false
}

// EnsureDirectConversation returns (creating if needed) the 1:1 chat between two
// members of a workspace.
func EnsureDirectConversation(
	ctx context.Context,
	pool *pgxpool.Pool,
	teamID, userA, userB uuid.UUID,
) (*types.ConversationRow, error) {
	var c types.ConversationRow
	err := pool.QueryRow(
		ctx,
		"SELECT id, team_id, kind, created_at, last_message_at FROM ensure_direct_conversation($1, $2, $3)",
		teamID, userA, userB,
	).Scan(&c.ID, &c.TeamID, &c.Kind, &c.CreatedAt, &c.LastAt)
	if err != nil {
		if mapped, ok := mapChatError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return &c, nil
}

// ListConversations is a user's inbox with peer, last message and unread count.
func ListConversations(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) ([]types.ConversationRow, error) {
	rows, err := pool.Query(
		ctx,
		`SELECT conversation_id, team_id, kind,
		        peer_id, peer_first, peer_surname, peer_phone,
		        last_body, last_sender_id, last_at, unread_count
		   FROM list_conversations($1)`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []types.ConversationRow
	for rows.Next() {
		var c types.ConversationRow
		if err := rows.Scan(
			&c.ID, &c.TeamID, &c.Kind,
			&c.PeerID, &c.PeerFirst, &c.PeerSurname, &c.PeerPhone,
			&c.LastBody, &c.LastSender, &c.LastAt, &c.UnreadCount,
		); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// ConversationMessages fetches messages (oldest first). Passing a non-nil
// `after` returns only newer messages, which powers realtime/incremental sync.
func ConversationMessages(
	ctx context.Context,
	pool *pgxpool.Pool,
	conversationID, userID uuid.UUID,
	limit int,
	after *time.Time,
) ([]types.MessageRow, error) {
	rows, err := pool.Query(
		ctx,
		`SELECT message_id, sender_id, sender_first, sender_surname, sender_phone, body, created_at
		   FROM conversation_messages($1, $2, $3, $4)`,
		conversationID, userID, limit, after,
	)
	if err != nil {
		if mapped, ok := mapChatError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	defer rows.Close()

	var out []types.MessageRow
	for rows.Next() {
		var m types.MessageRow
		m.ConversationID = conversationID
		if err := rows.Scan(
			&m.ID, &m.SenderID, &m.SenderFirst, &m.SenderSurname, &m.SenderPhone,
			&m.Body, &m.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// SendMessage appends a message and returns it (without sender details; the
// resolver fills those from the team roster / caller).
func SendMessage(
	ctx context.Context,
	pool *pgxpool.Pool,
	conversationID, senderID uuid.UUID,
	body string,
) (*types.MessageRow, error) {
	var m types.MessageRow
	err := pool.QueryRow(
		ctx,
		"SELECT id, conversation_id, sender_id, body, created_at FROM send_message($1, $2, $3)",
		conversationID, senderID, body,
	).Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.Body, &m.CreatedAt)
	if err != nil {
		if mapped, ok := mapChatError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	m.SenderID = senderID
	return &m, nil
}

func MarkConversationRead(ctx context.Context, pool *pgxpool.Pool, conversationID, userID uuid.UUID) (bool, error) {
	var ok bool
	err := pool.QueryRow(ctx, "SELECT mark_conversation_read($1, $2)", conversationID, userID).Scan(&ok)
	if err != nil {
		if mapped, ok := mapChatError(err); ok {
			return false, mapped
		}
		return false, err
	}
	return ok, nil
}

// MessageRecipients lists conversation members other than the sender.
func MessageRecipients(ctx context.Context, pool *pgxpool.Pool, conversationID, senderID uuid.UUID) ([]types.RecipientRow, error) {
	rows, err := pool.Query(
		ctx,
		"SELECT user_id, first_name, surname, phone FROM message_recipients($1, $2)",
		conversationID, senderID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []types.RecipientRow
	for rows.Next() {
		var r types.RecipientRow
		if err := rows.Scan(&r.UserID, &r.FirstName, &r.Surname, &r.Phone); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}
