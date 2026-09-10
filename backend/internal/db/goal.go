package db

import (
	"context"
	"errors"
	"time"

	"taskmanager/types"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrGoalNotFound      = errors.New("goal not found")
	ErrKeyResultNotFound = errors.New("key result not found")
	ErrInvalidGoalStatus = errors.New("invalid goal status")
)

func mapGoalError(err error) (error, bool) {
	pgErr, ok := err.(*pgconn.PgError)
	if !ok {
		return nil, false
	}
	switch pgErr.Code {
	case "45020":
		return ErrNotWorkspaceMember, true
	case "45052":
		return ErrGoalNotFound, true
	case "45053":
		return ErrInvalidGoalStatus, true
	case "45054":
		return ErrKeyResultNotFound, true
	}
	return nil, false
}

func scanGoalCore(row pgxRow) (*types.GoalRow, error) {
	var g types.GoalRow
	err := row.Scan(
		&g.ID, &g.TeamID, &g.CreatedBy, &g.OwnerID, &g.Title, &g.Description,
		&g.Status, &g.DueAt, &g.CreatedAt, &g.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &g, nil
}

func CreateGoal(
	ctx context.Context,
	pool *pgxpool.Pool,
	teamID, createdBy, ownerID uuid.UUID,
	title, description, status string,
	dueAt *time.Time,
) (*types.GoalRow, error) {
	row := pool.QueryRow(
		ctx,
		`SELECT id, team_id, created_by, owner_id, title, description, status,
		        due_at, created_at, updated_at
		   FROM create_goal($1, $2, $3, $4, $5, $6, $7)`,
		teamID, createdBy, ownerID, title, description, status, dueAt,
	)
	g, err := scanGoalCore(row)
	if err != nil {
		if mapped, ok := mapGoalError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return g, nil
}

// TeamGoals returns the workspace's goals with owner details, computed progress
// and key-result counts.
func TeamGoals(ctx context.Context, pool *pgxpool.Pool, teamID, viewer uuid.UUID) ([]types.GoalRow, error) {
	rows, err := pool.Query(
		ctx,
		`SELECT goal_id, team_id, title, description, status, due_at,
		        created_at, updated_at,
		        owner_id, owner_first, owner_surname, owner_phone,
		        progress, kr_count
		   FROM goals_for_team($1, $2)`,
		teamID, viewer,
	)
	if err != nil {
		if mapped, ok := mapGoalError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	defer rows.Close()

	var out []types.GoalRow
	for rows.Next() {
		var g types.GoalRow
		if err := rows.Scan(
			&g.ID, &g.TeamID, &g.Title, &g.Description, &g.Status, &g.DueAt,
			&g.CreatedAt, &g.UpdatedAt,
			&g.OwnerID, &g.OwnerFirst, &g.OwnerSurname, &g.OwnerPhone,
			&g.Progress, &g.KeyResults,
		); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func GoalKeyResults(ctx context.Context, pool *pgxpool.Pool, goalID, viewer uuid.UUID) ([]types.KeyResultRow, error) {
	rows, err := pool.Query(
		ctx,
		"SELECT kr_id, title, progress, created_at FROM goal_key_results($1, $2)",
		goalID, viewer,
	)
	if err != nil {
		if mapped, ok := mapGoalError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	defer rows.Close()

	var out []types.KeyResultRow
	for rows.Next() {
		var kr types.KeyResultRow
		kr.GoalID = goalID
		if err := rows.Scan(&kr.ID, &kr.Title, &kr.Progress, &kr.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, kr)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func CreateKeyResult(ctx context.Context, pool *pgxpool.Pool, goalID, userID uuid.UUID, title string) (*types.KeyResultRow, error) {
	var kr types.KeyResultRow
	err := pool.QueryRow(
		ctx,
		"SELECT id, goal_id, title, progress, created_at FROM create_key_result($1, $2, $3)",
		goalID, userID, title,
	).Scan(&kr.ID, &kr.GoalID, &kr.Title, &kr.Progress, &kr.CreatedAt)
	if err != nil {
		if mapped, ok := mapGoalError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return &kr, nil
}

func SetKeyResultProgress(ctx context.Context, pool *pgxpool.Pool, keyResultID, userID uuid.UUID, progress int) (*types.KeyResultRow, error) {
	var kr types.KeyResultRow
	err := pool.QueryRow(
		ctx,
		"SELECT id, goal_id, title, progress, created_at FROM set_key_result_progress($1, $2, $3)",
		keyResultID, userID, progress,
	).Scan(&kr.ID, &kr.GoalID, &kr.Title, &kr.Progress, &kr.CreatedAt)
	if err != nil {
		if mapped, ok := mapGoalError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return &kr, nil
}

func UpdateGoalStatus(ctx context.Context, pool *pgxpool.Pool, goalID, userID uuid.UUID, status string) (*types.GoalRow, error) {
	row := pool.QueryRow(
		ctx,
		`SELECT id, team_id, created_by, owner_id, title, description, status,
		        due_at, created_at, updated_at
		   FROM update_goal_status($1, $2, $3)`,
		goalID, userID, status,
	)
	g, err := scanGoalCore(row)
	if err != nil {
		if mapped, ok := mapGoalError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return g, nil
}

func DeleteGoal(ctx context.Context, pool *pgxpool.Pool, goalID, userID uuid.UUID) (bool, error) {
	var ok bool
	err := pool.QueryRow(ctx, "SELECT delete_goal($1, $2)", goalID, userID).Scan(&ok)
	if err != nil {
		if mapped, ok := mapGoalError(err); ok {
			return false, mapped
		}
		return false, err
	}
	return ok, nil
}
