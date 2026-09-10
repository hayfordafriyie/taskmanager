package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"taskmanager/internal/auth"
	"taskmanager/internal/realtime"
)

// Events streams a user's realtime events as Server-Sent Events. Auth comes
// from a bearer token (query param for EventSource, which cannot set headers,
// with the Authorization header also accepted). Plain JSON, no encryption, so
// the browser can consume it with a stock EventSource.
func Events(hub *realtime.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		if token == "" {
			token = auth.BearerToken(r)
		}
		claims, err := auth.ParseToken(auth.JWTSecret(), token)
		if err != nil || !auth.IsAccess(claims) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		userID, err := claims.UserID()
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")
		w.WriteHeader(http.StatusOK)

		ch, cancel := hub.Subscribe(userID)
		defer cancel()

		fmt.Fprint(w, ": connected\n\n")
		flusher.Flush()

		heartbeat := time.NewTicker(25 * time.Second)
		defer heartbeat.Stop()

		for {
			select {
			case <-r.Context().Done():
				return
			case ev, open := <-ch:
				if !open {
					return
				}
				body, err := json.Marshal(ev.Payload)
				if err != nil {
					continue
				}
				fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Type, body)
				flusher.Flush()
			case <-heartbeat.C:
				fmt.Fprint(w, ": ping\n\n")
				flusher.Flush()
			}
		}
	}
}
