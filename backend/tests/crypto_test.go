package tests

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

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

func encryptedGraphQLRequest(t *testing.T, srv *httptest.Server, c *crypto.Cipher, query string) map[string]any {
	t.Helper()
	plain, _ := json.Marshal(map[string]any{"query": query})
	body, err := c.Encrypt(plain)
	if err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequest(http.MethodPost, srv.URL+"/query", bytes.NewReader([]byte(body)))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(crypto.EncryptedHeader, "1")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("encrypted request: %v", err)
	}
	defer resp.Body.Close()

	var encBody bytes.Buffer
	if _, err := encBody.ReadFrom(resp.Body); err != nil {
		t.Fatal(err)
	}
	decrypted, err := c.Decrypt(encBody.String())
	if err != nil {
		t.Fatalf("decrypt response: %v (status %d)", err, resp.StatusCode)
	}

	var out map[string]any
	if err := json.Unmarshal(decrypted, &out); err != nil {
		t.Fatalf("decode decrypted response: %v: %s", err, decrypted)
	}
	return out
}

func TestEncryptedGraphQLRequest(t *testing.T) {
	c := testCipher(t)
	h, pool, sender, cleanup := buildTestHandler(t)
	defer cleanup()

	srv := httptest.NewServer(crypto.Middleware(h, c))
	defer srv.Close()

	res := gqlMutation(t, encryptedGraphQLRequest(t, srv, c, requestOTPQuery("+233537144161")), "requestOTP")
	if res["success"] != true {
		t.Fatalf("expected encrypted requestOTP to succeed, got %+v", res)
	}

	code := waitForSMSCode(t, sender)
	verify := gqlMutation(t, encryptedGraphQLRequest(t, srv, c, verifyOTPQuery("+233537144161", code)), "verifyOTP")
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
	c := testCipher(t)
	h, _, _, cleanup := buildTestHandler(t)
	defer cleanup()

	srv := httptest.NewServer(crypto.Middleware(h, c))
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/query", bytes.NewReader([]byte("not-ciphertext")))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(crypto.EncryptedHeader, "1")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for garbage ciphertext, got %d", resp.StatusCode)
	}
}

func TestEncryptedMiddlewareSkipsPlaintext(t *testing.T) {
	c := testCipher(t)
	h, _, _, cleanup := buildTestHandler(t)
	defer cleanup()

	srv := httptest.NewServer(crypto.Middleware(h, c))
	defer srv.Close()

	res := gqlMutation(t, gqlQuery(t, srv, requestOTPQuery("+233537144161")), "requestOTP")
	if res["success"] != true {
		t.Fatalf("expected plaintext request without header to pass through, got %+v", res)
	}
}

func TestEncryptedRequestOTPStillThrottles(t *testing.T) {
	c := testCipher(t)
	h, _, sender, cleanup := buildTestHandler(t)
	defer cleanup()

	srv := httptest.NewServer(crypto.Middleware(h, c))
	defer srv.Close()

	first := gqlMutation(t, encryptedGraphQLRequest(t, srv, c, requestOTPQuery("+233537144161")), "requestOTP")
	if first["success"] != true {
		t.Fatalf("first request should succeed, got %+v", first)
	}
	waitForSMSCode(t, sender)

	second := gqlMutation(t, encryptedGraphQLRequest(t, srv, c, requestOTPQuery("+233537144161")), "requestOTP")
	if second["success"] == true {
		t.Fatal("expected resend to be throttled via encrypted channel")
	}
}