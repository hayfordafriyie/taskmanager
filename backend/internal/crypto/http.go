package crypto

import (
	"bytes"
	"io"
	"net/http"
)

// EncryptedHeader is the header a client sets to opt into encrypted
// request/response bodies.
const EncryptedHeader = "X-Encrypted"

// Middleware decrypts an encrypted request body and encrypts the response
// body using the key bound to the client's session cookie. Requests without
// the X-Encrypted header pass through untouched so the GraphQL playground and
// health checks keep working with plaintext.
func (s *SessionStore) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get(EncryptedHeader) != "1" {
			next.ServeHTTP(w, r)
			return
		}

		cookie, err := r.Cookie(SessionCookieName)
		if err != nil {
			http.Error(w, "missing session", http.StatusUnauthorized)
			return
		}
		key, ok := s.Lookup(cookie.Value)
		if !ok {
			http.Error(w, "invalid or expired session", http.StatusUnauthorized)
			return
		}
		c, err := New(key)
		if err != nil {
			http.Error(w, "invalid session key", http.StatusInternalServerError)
			return
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "failed to read request body", http.StatusBadRequest)
			return
		}
		plain, err := c.Decrypt(string(body))
		if err != nil {
			http.Error(w, "failed to decrypt request body", http.StatusBadRequest)
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(plain))
		r.ContentLength = int64(len(plain))

		ew := &encryptedResponseWriter{
			ResponseWriter: w,
			cipher:         c,
			status:         http.StatusOK,
		}
		next.ServeHTTP(ew, r)
		ew.flush()
	})
}

// encryptedResponseWriter buffers the plaintext response and encrypts it once
// the handler has finished writing.
type encryptedResponseWriter struct {
	http.ResponseWriter
	cipher *Cipher
	status int
	buf    bytes.Buffer
}

func (w *encryptedResponseWriter) WriteHeader(code int) {
	if w.status != http.StatusOK {
		return
	}
	w.status = code
}

func (w *encryptedResponseWriter) Write(p []byte) (int, error) {
	return w.buf.Write(p)
}

// Flush implements http.Flusher as a no-op because output is buffered until
// the handler completes.
func (w *encryptedResponseWriter) Flush() {}

func (w *encryptedResponseWriter) flush() {
	ct := w.ResponseWriter.Header().Get("Content-Type")
	if ct == "" {
		ct = "application/json"
	}
	enc, err := w.cipher.Encrypt(w.buf.Bytes())
	if err != nil {
		http.Error(w.ResponseWriter, "failed to encrypt response", http.StatusInternalServerError)
		return
	}
	h := w.ResponseWriter.Header()
	h.Set("Content-Type", ct)
	h.Set(EncryptedHeader, "1")
	w.ResponseWriter.WriteHeader(w.status)
	w.ResponseWriter.Write([]byte(enc))
}