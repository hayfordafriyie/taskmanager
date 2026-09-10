package db

import (
	"context"
	"errors"
	"time"

	"taskmanager/types"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultTeamName = "Personal Workspace"
	InviteTTL       = 7 * 24 * time.Hour
)

var (
	ErrSelfInvite        = errors.New("you cannot invite yourself")
	ErrAlreadyMember     = errors.New("person is already a member of this team")
	ErrAlreadyInvited    = errors.New("this person has already been invited")
	ErrNoPendingInvite   = errors.New("there is no pending invite to accept")
	ErrInviteExpired     = errors.New("this invite has expired")
	ErrInviteNotForYou   = errors.New("this invite is not for you")
	ErrInviteInvalid     = errors.New("invalid invite")
	ErrNotTeamMember     = errors.New("you are not a member of a team")
	ErrMemberRoleUnknown = errors.New("member role is unknown")
	ErrTeamNotFound      = errors.New("team not found")
)

func EnsurePersonalTeam(ctx context.Context, pool *pgxpool.Pool, ownerID uuid.UUID) (*types.TeamRow, error) {
	var t types.TeamRow
	err := pool.QueryRow(
		ctx, "SELECT id, name, created_at FROM ensure_personal_team($1)", ownerID,
	).Scan(&t.ID, &t.Name, &t.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func TeamByID(ctx context.Context, pool *pgxpool.Pool, teamID uuid.UUID) (*types.TeamRow, error) {
	var t types.TeamRow
	err := pool.QueryRow(
		ctx, "SELECT id, name, created_at FROM get_team($1)", teamID,
	).Scan(&t.ID, &t.Name, &t.CreatedAt)
	if err != nil {
		if pgErr, ok := mapInviteError(err); ok {
			return nil, pgErr
		}
		return nil, err
	}
	return &t, nil
}

func MemberRole(ctx context.Context, pool *pgxpool.Pool, teamID, userID uuid.UUID) (string, error) {
	var role *string
	if err := pool.QueryRow(
		ctx, "SELECT member_role($1, $2)", teamID, userID,
	).Scan(&role); err != nil {
		return "", err
	}
	if role == nil {
		return "", ErrNotTeamMember
	}
	return *role, nil
}

func InviteMember(
	ctx context.Context,
	pool *pgxpool.Pool,
	teamID uuid.UUID,
	phone, role string,
	invitedBy uuid.UUID,
) (*types.InviteRow, error) {
	var i types.InviteRow
	err := pool.QueryRow(
		ctx,
		`SELECT id, phone, role, status, expires_at, created_at
		   FROM invite_member($1, $2, $3, $4, $5)`,
		teamID, phone, role, invitedBy, time.Now().Add(InviteTTL),
	).Scan(&i.ID, &i.Phone, &i.Role, &i.Status, &i.ExpiresAt, &i.CreatedAt)
	if err != nil {
		if pgErr, ok := mapInviteError(err); ok {
			return nil, pgErr
		}
		return nil, err
	}
	i.TeamID = teamID
	return &i, nil
}

func AcceptInvite(
	ctx context.Context,
	pool *pgxpool.Pool,
	inviteID, userID uuid.UUID,
) (*types.TeamRow, string, error) {
	var t types.TeamRow
	var role string
	err := pool.QueryRow(
		ctx, "SELECT team_id, team_name, role FROM accept_invite($1, $2)", inviteID, userID,
	).Scan(&t.ID, &t.Name, &role)
	if err != nil {
		if pgErr, ok := mapInviteError(err); ok {
			return nil, "", pgErr
		}
		return nil, "", err
	}
	return &t, role, nil
}

func RevokeInvite(ctx context.Context, pool *pgxpool.Pool, inviteID, inviterID uuid.UUID) (bool, error) {
	var revoked bool
	if err := pool.QueryRow(
		ctx, "SELECT revoke_invite($1, $2)", inviteID, inviterID,
	).Scan(&revoked); err != nil {
		return false, err
	}
	return revoked, nil
}

func TeamMembers(ctx context.Context, pool *pgxpool.Pool, teamID uuid.UUID) ([]types.TeamMemberRow, error) {
	rows, err := pool.Query(ctx, "SELECT user_id, phone, first_name, surname, role, joined_at FROM team_members_with_roles($1)", teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []types.TeamMemberRow
	for rows.Next() {
		var m types.TeamMemberRow
		if err := rows.Scan(&m.ID, &m.Phone, &m.FirstName, &m.Surname, &m.Role, &m.CreatedAt); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return members, nil
}

func TeamInvites(ctx context.Context, pool *pgxpool.Pool, teamID uuid.UUID) ([]types.InviteRow, error) {
	rows, err := pool.Query(ctx, "SELECT invite_id, phone, role, invited_by, inviter_first_name, inviter_surname, expires_at, created_at, status FROM team_invites($1)", teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invites []types.InviteRow
	for rows.Next() {
		var i types.InviteRow
		if err := rows.Scan(&i.ID, &i.Phone, &i.Role, &i.InvitedBy, &i.InvitedByFirstName, &i.InvitedBySurname, &i.ExpiresAt, &i.CreatedAt, &i.Status); err != nil {
			return nil, err
		}
		invites = append(invites, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return invites, nil
}

func PendingInvitesForPhone(ctx context.Context, pool *pgxpool.Pool, phone string) ([]types.InviteRow, error) {
	rows, err := pool.Query(ctx, "SELECT invite_id, team_id, team_name, role, invited_by, inviter_first_name, inviter_surname, expires_at, created_at FROM pending_invites_for_phone($1)", phone)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invites []types.InviteRow
	for rows.Next() {
		var i types.InviteRow
		if err := rows.Scan(&i.ID, &i.TeamID, &i.TeamName, &i.Role, &i.InvitedBy, &i.InvitedByFirstName, &i.InvitedBySurname, &i.ExpiresAt, &i.CreatedAt); err != nil {
			return nil, err
		}
		invites = append(invites, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return invites, nil
}

func mapInviteError(err error) (error, bool) {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrInviteInvalid, true
	}
	pgErr, ok := err.(*pgconn.PgError)
	if !ok {
		return nil, false
	}
	switch pgErr.Code {
	case "45011":
		return ErrAlreadyMember, true
	case "45012":
		return ErrAlreadyInvited, true
	case "45013":
		return ErrSelfInvite, true
	case "45014":
		return ErrNoPendingInvite, true
	case "45015":
		return ErrInviteExpired, true
	case "45016":
		return ErrInviteNotForYou, true
	case "45017":
		return ErrAlreadyMember, true
	case "45018":
		return ErrTeamNotFound, true
	}
	return nil, false
}

// TeamsForUser lists every workspace the user belongs to (owned or joined),
// flagging which one is active so the UI can offer a switcher.
func TeamsForUser(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) ([]types.TeamSummaryRow, error) {
	rows, err := pool.Query(ctx,
		`SELECT out_team_id, out_name, out_role, out_is_owner, out_is_active, out_members, out_created_at
		   FROM teams_for_user($1)`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]types.TeamSummaryRow, 0, 4)
	for rows.Next() {
		var r types.TeamSummaryRow
		if err := rows.Scan(&r.ID, &r.Name, &r.Role, &r.IsOwner, &r.IsActive, &r.MemberCount, &r.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, rows.Err()
}

// SwitchActiveTeam makes one of the user's workspaces the active one. Only
// memberships are accepted, so a user can never switch into a team they do not
// belong to.
func SwitchActiveTeam(ctx context.Context, pool *pgxpool.Pool, userID, teamID uuid.UUID) (*types.TeamRow, error) {
	var team types.TeamRow
	err := pool.QueryRow(ctx,
		`SELECT id, name, created_at FROM switch_active_team($1, $2)`,
		userID, teamID,
	).Scan(&team.ID, &team.Name, &team.CreatedAt)
	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "45026" {
			return nil, ErrNotTeamMember
		}
		return nil, err
	}
	return &team, nil
}
