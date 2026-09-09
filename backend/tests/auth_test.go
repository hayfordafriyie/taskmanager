package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"taskmanager/internal/auth"

	"github.com/google/uuid"
)

func gqlQueryAuth(t *testing.T, srv *httptest.Server, query, token string) map[string]any {
	t.Helper()
	body, _ := json.Marshal(map[string]any{"query": query})
	req, err := http.NewRequest(http.MethodPost, srv.URL+graphQLURL, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("graphql request build: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set(auth.Header, auth.Scheme+" "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("graphql request: %v", err)
	}
	defer resp.Body.Close()

	var out map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode graphql response: %v", err)
	}
	return out
}

func loginQuery(phone, password string) string {
	return fmt.Sprintf(
		`mutation { login(phone: %q, password: %q) { success message user { id phone firstName } accessToken refreshToken } }`,
		phone, password,
	)
}

func loginQueryFields(phone, password string) string {
	return fmt.Sprintf(
		`mutation { login(phone: %q, password: %q) { success message } }`,
		phone, password,
	)
}

func meQuery() string {
	return `query { me { id phone firstName surname } }`
}

func logoutQuery() string {
	return `mutation { logout }`
}

func refreshTokenQuery(token string) string {
	return fmt.Sprintf(
		`mutation { refreshToken(token: %q) { success message user { id phone } accessToken refreshToken } }`,
		token,
	)
}

func requestPasswordResetQuery(phone string) string {
	return fmt.Sprintf(`mutation { requestPasswordReset(phone: %q) { success message } }`, phone)
}

func resetPasswordQuery(phone, code, password, confirm string) string {
	return fmt.Sprintf(
		`mutation { resetPassword(phone: %q, code: %q, password: %q, confirmPassword: %q) { success message } }`,
		phone, code, password, confirm,
	)
}

func loginUserHTTP(t *testing.T, srv *httptest.Server, phone, password string) map[string]any {
	t.Helper()
	res := gqlMutation(t, gqlQuery(t, srv, loginQuery(phone, password)), "login")
	if res["success"] != true {
		t.Fatalf("login failed: %v", res)
	}
	if res["accessToken"] == "" || res["refreshToken"] == "" {
		t.Fatalf("expected access and refresh tokens, got %v", res)
	}
	return res
}

func TestLoginHappyPath(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	phone := "+233537144161"
	registerUserHTTP(t, srv, sender, phone)

	res := gqlMutation(t, gqlQuery(t, srv, loginQuery(phone, "StrongPass1!")), "login")
	if res["success"] != true {
		t.Fatalf("expected login to succeed, got %+v", res)
	}
	if res["accessToken"].(string) == "" {
		t.Fatal("expected an access token")
	}
	if res["refreshToken"].(string) == "" {
		t.Fatal("expected a refresh token")
	}
	user, _ := res["user"].(map[string]any)
	if user == nil || user["phone"] != phone {
		t.Fatalf("unexpected user: %v", res["user"])
	}

	waitUntil(t, 5*time.Second, func() bool {
		return sender.sentCount() >= 2
	})
	last := sender.messages[len(sender.messages)-1]
	if want := "account was accessed"; !strings.Contains(last, want) {
		t.Errorf("expected access alert mentioning %q, got %q", want, last)
	}
}

func TestLoginWrongPassword(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	phone := "+233537144161"
	registerUserHTTP(t, srv, sender, phone)

	res := gqlMutation(t, gqlQuery(t, srv, loginQueryFields(phone, "WrongPass1!")), "login")
	if res["success"] == true {
		t.Fatal("expected login to be rejected")
	}
	if want := "invalid phone number or password"; !strings.Contains(res["message"].(string), want) {
		t.Errorf("expected message containing %q, got %q", want, res["message"])
	}
}

func TestLoginUnknownPhone(t *testing.T) {
	srv, _, _, cleanup := newTestServer(t)
	defer cleanup()

	res := gqlMutation(t, gqlQuery(t, srv, loginQueryFields("+233555000111", "Whatever1!")), "login")
	if res["success"] == true {
		t.Fatal("expected login to be rejected for an unknown phone")
	}
}

func TestLoginInvalidPhone(t *testing.T) {
	srv, _, _, cleanup := newTestServer(t)
	defer cleanup()

	resp := gqlQuery(t, srv, loginQueryFields("+15551234567", "Whatever1!"))
	if !hasGQLErrors(t, resp) {
		t.Fatalf("expected graphql error for invalid phone, got %v", resp)
	}
}

func TestMeRequiresAuth(t *testing.T) {
	srv, _, _, cleanup := newTestServer(t)
	defer cleanup()

	resp := gqlQuery(t, srv, meQuery())
	if !hasGQLErrors(t, resp) {
		t.Fatalf("expected me to require authentication, got %v", resp)
	}
}

func TestMeWithValidAccessToken(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	phone := "+233537144161"
	registerUserHTTP(t, srv, sender, phone)
	login := loginUserHTTP(t, srv, phone, "StrongPass1!")
	access := login["accessToken"].(string)

	resp := gqlQueryAuth(t, srv, meQuery(), access)
	if hasGQLErrors(t, resp) {
		t.Fatalf("expected me to succeed, got %v", resp)
	}
	me := gqlData(t, resp)["me"].(map[string]any)
	if me["phone"] != phone {
		t.Errorf("expected phone %q, got %v", phone, me["phone"])
	}
}

func TestRefreshTokenGrantsNewAccessAndRotates(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	phone := "+233537144161"
	registerUserHTTP(t, srv, sender, phone)
	login := loginUserHTTP(t, srv, phone, "StrongPass1!")
	oldAccess := login["accessToken"].(string)
	oldRefresh := login["refreshToken"].(string)

	res := gqlMutation(t, gqlQuery(t, srv, refreshTokenQuery(oldRefresh)), "refreshToken")
	if res["success"] != true {
		t.Fatalf("expected refresh to succeed, got %+v", res)
	}
	newAccess := res["accessToken"].(string)
	newRefresh := res["refreshToken"].(string)
	if newAccess == "" || newRefresh == "" {
		t.Fatalf("expected a fresh pair of tokens, got %+v", res)
	}
	if newAccess == oldAccess {
		t.Error("expected a new access token, got the same one")
	}
	if newRefresh == oldRefresh {
		t.Error("expected a rotated refresh token, got the same one")
	}

	resp := gqlQueryAuth(t, srv, meQuery(), newAccess)
	if hasGQLErrors(t, resp) {
		t.Fatalf("expected me with the refreshed access token to succeed, got %v", resp)
	}

	stale := gqlMutation(t, gqlQuery(t, srv, refreshTokenQuery(oldRefresh)), "refreshToken")
	if stale["success"] == true {
		t.Fatal("expected the rotated-away refresh token to be rejected")
	}
}

func TestExpiredAccessTokenIsRejected(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	phone := "+233537144161"
	registerUserHTTP(t, srv, sender, phone)
	login := loginUserHTTP(t, srv, phone, "StrongPass1!")
	userID := uuid.MustParse(gqlData(t, gqlQueryAuth(t, srv, meQuery(), login["accessToken"].(string)))["me"].(map[string]any)["id"].(string))

	expired, err := auth.IssueAccessToken(auth.JWTSecret(), userID, uuid.New(), -time.Minute)
	if err != nil {
		t.Fatal(err)
	}

	resp := gqlQueryAuth(t, srv, meQuery(), expired)
	if !hasGQLErrors(t, resp) {
		t.Fatalf("expected an expired access token to be rejected, got %v", resp)
	}
}

func TestRefreshTokenRejectsGarbage(t *testing.T) {
	srv, _, _, cleanup := newTestServer(t)
	defer cleanup()

	res := gqlMutation(t, gqlQuery(t, srv, refreshTokenQuery("not-a-jwt")), "refreshToken")
	if res["success"] == true {
		t.Fatal("expected a garbage refresh token to be rejected")
	}
}

func TestRefreshTokenRejectsWrongSignature(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	phone := "+233537144161"
	registerUserHTTP(t, srv, sender, phone)
	login := loginUserHTTP(t, srv, phone, "StrongPass1!")
	userID := uuid.MustParse(gqlData(t, gqlQueryAuth(t, srv, meQuery(), login["accessToken"].(string)))["me"].(map[string]any)["id"].(string))

	forged, err := auth.IssueRefreshToken("wrong-secret", userID, uuid.New(), auth.RefreshTokenTTL)
	if err != nil {
		t.Fatal(err)
	}
	res := gqlMutation(t, gqlQuery(t, srv, refreshTokenQuery(forged)), "refreshToken")
	if res["success"] == true {
		t.Fatal("expected a refresh token signed with another secret to be rejected")
	}
}

func TestLogoutRevokesRefreshToken(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	phone := "+233537144161"
	registerUserHTTP(t, srv, sender, phone)
	login := loginUserHTTP(t, srv, phone, "StrongPass1!")
	access := login["accessToken"].(string)
	refresh := login["refreshToken"].(string)

	data := gqlData(t, gqlQueryAuth(t, srv, logoutQuery(), access))
	loggedOut, _ := data["logout"].(bool)
	if !loggedOut {
		t.Fatalf("expected logout to succeed, got %v", data["logout"])
	}

	resp := gqlQueryAuth(t, srv, meQuery(), access)
	if !hasGQLErrors(t, resp) {
		t.Fatalf("expected me to fail after logout, got %v", resp)
	}

	refreshRes := gqlMutation(t, gqlQuery(t, srv, refreshTokenQuery(refresh)), "refreshToken")
	if refreshRes["success"] == true {
		t.Fatal("expected logout to revoke the refresh token")
	}
}

func TestPasswordResetFlow(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	phone := "+233537144161"
	registerUserHTTP(t, srv, sender, phone)
	login := loginUserHTTP(t, srv, phone, "StrongPass1!")
	oldAccess := login["accessToken"].(string)
	oldRefresh := login["refreshToken"].(string)

	res := gqlMutation(t, gqlQuery(t, srv, requestPasswordResetQuery(phone)), "requestPasswordReset")
	if res["success"] != true {
		t.Fatalf("requestPasswordReset failed: %v", res)
	}
	code := waitForSMSCode(t, sender)

	res = gqlMutation(t, gqlQuery(t, srv, resetPasswordQuery(phone, code, "NewPass1!", "NewPass1!")), "resetPassword")
	if res["success"] != true {
		t.Fatalf("resetPassword failed: %v", res)
	}

	old := gqlMutation(t, gqlQuery(t, srv, loginQueryFields(phone, "StrongPass1!")), "login")
	if old["success"] == true {
		t.Fatal("expected old password to stop working after reset")
	}

	newLogin := gqlMutation(t, gqlQuery(t, srv, loginQuery(phone, "NewPass1!")), "login")
	if newLogin["success"] != true {
		t.Fatalf("expected new password to work, got %+v", newLogin)
	}

	resp := gqlQueryAuth(t, srv, meQuery(), oldAccess)
	if !hasGQLErrors(t, resp) {
		t.Fatal("expected old access token to be rejected after password reset")
	}

	refreshRes := gqlMutation(t, gqlQuery(t, srv, refreshTokenQuery(oldRefresh)), "refreshToken")
	if refreshRes["success"] == true {
		t.Fatal("expected old refresh token to be rejected after password reset")
	}
}

func TestPasswordResetWeakPassword(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	phone := "+233537144161"
	registerUserHTTP(t, srv, sender, phone)

	res := gqlMutation(t, gqlQuery(t, srv, requestPasswordResetQuery(phone)), "requestPasswordReset")
	if res["success"] != true {
		t.Fatalf("requestPasswordReset failed: %v", res)
	}
	code := waitForSMSCode(t, sender)

	resp := gqlQuery(t, srv, resetPasswordQuery(phone, code, "weak", "weak"))
	if !hasGQLErrors(t, resp) {
		t.Fatalf("expected weak password to be rejected, got %v", resp)
	}
}

func TestRequestPasswordResetUnknownPhone(t *testing.T) {
	srv, _, _, cleanup := newTestServer(t)
	defer cleanup()

	res := gqlMutation(t, gqlQuery(t, srv, requestPasswordResetQuery("+233555000111")), "requestPasswordReset")
	if res["success"] == true {
		t.Fatal("expected reset request to fail for an unknown phone")
	}
}

func TestPersistentSessionAcrossRefreshCycle(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	phone := "+233537144161"
	registerUserHTTP(t, srv, sender, phone)

	result := loginUserHTTP(t, srv, phone, "StrongPass1!")
	refresh := result["refreshToken"].(string)
	var me any

	for i := 0; i < 3; i++ {
		res := gqlMutation(t, gqlQuery(t, srv, refreshTokenQuery(refresh)), "refreshToken")
		if res["success"] != true {
			t.Fatalf("refresh cycle %d failed: %+v", i, res)
		}
		refresh = res["refreshToken"].(string)
		resp := gqlQueryAuth(t, srv, meQuery(), res["accessToken"].(string))
		if hasGQLErrors(t, resp) {
			t.Fatalf("me with refreshed token (cycle %d) failed: %v", i, resp)
		}
		me = gqlData(t, resp)["me"]
	}

	u, _ := me.(map[string]any)
	if u == nil || u["phone"] != phone {
		t.Fatalf("expected user to persist across refresh cycles, got %v", me)
	}
}
