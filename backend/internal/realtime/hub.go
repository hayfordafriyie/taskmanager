// Package realtime provides a tiny in-process pub/sub hub used to push events
// (chat messages today, anything later) to connected clients. It is deliberately
// dependency-free: subscribers are Go channels, and the HTTP layer streams them
// as Server-Sent Events. No external broker, no real socket library.
package realtime

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

// MessageEvent is the JSON payload pushed when a chat message is created.
type MessageEvent struct {
	Type           string         `json:"type"`
	ConversationID uuid.UUID      `json:"conversationId"`
	Message        MessagePayload `json:"message"`
}

// MessagePayload is the wire shape of a chat message for realtime delivery.
type MessagePayload struct {
	ID             uuid.UUID `json:"id"`
	ConversationID uuid.UUID `json:"conversationId"`
	SenderID       uuid.UUID `json:"senderId"`
	SenderFirst    string    `json:"senderFirstName"`
	SenderSurname  string    `json:"senderSurname"`
	Body           string    `json:"body"`
	CreatedAt      time.Time `json:"createdAt"`
}

// Event is the envelope delivered to subscribers.
type Event struct {
	Type    string
	Payload any
}

// Hub fans events out to per-user subscriber channels.
type Hub struct {
	mu   sync.RWMutex
	subs map[uuid.UUID]map[chan Event]struct{}
}

func NewHub() *Hub {
	return &Hub{subs: make(map[uuid.UUID]map[chan Event]struct{})}
}

// Subscribe registers a buffered channel for a user. Call the returned cancel
// func (defer) when the connection ends.
func (h *Hub) Subscribe(userID uuid.UUID) (<-chan Event, func()) {
	ch := make(chan Event, 16)

	h.mu.Lock()
	if h.subs[userID] == nil {
		h.subs[userID] = make(map[chan Event]struct{})
	}
	h.subs[userID][ch] = struct{}{}
	h.mu.Unlock()

	var once sync.Once
	cancel := func() {
		once.Do(func() {
			h.mu.Lock()
			if set, ok := h.subs[userID]; ok {
				delete(set, ch)
				if len(set) == 0 {
					delete(h.subs, userID)
				}
			}
			h.mu.Unlock()
			close(ch)
		})
	}
	return ch, cancel
}

// Publish delivers an event to every channel subscribed by the user. Delivery is
// best-effort and never blocks the caller: slow subscribers drop events because
// the client also has a polling fallback that re-syncs state.
func (h *Hub) Publish(userID uuid.UUID, ev Event) {
	h.mu.RLock()
	set := h.subs[userID]
	targets := make([]chan Event, 0, len(set))
	for ch := range set {
		targets = append(targets, ch)
	}
	h.mu.RUnlock()

	for _, ch := range targets {
		select {
		case ch <- ev:
		default:
		}
	}
}

// PublishTo fans an event out to several users.
func (h *Hub) PublishTo(userIDs []uuid.UUID, ev Event) {
	for _, id := range userIDs {
		h.Publish(id, ev)
	}
}

// SubscriberCount is used by tests/diagnostics.
func (h *Hub) SubscriberCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	n := 0
	for _, set := range h.subs {
		n += len(set)
	}
	return n
}
