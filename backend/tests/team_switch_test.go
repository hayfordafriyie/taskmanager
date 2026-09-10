package tests

import (
	"fmt"
	"testing"
)

func myTeamsQuery() string {
	return `query { myTeams { id name role isOwner isActive memberCount } }`
}

func switchTeamQuery(teamID string) string {
	return fmt.Sprintf(`mutation { switchTeam(teamId: %q) { success message team { id name } } }`, teamID)
}

func teamTasksQuery() string {
	return `query { teamTasks { id title status } }`
}

func createSimpleTaskQuery(title string) string {
	return fmt.Sprintf(`mutation { createTask(input: { title: %q }) { success message task { id title } } }`, title)
}

// Regression: a user owns a workspace *and* can belong to someone else's, and
// switching between them must never leak data across workspaces.
func TestSwitchBetweenOwnAndJoinedTeamKeepsDataSeparate(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	const ownerPhone = "+233550000801"
	const inviteePhone = "+233550000802"

	ownerToken := registerAndLogin(t, srv, sender, ownerPhone)
	inviteeToken := registerAndLogin(t, srv, sender, inviteePhone)

	ownerTeamID, _ := myTeamData(t, srv, ownerToken)["id"].(string)
	inviteeOwnTeamID, _ := myTeamData(t, srv, inviteeToken)["id"].(string)
	if ownerTeamID == "" || inviteeOwnTeamID == "" || ownerTeamID == inviteeOwnTeamID {
		t.Fatalf("expected two distinct workspaces: owner=%q invitee=%q", ownerTeamID, inviteeOwnTeamID)
	}

	// The owner invites the (already registered) invitee, who accepts: now the
	// invitee has their own workspace AND belongs to the owner's team.
	inviteRes := gqlMutation(t, gqlQueryAuth(t, srv, inviteQuery(inviteePhone, "MEMBER"), ownerToken), "inviteToTeam")
	if inviteRes["success"] != true {
		t.Fatalf("invite failed: %+v", inviteRes)
	}
	inviteID, _ := inviteRes["invite"].(map[string]any)["id"].(string)
	accepted := gqlMutation(t, gqlQueryAuth(t, srv, acceptQuery(inviteID), inviteeToken), "acceptInvite")
	if accepted["success"] != true {
		t.Fatalf("accept failed: %+v", accepted)
	}

	// Two workspaces, the joined one active.
	teams := gqlData(t, gqlQueryAuth(t, srv, myTeamsQuery(), inviteeToken))["myTeams"].([]any)
	if len(teams) != 2 {
		t.Fatalf("expected the invitee to belong to 2 workspaces, got %v", teams)
	}
	activeID, ownedID, joinedRole := "", "", ""
	for _, raw := range teams {
		ws := raw.(map[string]any)
		id, _ := ws["id"].(string)
		if ws["isActive"] == true {
			activeID = id
			joinedRole, _ = ws["role"].(string)
		}
		if ws["isOwner"] == true {
			ownedID = id
		}
	}
	if activeID != ownerTeamID {
		t.Errorf("expected the joined team to be active, got %q want %q", activeID, ownerTeamID)
	}
	if ownedID != inviteeOwnTeamID {
		t.Errorf("expected the invitee to still own their own workspace, got %q want %q", ownedID, inviteeOwnTeamID)
	}
	if joinedRole != "MEMBER" {
		t.Errorf("expected role MEMBER in the joined team, got %q", joinedRole)
	}

	// A task created while inside the joined team stays there.
	created := gqlMutation(t, gqlQueryAuth(t, srv, createSimpleTaskQuery("Joined-team task"), inviteeToken), "createTask")
	if created["success"] != true {
		t.Fatalf("createTask in the joined team failed: %+v", created)
	}
	if n := len(gqlData(t, gqlQueryAuth(t, srv, teamTasksQuery(), inviteeToken))["teamTasks"].([]any)); n != 1 {
		t.Fatalf("expected 1 task in the joined team, got %d", n)
	}

	// Switch to their own workspace: different team, no task leak.
	switched := gqlMutation(t, gqlQueryAuth(t, srv, switchTeamQuery(inviteeOwnTeamID), inviteeToken), "switchTeam")
	if switched["success"] != true {
		t.Fatalf("switch to own workspace failed: %+v", switched)
	}
	own := myTeamData(t, srv, inviteeToken)
	if got, _ := own["id"].(string); got != inviteeOwnTeamID {
		t.Errorf("myTeam after switch = %q, want %q", got, inviteeOwnTeamID)
	}
	if role, _ := own["role"].(string); role != "ADMIN" {
		t.Errorf("expected ADMIN in their own workspace, got %q", role)
	}
	if n := len(gqlData(t, gqlQueryAuth(t, srv, teamTasksQuery(), inviteeToken))["teamTasks"].([]any)); n != 0 {
		t.Errorf("tasks leaked into the private workspace: %d visible", n)
	}

	// Switch back: the joined team's task returns and the owner still sees them.
	back := gqlMutation(t, gqlQueryAuth(t, srv, switchTeamQuery(ownerTeamID), inviteeToken), "switchTeam")
	if back["success"] != true {
		t.Fatalf("switch back failed: %+v", back)
	}
	if n := len(gqlData(t, gqlQueryAuth(t, srv, teamTasksQuery(), inviteeToken))["teamTasks"].([]any)); n != 1 {
		t.Errorf("expected the joined team's task to be visible again, got %d", n)
	}

	// A non-member workspace cannot be switched into.
	outsiderToken := registerAndLogin(t, srv, sender, "+233550000803")
	denied := gqlMutation(t, gqlQueryAuth(t, srv, switchTeamQuery(ownerTeamID), outsiderToken), "switchTeam")
	if denied["success"] == true {
		t.Errorf("expected switching into a workspace you do not belong to to fail")
	}
}
