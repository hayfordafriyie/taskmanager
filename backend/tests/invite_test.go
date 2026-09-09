package tests

import (
	"fmt"
	"net/http/httptest"
	"testing"
	"time"
)

func registerAndLogin(t *testing.T, srv *httptest.Server, sender *fakeSMSSender, phone string) string {
	t.Helper()
	registerUserHTTP(t, srv, sender, phone)
	login := loginUserHTTP(t, srv, phone, "StrongPass1!")
	token, _ := login["accessToken"].(string)
	if token == "" {
		t.Fatalf("login returned no access token: %v", login)
	}
	return token
}

func inviteQuery(phone, role string) string {
	return fmt.Sprintf(`mutation { inviteToTeam(phone: %q, role: %s) { success message inviteeRegistered alreadyMember invite { id teamName phone role } } }`, phone, role)
}

func myTeamQuery() string {
	return `query { myTeam { id name role members { phone firstName role } invites { id phone role status } } }`
}

func myInvitesQuery() string {
	return `query { myInvites { id teamName phone role invitedBy { firstName } } }`
}

func acceptQuery(id string) string {
	return fmt.Sprintf(`mutation { acceptInvite(inviteId: %q) { success message team { id name role members { phone role } invites { id phone role } } } }`, id)
}

func revokeQuery(id string) string {
	return fmt.Sprintf(`mutation { revokeInvite(inviteId: %q) }`, id)
}

func inviteID(t *testing.T, res map[string]any) string {
	t.Helper()
	invite, ok := gqlMutation(t, res, "inviteToTeam")["invite"].(map[string]any)
	if !ok {
		t.Fatalf("expected invite in response: %v", res)
	}
	id, _ := invite["id"].(string)
	if id == "" {
		t.Fatalf("expected non-empty invite id: %v", invite)
	}
	return id
}

func teamPhones(t *testing.T, team map[string]any) map[string]string {
	t.Helper()
	members, ok := team["members"].([]any)
	if !ok {
		t.Fatalf("expected members array: %v", team)
	}
	phones := make(map[string]string, len(members))
	for _, m := range members {
		row, ok := m.(map[string]any)
		if !ok {
			continue
		}
		phone, _ := row["phone"].(string)
		role, _ := row["role"].(string)
		phones[phone] = role
	}
	return phones
}

func myTeamData(t *testing.T, srv *httptest.Server, token string) map[string]any {
	t.Helper()
	team, ok := gqlData(t, gqlQueryAuth(t, srv, myTeamQuery(), token))["myTeam"].(map[string]any)
	if !ok {
		t.Fatalf("expected myTeam map")
	}
	return team
}

func pendingInviteCount(t *testing.T, team map[string]any) int {
	t.Helper()
	invites, ok := team["invites"].([]any)
	if !ok {
		t.Fatalf("expected invites array: %v", team)
	}
	return len(invites)
}

func TestInviteToTeamCreatesPendingInvite(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	ownerToken := registerAndLogin(t, srv, sender, "+233537144161")
	registerUserHTTP(t, srv, sender, "+233541230000")

	before := sender.sentCount()
	res := gqlMutation(t, gqlQueryAuth(t, srv, inviteQuery("+233541230000", "MEMBER"), ownerToken), "inviteToTeam")
	if res["success"] != true {
		t.Fatalf("expected successful invite, got %+v", res)
	}
	if res["inviteeRegistered"] != true {
		t.Errorf("expected inviteeRegistered true for a registered phone")
	}
	waitUntil(t, 5*time.Second, func() bool {
		return sender.sentCount() > before
	})

	team := myTeamData(t, srv, ownerToken)
	if team["name"] != "Personal Workspace" {
		t.Errorf("unexpected team name: %v", team["name"])
	}
	if role := team["role"]; role != "ADMIN" {
		t.Errorf("expected owner admin role, got %v", role)
	}
	if n := pendingInviteCount(t, team); n != 1 {
		t.Errorf("expected one pending invite, got %d", n)
	}
}

func TestInviteAcceptFlow(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	ownerToken := registerAndLogin(t, srv, sender, "+233537144161")
	id := inviteID(t, gqlQueryAuth(t, srv, inviteQuery("+233541230000", "MEMBER"), ownerToken))

	inviteeToken := registerAndLogin(t, srv, sender, "+233541230000")

	invites := gqlData(t, gqlQueryAuth(t, srv, myInvitesQuery(), inviteeToken))["myInvites"].([]any)
	if len(invites) != 1 {
		t.Fatalf("expected one invite for invitee, got %v", invites)
	}

	accepted := gqlMutation(t, gqlQueryAuth(t, srv, acceptQuery(id), inviteeToken), "acceptInvite")
	if accepted["success"] != true {
		t.Fatalf("expected accept to succeed, got %+v", accepted)
	}
	team, ok := accepted["team"].(map[string]any)
	if !ok {
		t.Fatalf("expected team in accept response: %v", accepted)
	}
	phones := teamPhones(t, team)
	if phones["+233541230000"] != "MEMBER" {
		t.Errorf("expected invitee member role, got %v", phones["+233541230000"])
	}
	if phones["+233537144161"] != "ADMIN" {
		t.Errorf("expected owner admin role, got %v", phones["+233537144161"])
	}

	if invites := gqlData(t, gqlQueryAuth(t, srv, myInvitesQuery(), inviteeToken))["myInvites"].([]any); len(invites) != 0 {
		t.Errorf("expected invites to clear after accept, got %v", invites)
	}

	ownerTeam := myTeamData(t, srv, ownerToken)
	if phones := teamPhones(t, ownerTeam); len(phones) != 2 {
		t.Errorf("expected owner team to have 2 members, got %v", phones)
	}

	again := gqlMutation(t, gqlQueryAuth(t, srv, inviteQuery("+233541230000", "MEMBER"), ownerToken), "inviteToTeam")
	if again["success"] == true || again["alreadyMember"] != true {
		t.Errorf("expected re-invite of a member to fail with alreadyMember, got %+v", again)
	}
}

func TestInviteToUnregisteredUser(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	ownerToken := registerAndLogin(t, srv, sender, "+233537144161")
	before := sender.sentCount()

	res := gqlMutation(t, gqlQueryAuth(t, srv, inviteQuery("+233551234567", "GUEST"), ownerToken), "inviteToTeam")
	if res["success"] != true {
		t.Fatalf("expected invite of unregistered user to succeed, got %+v", res)
	}
	if res["inviteeRegistered"] == true {
		t.Errorf("expected inviteeRegistered false for unregistered phone")
	}
	waitUntil(t, 5*time.Second, func() bool {
		return sender.sentCount() > before
	})
	id := res["invite"].(map[string]any)["id"].(string)

	inviteeToken := registerAndLogin(t, srv, sender, "+233551234567")
	invites := gqlData(t, gqlQueryAuth(t, srv, myInvitesQuery(), inviteeToken))["myInvites"].([]any)
	if len(invites) != 1 {
		t.Fatalf("expected invite visible after registration, got %v", invites)
	}

	accepted := gqlMutation(t, gqlQueryAuth(t, srv, acceptQuery(id), inviteeToken), "acceptInvite")
	if accepted["success"] != true {
		t.Fatalf("expected unregistered invitee to accept after registering, got %+v", accepted)
	}
	if name := accepted["team"].(map[string]any)["name"]; name == "" {
		t.Fatal("expected team name in accept result")
	}
}

func TestInviteSelfAndDuplicatePending(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	ownerToken := registerAndLogin(t, srv, sender, "+233537144161")

	self := gqlMutation(t, gqlQueryAuth(t, srv, inviteQuery("+233537144161", "ADMIN"), ownerToken), "inviteToTeam")
	if self["success"] == true {
		t.Fatalf("expected self invite to fail, got %+v", self)
	}

	registerUserHTTP(t, srv, sender, "+233541230000")
	first := gqlMutation(t, gqlQueryAuth(t, srv, inviteQuery("+233541230000", "MEMBER"), ownerToken), "inviteToTeam")
	if first["success"] != true {
		t.Fatalf("expected first invite to succeed, got %+v", first)
	}

	second := gqlMutation(t, gqlQueryAuth(t, srv, inviteQuery("+233541230000", "GUEST"), ownerToken), "inviteToTeam")
	if second["success"] == true {
		t.Fatalf("expected duplicate pending invite to fail, got %+v", second)
	}
	if msg, _ := second["message"].(string); msg == "" {
		t.Errorf("expected a helpful message for duplicate invite, got %+v", second)
	}
}

func TestInviteRevoke(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	ownerToken := registerAndLogin(t, srv, sender, "+233537144161")
	id := inviteID(t, gqlQueryAuth(t, srv, inviteQuery("+233541230000", "MEMBER"), ownerToken))

	revoked, ok := gqlData(t, gqlQueryAuth(t, srv, revokeQuery(id), ownerToken))["revokeInvite"].(bool)
	if !ok || !revoked {
		t.Fatalf("expected revoke to return true, got ok=%v value=%v", ok, revoked)
	}

	team := myTeamData(t, srv, ownerToken)
	if n := pendingInviteCount(t, team); n != 0 {
		t.Errorf("expected no pending invites after revoke, got %d", n)
	}

	inviteeToken := registerAndLogin(t, srv, sender, "+233541230000")
	accepted := gqlMutation(t, gqlQueryAuth(t, srv, acceptQuery(id), inviteeToken), "acceptInvite")
	if accepted["success"] == true {
		t.Fatalf("expected accept of revoked invite to fail, got %+v", accepted)
	}
}

func TestInviteRequiresAuth(t *testing.T) {
	srv, _, _, cleanup := newTestServer(t)
	defer cleanup()

	resp := gqlQuery(t, srv, inviteQuery("+233541230000", "MEMBER"))
	if !hasGQLErrors(t, resp) {
		t.Fatalf("expected auth error for invite without token, got %v", resp)
	}
	resp = gqlQuery(t, srv, myTeamQuery())
	if !hasGQLErrors(t, resp) {
		t.Fatalf("expected auth error for myTeam without token, got %v", resp)
	}
	resp = gqlQuery(t, srv, myInvitesQuery())
	if !hasGQLErrors(t, resp) {
		t.Fatalf("expected auth error for myInvites without token, got %v", resp)
	}
}

func TestInviteInvalidPhone(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	ownerToken := registerAndLogin(t, srv, sender, "+233537144161")
	resp := gqlQueryAuth(t, srv, inviteQuery("+15551234567", "MEMBER"), ownerToken)
	if !hasGQLErrors(t, resp) {
		t.Fatalf("expected invalid phone error, got %v", resp)
	}
}

func TestInviteWrongPersonCannotAccept(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	ownerToken := registerAndLogin(t, srv, sender, "+233537144161")
	id := inviteID(t, gqlQueryAuth(t, srv, inviteQuery("+233541230000", "MEMBER"), ownerToken))

	otherToken := registerAndLogin(t, srv, sender, "+233549876543")

	invites := gqlData(t, gqlQueryAuth(t, srv, myInvitesQuery(), otherToken))["myInvites"].([]any)
	if len(invites) != 0 {
		t.Fatalf("expected no invites for unrelated user, got %v", invites)
	}

	accepted := gqlMutation(t, gqlQueryAuth(t, srv, acceptQuery(id), otherToken), "acceptInvite")
	if accepted["success"] == true {
		t.Fatalf("expected wrong invitee to be rejected, got %+v", accepted)
	}
}