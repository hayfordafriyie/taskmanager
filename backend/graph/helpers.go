package graph

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"

	"taskmanager/graph/model"
	"taskmanager/internal/auth"
	"taskmanager/internal/db"
	"taskmanager/types"

	"github.com/google/uuid"
)

var errNotAuthenticated = errors.New("not authenticated")

var errTooManyRequests = errors.New("too many attempts, please try again later")

var errInvalidRole = errors.New("unsupported member role")

const (
	otpPurposeRegister      = "register"
	otpPurposePasswordReset = "password_reset"
	loginAccessAlert        = "Your Task Manager account was accessed via a new login. If this was not you, reset your password immediately."
	inviteSMSMessage        = "You have been invited to join Task Manager. Log in and accept your invitation from the Invite page."
)

func int32Ptr(v int32) *int32 {
	return &v
}

func toModelUser(u *types.UserRow) *model.User {
	if u == nil {
		return nil
	}
	return &model.User{
		ID:         u.ID,
		Phone:      u.Phone,
		FirstName:  u.FirstName,
		Surname:    u.Surname,
		OtherNames: u.OtherNames,
		CreatedAt:  u.CreatedAt,
	}
}

func toModelRole(role string) (model.Role, error) {
	switch strings.ToUpper(role) {
	case "ADMIN", "MEMBER", "GUEST":
		return model.Role(strings.ToUpper(role)), nil
	default:
		return "", errInvalidRole
	}
}

func toDBRole(role model.Role) string {
	return strings.ToLower(string(role))
}

func toModelInvite(i *types.InviteRow, inviter *types.UserRow) (*model.Invite, error) {
	role, err := toModelRole(i.Role)
	if err != nil {
		return nil, err
	}
	return &model.Invite{
		ID:        i.ID,
		TeamName:  i.TeamName,
		Phone:     i.Phone,
		Role:      role,
		Status:    i.Status,
		InvitedBy: toModelUser(inviter),
		ExpiresAt: i.ExpiresAt,
		CreatedAt: i.CreatedAt,
	}, nil
}

func (r *Resolver) currentUser(ctx context.Context) (*types.UserRow, error) {
	req := auth.Request(ctx)
	if req == nil {
		return nil, errNotAuthenticated
	}
	claims, err := auth.ParseToken(auth.JWTSecret(), auth.BearerToken(req))
	if err != nil || !auth.IsAccess(claims) {
		return nil, errNotAuthenticated
	}
	userID, err := claims.UserID()
	if err != nil {
		return nil, errNotAuthenticated
	}
	sessionID, err := claims.SessionID()
	if err != nil {
		return nil, errNotAuthenticated
	}
	user, err := db.SessionUser(ctx, r.Pool, sessionID)
	if err != nil {
		if errors.Is(err, db.ErrInvalidSession) {
			return nil, errNotAuthenticated
		}
		return nil, fmt.Errorf("load session: %w", err)
	}
	if user.ID != userID {
		return nil, errNotAuthenticated
	}
	return user, nil
}

func (r *Resolver) buildTeam(ctx context.Context, teamID, viewerID uuid.UUID) (*model.Team, error) {
	viewerRole, err := db.MemberRole(ctx, r.Pool, teamID, viewerID)
	if err != nil {
		return nil, err
	}
	team, err := db.TeamByID(ctx, r.Pool, teamID)
	if err != nil {
		return nil, err
	}

	memberRows, err := db.TeamMembers(ctx, r.Pool, teamID)
	if err != nil {
		return nil, err
	}
	members := make([]*model.TeamMember, 0, len(memberRows))
	for _, m := range memberRows {
		role, err := toModelRole(m.Role)
		if err != nil {
			return nil, err
		}
		members = append(members, &model.TeamMember{
			ID:        m.ID,
			Phone:     m.Phone,
			FirstName: m.FirstName,
			Surname:   m.Surname,
			Role:      role,
			CreatedAt: m.CreatedAt,
		})
	}

	inviteRows, err := db.TeamInvites(ctx, r.Pool, teamID)
	if err != nil {
		return nil, err
	}
	invites := make([]*model.Invite, 0, len(inviteRows))
	for _, i := range inviteRows {
		i.TeamName = team.Name
		inviter := &types.UserRow{
			ID:        i.InvitedBy,
			FirstName: i.InvitedByFirstName,
			Surname:   i.InvitedBySurname,
		}
		invite, err := toModelInvite(&i, inviter)
		if err != nil {
			return nil, err
		}
		invites = append(invites, invite)
	}

	role, err := toModelRole(viewerRole)
	if err != nil {
		return nil, err
	}
	return &model.Team{
		ID:      team.ID,
		Name:    team.Name,
		Role:    role,
		Members: members,
		Invites: invites,
	}, nil
}

func otpFailureMessage(reason string) string {
	switch reason {
	case "no_active_otp":
		return "no active verification code; please request a new one"
	case "expired":
		return "verification code has expired; please request a new one"
	case "too_many_attempts":
		return "too many attempts; please request a new code"
	default:
		return "invalid verification code"
	}
}

func (r *Resolver) guardAuth(ctx context.Context, phone string) error {
	request := auth.Request(ctx)
	if request != nil {
		if ip := clientIP(request); ip != "" && !r.bruteIP.Allow("ip:"+ip) {
			return errTooManyRequests
		}
	}
	if phone != "" && !r.brutePhone.Allow("phone:"+phone) {
		return errTooManyRequests
	}
	return nil
}

func (r *Resolver) clearAuth(phone string) {
	r.brutePhone.Reset("phone:" + phone)
}

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		first, _, _ := strings.Cut(fwd, ",")
		if ip := strings.TrimSpace(first); ip != "" {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
