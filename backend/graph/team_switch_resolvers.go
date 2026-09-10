package graph

import (
	"context"
	"fmt"

	"taskmanager/graph/model"
	"taskmanager/internal/db"

	"github.com/google/uuid"
)

// MyTeams is the resolver for the myTeams field. It lists every workspace the
// signed-in user belongs to so the client can offer a switcher.
func (r *queryResolver) MyTeams(ctx context.Context) ([]*model.TeamSummary, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}

	rows, err := db.TeamsForUser(ctx, r.Pool, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load teams: %w", err)
	}

	teams := make([]*model.TeamSummary, 0, len(rows))
	for i := range rows {
		role, err := toModelRole(rows[i].Role)
		if err != nil {
			return nil, err
		}
		teams = append(teams, &model.TeamSummary{
			ID:          rows[i].ID,
			Name:        rows[i].Name,
			Role:        role,
			IsOwner:     rows[i].IsOwner,
			IsActive:    rows[i].IsActive,
			MemberCount: rows[i].MemberCount,
		})
	}
	return teams, nil
}

// SwitchTeam is the resolver for the switchTeam field. It moves the user into
// one of their workspaces; every workspace-scoped query then resolves to that
// team, so data never mixes between them.
func (r *mutationResolver) SwitchTeam(ctx context.Context, teamID uuid.UUID) (*model.SwitchTeamResult, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}

	team, err := db.SwitchActiveTeam(ctx, r.Pool, user.ID, teamID)
	if err != nil {
		if err == db.ErrNotTeamMember {
			return &model.SwitchTeamResult{
				Success: false,
				Message: "you are not a member of this workspace",
			}, nil
		}
		return nil, fmt.Errorf("switch team: %w", err)
	}

	full, err := r.buildTeam(ctx, team.ID, user.ID)
	if err != nil {
		return nil, err
	}

	return &model.SwitchTeamResult{
		Success: true,
		Message: "Now working in " + team.Name,
		Team:    full,
	}, nil
}
