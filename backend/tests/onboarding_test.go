package tests

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestSignupCreatesPersonalTeam(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	token := registerAndLogin(t, srv, sender, "+233537144161")

	res := gqlData(t, gqlQueryAuth(t, srv, myTeamQuery(), token))["myTeam"].(map[string]any)
	if res["name"] != "Personal Workspace" {
		t.Fatalf("expected personal workspace, got %v", res["name"])
	}
	if res["role"] != "ADMIN" {
		t.Fatalf("expected owner role ADMIN, got %v", res["role"])
	}
	members := res["members"].([]any)
	if len(members) != 1 {
		t.Fatalf("expected exactly one member, got %d", len(members))
	}
	member := members[0].(map[string]any)
	if member["phone"] != "+233537144161" {
		t.Errorf("expected owner as member, got %v", member)
	}
	if member["role"] != "ADMIN" {
		t.Errorf("expected member role ADMIN, got %v", member["role"])
	}
}

func insertLegacyUser(t *testing.T, pool *pgxpool.Pool, phone string) {
	t.Helper()
	_, err := pool.Exec(context.Background(),
		"INSERT INTO users (phone, first_name, surname, password_hash) VALUES ($1, $2, $3, $4)",
		phone, "Legacy", "User", "legacy-hash")
	if err != nil {
		t.Fatalf("insert legacy user: %v", err)
	}
}

func teamCounts(t *testing.T, pool *pgxpool.Pool, phone string) (teams, members int64) {
	t.Helper()
	err := pool.QueryRow(context.Background(),
		`SELECT
		   (SELECT count(*) FROM teams t WHERE t.owner_id = u.id),
		   (SELECT count(*) FROM team_members tm WHERE tm.user_id = u.id)
		 FROM users u WHERE u.phone = $1`, phone).Scan(&teams, &members)
	if err != nil {
		t.Fatalf("count teams/memberships: %v", err)
	}
	return
}

func TestBackfillCreatesTeamsForExistingUsers(t *testing.T) {
	_, pool, _, cleanup := newTestServer(t)
	defer cleanup()

	insertLegacyUser(t, pool, "+233537144161")

	var backfilled int64
	if err := pool.QueryRow(context.Background(), "SELECT backfill_personal_teams()").Scan(&backfilled); err != nil {
		t.Fatalf("run backfill: %v", err)
	}
	if backfilled != 1 {
		t.Errorf("expected 1 membership backfilled, got %d", backfilled)
	}

	teams, members := teamCounts(t, pool, "+233537144161")
	if teams != 1 || members != 1 {
		t.Fatalf("expected 1 team and 1 membership, got teams=%d members=%d", teams, members)
	}
}

func TestBackfillIsIdempotent(t *testing.T) {
	_, pool, _, cleanup := newTestServer(t)
	defer cleanup()

	insertLegacyUser(t, pool, "+233537144161")

	if err := pool.QueryRow(context.Background(), "SELECT backfill_personal_teams()").Scan(new(int64)); err != nil {
		t.Fatalf("first backfill: %v", err)
	}

	var again int64
	if err := pool.QueryRow(context.Background(), "SELECT backfill_personal_teams()").Scan(&again); err != nil {
		t.Fatalf("second backfill: %v", err)
	}
	if again != 0 {
		t.Errorf("expected 0 new memberships on rerun, got %d", again)
	}

	teams, members := teamCounts(t, pool, "+233537144161")
	if teams != 1 || members != 1 {
		t.Fatalf("rerun must not duplicate teams/memberships, got teams=%d members=%d", teams, members)
	}
}

func TestBackfillSkipsSignedUpUsers(t *testing.T) {
	srv, pool, sender, cleanup := newTestServer(t)
	defer cleanup()

	registerAndLogin(t, srv, sender, "+233537144161")

	var backfilled int64
	if err := pool.QueryRow(context.Background(), "SELECT backfill_personal_teams()").Scan(&backfilled); err != nil {
		t.Fatalf("run backfill: %v", err)
	}
	if backfilled != 0 {
		t.Errorf("signup already provisions the team, expected 0 backfilled, got %d", backfilled)
	}

	teams, members := teamCounts(t, pool, "+233537144161")
	if teams != 1 || members != 1 {
		t.Fatalf("expected exactly one team/membership, got teams=%d members=%d", teams, members)
	}
}