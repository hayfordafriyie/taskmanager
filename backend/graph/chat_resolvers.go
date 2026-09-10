package graph

import (
	"context"
	"fmt"
	"strings"
	"time"

	"taskmanager/graph/model"
	"taskmanager/internal/db"
	"taskmanager/internal/realtime"
	"taskmanager/types"

	"github.com/google/uuid"
)

func messagePreview(body string) string {
	b := strings.TrimSpace(strings.ReplaceAll(body, "\n", " "))
	if len(b) > 120 {
		return b[:117] + "…"
	}
	return b
}

func toModelMessage(m *types.MessageRow) *model.Message {
	return &model.Message{
		ID:             m.ID,
		ConversationID: m.ConversationID,
		Sender: toModelUser(&types.UserRow{
			ID: m.SenderID, Phone: m.SenderPhone, FirstName: m.SenderFirst, Surname: m.SenderSurname,
		}),
		Body:      m.Body,
		CreatedAt: m.CreatedAt,
	}
}

func (r *Resolver) conversationModel(c *types.ConversationRow) *model.Conversation {
	out := &model.Conversation{
		ID:            c.ID,
		TeamID:        c.TeamID,
		Kind:          c.Kind,
		LastMessageAt: c.LastAt,
		UnreadCount:   int32(c.UnreadCount),
	}
	if c.PeerID != nil {
		peer := &model.User{ID: *c.PeerID}
		if c.PeerFirst != nil {
			peer.FirstName = *c.PeerFirst
		}
		if c.PeerSurname != nil {
			peer.Surname = *c.PeerSurname
		}
		if c.PeerPhone != nil {
			peer.Phone = *c.PeerPhone
		}
		out.Peer = peer
	}
	if c.LastBody != nil {
		msg := &model.Message{
			ConversationID: c.ID,
			Body:           *c.LastBody,
			CreatedAt:      c.LastAt,
		}
		if c.LastSender != nil {
			msg.Sender = &model.User{ID: *c.LastSender}
		}
		out.LastMessage = msg
	}
	return out
}

// Conversations is the resolver for the conversations field.
func (r *queryResolver) Conversations(ctx context.Context) ([]*model.Conversation, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := db.ListConversations(ctx, r.Pool, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load conversations: %w", err)
	}
	out := make([]*model.Conversation, 0, len(rows))
	for i := range rows {
		out = append(out, r.conversationModel(&rows[i]))
	}
	return out, nil
}

// ConversationMessages is the resolver for the conversationMessages field.
func (r *queryResolver) ConversationMessages(ctx context.Context, conversationID uuid.UUID, after *time.Time, limit *int32) ([]*model.Message, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	max := 200
	if limit != nil && *limit > 0 {
		max = int(*limit)
	}
	rows, err := db.ConversationMessages(ctx, r.Pool, conversationID, user.ID, max, after)
	if err != nil {
		if err == db.ErrNotConversationMember {
			return nil, err
		}
		return nil, fmt.Errorf("load messages: %w", err)
	}
	out := make([]*model.Message, 0, len(rows))
	for i := range rows {
		out = append(out, toModelMessage(&rows[i]))
	}
	return out, nil
}

// StartConversation is the resolver for the startConversation field. It is
// find-or-create, so opening a chat with a teammate continues any old thread.
func (r *mutationResolver) StartConversation(ctx context.Context, memberID uuid.UUID) (*model.Conversation, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}
	conv, err := db.EnsureDirectConversation(ctx, r.Pool, teamID, user.ID, memberID)
	if err != nil {
		switch err {
		case db.ErrSelfConversation, db.ErrNotWorkspaceMember:
			return nil, err
		default:
			return nil, fmt.Errorf("start conversation: %w", err)
		}
	}
	// Reload through the inbox view so peer + unread are populated.
	list, err := db.ListConversations(ctx, r.Pool, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load conversation: %w", err)
	}
	for i := range list {
		if list[i].ID == conv.ID {
			return r.conversationModel(&list[i]), nil
		}
	}
	return r.conversationModel(conv), nil
}

// SendMessage is the resolver for the sendMessage field. It persists the
// message, then alerts every other member in-app and by SMS.
func (r *mutationResolver) SendMessage(ctx context.Context, conversationID uuid.UUID, body string) (*model.Message, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(body) == "" {
		return nil, db.ErrEmptyMessage
	}

	saved, err := db.SendMessage(ctx, r.Pool, conversationID, user.ID, body)
	if err != nil {
		if err == db.ErrNotConversationMember || err == db.ErrEmptyMessage {
			return nil, err
		}
		return nil, fmt.Errorf("send message: %w", err)
	}
	saved.SenderFirst = user.FirstName
	saved.SenderSurname = user.Surname
	saved.SenderPhone = user.Phone

	recipients, err := db.MessageRecipients(ctx, r.Pool, conversationID, user.ID)
	if err == nil {
		senderName := strings.TrimSpace(user.FirstName + " " + user.Surname)
		if senderName == "" {
			senderName = "A teammate"
		}
		preview := messagePreview(saved.Body)

		// Push to any open realtime stream (SSE) for instant delivery.
		if r.Realtime != nil {
			ids := make([]uuid.UUID, 0, len(recipients))
			for _, rc := range recipients {
				ids = append(ids, rc.UserID)
			}
			r.Realtime.PublishTo(ids, realtime.Event{
				Type: "message",
				Payload: realtime.MessageEvent{
					Type:           "message",
					ConversationID: conversationID,
					Message: realtime.MessagePayload{
						ID:             saved.ID,
						ConversationID: conversationID,
						SenderID:       saved.SenderID,
						SenderFirst:    user.FirstName,
						SenderSurname:  user.Surname,
						Body:           saved.Body,
						CreatedAt:      saved.CreatedAt,
					},
				},
			})
		}

		for _, rc := range recipients {
			_, _ = db.CreateNotification(ctx, r.Pool, rc.UserID, "message",
				fmt.Sprintf("New message from %s", senderName), preview, nil)
			r.SMSQueue.Enqueue(types.SMSPayload{
				PhoneNumbers: []string{rc.Phone},
				Message:      fmt.Sprintf("New message from %s: %s", senderName, preview),
			}, "")
		}
	}

	return toModelMessage(saved), nil
}

// MarkConversationRead is the resolver for the markConversationRead field.
func (r *mutationResolver) MarkConversationRead(ctx context.Context, conversationID uuid.UUID) (bool, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return false, err
	}
	ok, err := db.MarkConversationRead(ctx, r.Pool, conversationID, user.ID)
	if err != nil {
		if err == db.ErrNotConversationMember {
			return false, nil
		}
		return false, fmt.Errorf("mark conversation read: %w", err)
	}
	return ok, nil
}
