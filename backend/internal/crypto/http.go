package crypto

import (
	"bytes"
	"io"
	"net/http"
)

const EncryptedHeader = "X-Encrypted"

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
