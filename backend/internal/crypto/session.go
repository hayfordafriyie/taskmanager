package crypto

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

const SessionCookieName = "session_token"

const sessionCookiePath = "/"

type SessionStore struct {
	mu   sync.Mutex
	ttl  time.Duration
	keys map[string]sessionEntry
}

type sessionEntry struct {
	key     []byte
	expires time.Time
}

func NewSessionStore(ttl time.Duration) *SessionStore {
	if ttl <= 0 {
		ttl = 30 * time.Minute
	}
	return &SessionStore{ttl: ttl, keys: make(map[string]sessionEntry)}
}

func (s *SessionStore) Create() (token string, key []byte, cookie *http.Cookie, err error) {
	tokenBytes := make([]byte, 32)
	keyBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", nil, nil, fmt.Errorf("generate session token: %w", err)
	}
	if _, err := rand.Read(keyBytes); err != nil {
		return "", nil, nil, fmt.Errorf("generate session key: %w", err)
	}
	token = base64.RawURLEncoding.EncodeToString(tokenBytes)

	s.mu.Lock()
	s.sweepLocked()
	s.keys[token] = sessionEntry{key: keyBytes, expires: time.Now().Add(s.ttl)}
	s.mu.Unlock()

	cookie = &http.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     sessionCookiePath,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(s.ttl.Seconds()),
	}
	return token, keyBytes, cookie, nil
}

func (s *SessionStore) Lookup(token string) ([]byte, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if token == "" {
		return nil, false
	}
	e, ok := s.keys[token]
	if !ok {
		return nil, false
	}
	if time.Now().After(e.expires) {
		delete(s.keys, token)
		return nil, false
	}
	return e.key, true
}

func (s *SessionStore) Delete(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.keys, token)
}

func (s *SessionStore) sweepLocked() {
	now := time.Now()
	for tok, e := range s.keys {
		if now.After(e.expires) {
			delete(s.keys, tok)
		}
	}
}

func SessionHandler(store *SessionStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		_, key, cookie, err := store.Create()
		if err != nil {
			http.Error(w, "failed to create session", http.StatusInternalServerError)
			return
		}
		http.SetCookie(w, cookie)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"key": base64.StdEncoding.EncodeToString(key),
		})
	}
}
