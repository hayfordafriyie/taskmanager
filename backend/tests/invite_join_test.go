package tests

import (
	"strings"
	"testing"
)

// Regression: an invited person used to sign up into their own brand-new
// "Personal Workspace" as its admin, while the invitation stayed pending — so
// they never appeared in the team that invited them and every workspace had the
// same name. Signup must now claim the pending invitation instead.
func TestSignupClaimsPendingInviteAndJoinsInvitingTeam(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	const ownerPhone = "+233550000701"
	const inviteePhone = "+233550000702"

	ownerToken := registerAndLogin(t, srv, sender, ownerPhone)
	ownerTeam := myTeamData(t, srv, ownerToken)
	ownerTeamID, _ := ownerTeam["id"].(string)
	if ownerTeamID == "" {
		t.Fatalf("owner has no workspace: %v", ownerTeam)
	}

	// The owner invites a phone number that has no account yet.
	res := gqlMutation(t, gqlQueryAuth(t, srv, inviteQuery(inviteePhone, "MEMBER"), ownerToken), "inviteToTeam")
	if res["success"] != true {
		t.Fatalf("invite failed: %+v", res)
	}
	if res["inviteeRegistered"] != false {
		t.Errorf("expected inviteeRegistered=false for an unknown phone, got %v", res["inviteeRegistered"])
	}

	// The invitee signs up with the invited number.
	inviteeToken := registerAndLogin(t, srv, sender, inviteePhone)

	// 1. They land in the inviting workspace, not a private one.
	team := myTeamData(t, srv, inviteeToken)
	if teamID, _ := team["id"].(string); teamID != ownerTeamID {
		t.Fatalf("invitee's active workspace is not the inviting team: got %q want %q", teamID, ownerTeamID)
	}

	// 2. With the role they were invited as (member — not admin).
	if role, _ := team["role"].(string); !strings.EqualFold(role, "MEMBER") {
		t.Errorf("expected the invited role MEMBER, got %q", role)
	}

	// 3. The invitation is consumed rather than left pending.
	invites, _ := gqlData(t, gqlQueryAuth(t, srv, myInvitesQuery(), inviteeToken))["myInvites"].([]any)
	if len(invites) != 0 {
		t.Errorf("expected no pending invitations for the invitee, got %v", invites)
	}

	// 4. The owner sees them as a member of the team.
	members, _ := myTeamData(t, srv, ownerToken)["members"].([]any)
	found := false
	for _, m := range members {
		member, ok := m.(map[string]any)
		if !ok {
			continue
		}
		if member["phone"] == inviteePhone && strings.EqualFold(asString(member["role"]), "MEMBER") {
			found = true
		}
	}
	if !found {
		t.Errorf("invitee is not listed as a MEMBER of the inviting team: %v", members)
	}
}

func asString(v any) string {
	s, _ := v.(string)
	return s
}
