package tests

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"taskmanager/internal/crypto"
)

func testCipher(t *testing.T) *crypto.Cipher {
	t.Helper()
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	c, err := crypto.New(key)
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestCryptoRoundTrip(t *testing.T) {
	c := testCipher(t)
	for _, msg := range []string{"", "ok", "hello world", `{"query":"{ health }"}`} {
		enc, err := c.Encrypt([]byte(msg))
		if err != nil {
			t.Fatalf("encrypt %q: %v", msg, err)
		}
		got, err := c.Decrypt(enc)
		if err != nil {
			t.Fatalf("decrypt %q: %v", msg, err)
		}
		if string(got) != msg {
			t.Fatalf("roundtrip mismatch: got %q want %q", got, msg)
		}
	}
}

func TestCryptoRejectsTamperedPayload(t *testing.T) {
	c := testCipher(t)
	enc, err := c.Encrypt([]byte("secret"))
	if err != nil {
		t.Fatal(err)
	}
	raw := []byte(enc)
	raw[len(raw)-1] ^= 0x01
	if _, err := c.Decrypt(string(raw)); err == nil {
		t.Fatal("expected tampered payload to fail")
	}
}

func TestCryptoWrongKeyFails(t *testing.T) {
	a := testCipher(t)
	b, err := crypto.New([]byte("11111111111111111111111111111111"))
	if err != nil {
		t.Fatal(err)
	}
	enc, _ := a.Encrypt([]byte("msg"))
	if _, err := b.Decrypt(enc); err == nil {
		t.Fatal("expected decryption with wrong key to fail")
	}
}

func TestCryptoRejectsBadKey(t *testing.T) {
	if _, err := crypto.New([]byte("too-short")); err == nil {
		t.Fatal("expected too-short key to fail")
	}
	if _, err := crypto.NewFromBase64("not-base64!"); err == nil {
		t.Fatal("expected invalid base64 key to fail")
	}
}

func newEncryptedTestServer(t *testing.T, h http.Handler) *httptest.Server {
	t.Helper()
	sessions := crypto.NewSessionStore(5 * time.Minute)
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/session", crypto.SessionHandler(sessions))
	mux.Handle("/api/v1/query", sessions.Middleware(h))
	mux.Handle("/query", sessions.Middleware(h))
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

type encryptedTestClient struct {
	c      *crypto.Cipher
	cookie *http.Cookie
}

func newEncryptedClient(t *testing.T, srv *httptest.Server) *encryptedTestClient {
	t.Helper()
	resp, err := http.Post(srv.URL+"/api/v1/session", "application/json", nil)
	if err != nil {
		t.Fatalf("session handshake: %v", err)
	}
	defer resp.Body.Close()

	var out struct {
		Key string `json:"key"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode session response: %v", err)
	}
	c, err := crypto.NewFromBase64(out.Key)
	if err != nil {
		t.Fatalf("build cipher from session key: %v", err)
	}

	var cookie *http.Cookie
	for _, ck := range resp.Cookies() {
		if ck.Name == crypto.SessionCookieName {
			cookie = ck
			break
		}
	}
	if cookie == nil {
		t.Fatal("session handshake did not set session cookie")
	}

	return &encryptedTestClient{c: c, cookie: cookie}
}

func (ec *encryptedTestClient) gql(t *testing.T, srv *httptest.Server, query string) map[string]any {
	t.Helper()
	plain, _ := json.Marshal(map[string]any{"query": query})
	body, err := ec.c.Encrypt(plain)
	if err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/v1/query", bytes.NewReader([]byte(body)))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(crypto.EncryptedHeader, "1")
	req.AddCookie(ec.cookie)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("encrypted request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var encBody bytes.Buffer
	if _, err := encBody.ReadFrom(resp.Body); err != nil {
		t.Fatal(err)
	}
	decrypted, err := ec.c.Decrypt(encBody.String())
	if err != nil {
		t.Fatalf("decrypt response: %v", err)
	}

	var out map[string]any
	if err := json.Unmarshal(decrypted, &out); err != nil {
		t.Fatalf("decode decrypted response: %v: %s", err, decrypted)
	}
	return out
}

func TestEncryptedGraphQLRequest(t *testing.T) {
	h, pool, sender, cleanup := buildTestHandler(t)
	defer cleanup()
	srv := newEncryptedTestServer(t, h)
	client := newEncryptedClient(t, srv)

	res := gqlMutation(t, client.gql(t, srv, requestOTPQuery("+233537144161")), "requestOTP")
	if res["success"] != true {
		t.Fatalf("expected encrypted requestOTP to succeed, got %+v", res)
	}

	code := waitForSMSCode(t, sender)
	verify := gqlMutation(t, client.gql(t, srv, verifyOTPQuery("+233537144161", code)), "verifyOTP")
	if verify["success"] != true {
		t.Fatalf("expected encrypted verifyOTP to succeed, got %+v", verify)
	}

	if count, err := countUsers(context.Background(), pool); err != nil {
		t.Fatal(err)
	} else if count != 0 {
		t.Fatalf("expected 0 users, got %d", count)
	}
}

func TestEncryptedMiddlewareRejectsGarbage(t *testing.T) {
	h, _, _, cleanup := buildTestHandler(t)
	defer cleanup()
	srv := newEncryptedTestServer(t, h)
	client := newEncryptedClient(t, srv)

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/v1/query", bytes.NewReader([]byte("not-ciphertext")))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(crypto.EncryptedHeader, "1")
	req.AddCookie(client.cookie)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for garbage ciphertext, got %d", resp.StatusCode)
	}
}

func TestEncryptedMiddlewareRequiresSession(t *testing.T) {
	h, _, _, cleanup := buildTestHandler(t)
	defer cleanup()
	srv := newEncryptedTestServer(t, h)

	plain, _ := json.Marshal(map[string]any{"query": requestOTPQuery("+233537144161")})
	c := testCipher(t)
	body, _ := c.Encrypt(plain)
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/v1/query", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(crypto.EncryptedHeader, "1")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 without session cookie, got %d", resp.StatusCode)
	}
}

func TestEncryptedMiddlewareSkipsPlaintext(t *testing.T) {
	h, _, _, cleanup := buildTestHandler(t)
	defer cleanup()
	srv := newEncryptedTestServer(t, h)

	res := gqlMutation(t, gqlQuery(t, srv, requestOTPQuery("+233537144161")), "requestOTP")
	if res["success"] != true {
		t.Fatalf("expected plaintext request without header to pass through, got %+v", res)
	}
}

func TestEncryptedRequestOTPStillThrottles(t *testing.T) {
	h, _, sender, cleanup := buildTestHandler(t)
	defer cleanup()
	srv := newEncryptedTestServer(t, h)
	client := newEncryptedClient(t, srv)

	first := gqlMutation(t, client.gql(t, srv, requestOTPQuery("+233537144161")), "requestOTP")
	if first["success"] != true {
		t.Fatalf("first request should succeed, got %+v", first)
	}
	waitForSMSCode(t, sender)

	second := gqlMutation(t, client.gql(t, srv, requestOTPQuery("+233537144161")), "requestOTP")
	if second["success"] == true {
		t.Fatal("expected resend to be throttled via encrypted channel")
	}
}

func TestSessionExpiry(t *testing.T) {
	sessions := crypto.NewSessionStore(time.Millisecond)
	token, key, _, err := sessions.Create()
	if err != nil {
		t.Fatal(err)
	}
	if got, ok := sessions.Lookup(token); !ok || string(got) != string(key) {
		t.Fatal("expected fresh session to resolve")
	}
	time.Sleep(5 * time.Millisecond)
	if _, ok := sessions.Lookup(token); ok {
		t.Fatal("expected expired session to be rejected")
	}
}

func TestSessionDelete(t *testing.T) {
	sessions := crypto.NewSessionStore(time.Minute)
	token, _, _, _ := sessions.Create()
	sessions.Delete(token)
	if _, ok := sessions.Lookup(token); ok {
		t.Fatal("expected deleted session to be rejected")
	}
}
