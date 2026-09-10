package graph

import (
	"context"
	"fmt"
	"strings"

	"taskmanager/graph/model"
	"taskmanager/internal/db"
	"taskmanager/types"

	"github.com/google/uuid"
)

func goalStatusFromDB(status string) model.GoalStatus {
	return model.GoalStatus(strings.ToUpper(strings.TrimSpace(status)))
}

func goalStatusToDB(status model.GoalStatus) string {
	return strings.ToLower(string(status))
}

func toModelKeyResult(kr *types.KeyResultRow) *model.KeyResult {
	return &model.KeyResult{
		ID:        kr.ID,
		Title:     kr.Title,
		Progress:  int32(kr.Progress),
		CreatedAt: kr.CreatedAt,
	}
}

// goalWithKeyResults builds the GraphQL goal, loading its key results. Progress
// comes from the DB (average of key results).
func (r *Resolver) goalWithKeyResults(ctx context.Context, g *types.GoalRow, viewerID uuid.UUID) (*model.Goal, error) {
	goal := &model.Goal{
		ID:          g.ID,
		TeamID:      g.TeamID,
		Title:       g.Title,
		Description: g.Description,
		Status:      goalStatusFromDB(g.Status),
		DueAt:       g.DueAt,
		CreatedAt:   g.CreatedAt,
		UpdatedAt:   g.UpdatedAt,
		Owner: toModelUser(&types.UserRow{
			ID: g.OwnerID, Phone: g.OwnerPhone, FirstName: g.OwnerFirst, Surname: g.OwnerSurname,
		}),
		Progress: int32(g.Progress),
	}

	rows, err := db.GoalKeyResults(ctx, r.Pool, g.ID, viewerID)
	if err != nil {
		return nil, err
	}
	keyResults := make([]*model.KeyResult, 0, len(rows))
	for i := range rows {
		keyResults = append(keyResults, toModelKeyResult(&rows[i]))
	}
	goal.KeyResults = keyResults
	return goal, nil
}

// findGoal re-reads one goal from the workspace board (so mutations can return
// the fully-populated goal including progress).
func (r *Resolver) findGoal(ctx context.Context, teamID, viewerID, goalID uuid.UUID) (*types.GoalRow, error) {
	goals, err := db.TeamGoals(ctx, r.Pool, teamID, viewerID)
	if err != nil {
		return nil, err
	}
	for i := range goals {
		if goals[i].ID == goalID {
			return &goals[i], nil
		}
	}
	return nil, db.ErrGoalNotFound
}

func (r *Resolver) goalFail(message string) *model.GoalResult {
	return &model.GoalResult{Success: false, Message: message}
}

// TeamGoals is the resolver for the teamGoals field.
func (r *queryResolver) TeamGoals(ctx context.Context) ([]*model.Goal, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}
	rows, err := db.TeamGoals(ctx, r.Pool, teamID, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load goals: %w", err)
	}
	out := make([]*model.Goal, 0, len(rows))
	for i := range rows {
		goal, err := r.goalWithKeyResults(ctx, &rows[i], user.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, goal)
	}
	return out, nil
}

// CreateGoal is the resolver for the createGoal field.
func (r *mutationResolver) CreateGoal(ctx context.Context, input model.CreateGoalInput) (*model.GoalResult, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(input.Title) == "" {
		return r.goalFail("goal title is required"), nil
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}

	description := ""
	if input.Description != nil {
		description = *input.Description
	}
	status := "on_track"
	if input.Status != nil {
		status = goalStatusToDB(*input.Status)
	}
	ownerID := user.ID
	if input.OwnerID != nil {
		ownerID = *input.OwnerID
	}

	created, err := db.CreateGoal(ctx, r.Pool, teamID, user.ID, ownerID, input.Title, description, status, input.DueAt)
	if err != nil {
		switch err {
		case db.ErrNotWorkspaceMember, db.ErrInvalidGoalStatus:
			return r.goalFail(err.Error()), nil
		default:
			return nil, fmt.Errorf("create goal: %w", err)
		}
	}
	goal, err := r.goalWithKeyResults(ctx, created, user.ID)
	if err != nil {
		return nil, err
	}
	return &model.GoalResult{Success: true, Message: "goal created", Goal: goal}, nil
}

// UpdateGoalStatus is the resolver for the updateGoalStatus field.
func (r *mutationResolver) UpdateGoalStatus(ctx context.Context, goalID uuid.UUID, status model.GoalStatus) (*model.GoalResult, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	updated, err := db.UpdateGoalStatus(ctx, r.Pool, goalID, user.ID, goalStatusToDB(status))
	if err != nil {
		switch err {
		case db.ErrGoalNotFound, db.ErrNotWorkspaceMember, db.ErrInvalidGoalStatus:
			return r.goalFail(err.Error()), nil
		default:
			return nil, fmt.Errorf("update goal status: %w", err)
		}
	}
	goal, err := r.reloadGoal(ctx, updated, user.ID)
	if err != nil {
		return nil, err
	}
	return &model.GoalResult{Success: true, Message: "goal updated", Goal: goal}, nil
}

// CreateKeyResult is the resolver for the createKeyResult field.
func (r *mutationResolver) CreateKeyResult(ctx context.Context, goalID uuid.UUID, title string) (*model.GoalResult, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(title) == "" {
		return r.goalFail("key result title is required"), nil
	}
	if _, err := db.CreateKeyResult(ctx, r.Pool, goalID, user.ID, title); err != nil {
		switch err {
		case db.ErrGoalNotFound, db.ErrNotWorkspaceMember:
			return r.goalFail(err.Error()), nil
		default:
			return nil, fmt.Errorf("create key result: %w", err)
		}
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}
	full, err := r.findGoal(ctx, teamID, user.ID, goalID)
	if err != nil {
		return nil, err
	}
	goal, err := r.goalWithKeyResults(ctx, full, user.ID)
	if err != nil {
		return nil, err
	}
	return &model.GoalResult{Success: true, Message: "key result added", Goal: goal}, nil
}

// SetKeyResultProgress is the resolver for the setKeyResultProgress field.
func (r *mutationResolver) SetKeyResultProgress(ctx context.Context, keyResultID uuid.UUID, progress int32) (*model.GoalResult, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	kr, err := db.SetKeyResultProgress(ctx, r.Pool, keyResultID, user.ID, int(progress))
	if err != nil {
		switch err {
		case db.ErrKeyResultNotFound, db.ErrGoalNotFound, db.ErrNotWorkspaceMember:
			return r.goalFail(err.Error()), nil
		default:
			return nil, fmt.Errorf("update key result: %w", err)
		}
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}
	full, err := r.findGoal(ctx, teamID, user.ID, kr.GoalID)
	if err != nil {
		return nil, err
	}
	goal, err := r.goalWithKeyResults(ctx, full, user.ID)
	if err != nil {
		return nil, err
	}
	return &model.GoalResult{Success: true, Message: "progress saved", Goal: goal}, nil
}

// DeleteGoal is the resolver for the deleteGoal field.
func (r *mutationResolver) DeleteGoal(ctx context.Context, goalID uuid.UUID) (bool, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return false, err
	}
	deleted, err := db.DeleteGoal(ctx, r.Pool, goalID, user.ID)
	if err != nil {
		if err == db.ErrGoalNotFound || err == db.ErrNotWorkspaceMember {
			return false, nil
		}
		return false, fmt.Errorf("delete goal: %w", err)
	}
	return deleted, nil
}

// reloadGoal re-reads a goal row from the workspace board.
func (r *Resolver) reloadGoal(ctx context.Context, g *types.GoalRow, viewerID uuid.UUID) (*model.Goal, error) {
	teamID := g.TeamID
	full, err := r.findGoal(ctx, teamID, viewerID, g.ID)
	if err != nil {
		// fall back to the row we already have
		return r.goalWithKeyResults(ctx, g, viewerID)
	}
	return r.goalWithKeyResults(ctx, full, viewerID)
}
