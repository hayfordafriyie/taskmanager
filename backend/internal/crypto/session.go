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

// SessionCookieName is the HttpOnly cookie that binds a client to its
// encryption session key.
const SessionCookieName = "session_token"

const sessionCookiePath = "/"

// SessionStore issues and tracks per-client AES session keys. The key is
// handed to the client once, in plaintext, over the encrypted transport
// (HTTPS); every subsequent request/response in that session is
// authenticated-encrypted with that key instead of a static bundle key.
type SessionStore struct {
	mu   sync.Mutex
	ttl  time.Duration
	keys map[string]sessionEntry
}

type sessionEntry struct {
	key     []byte
	expires time.Time
}

// NewSessionStore returns a store whose sessions expire after ttl (defaults
// to 30 minutes when ttl <= 0).
func NewSessionStore(ttl time.Duration) *SessionStore {
	if ttl <= 0 {
		ttl = 30 * time.Minute
	}
	return &SessionStore{ttl: ttl, keys: make(map[string]sessionEntry)}
}

// Create issues a new session and returns its token, key and the cookie that
// must be sent back to the client.
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

// Lookup returns the key for a session token, if it is still valid.
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

// Delete removes a session immediately.
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

// SessionHandler issues a new encrypted session. It returns the AES session
// key once in a plaintext JSON body and stores the session binding in an
// HttpOnly cookie. Clients must acquire a session before making encrypted
// requests.
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