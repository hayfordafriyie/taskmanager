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
	ErrTaskNotFound         = errors.New("task not found")
	ErrNotWorkspaceMember   = errors.New("you are not a member of this workspace")
	ErrAssigneeNotMember    = errors.New("assignee is not a member of this workspace")
	ErrInvalidTaskStatus    = errors.New("invalid task status")
	ErrInvalidTaskPriority  = errors.New("invalid task priority")
)

func mapTaskError(err error) (error, bool) {
	pgErr, ok := err.(*pgconn.PgError)
	if !ok {
		return nil, false
	}
	switch pgErr.Code {
	case "45020":
		return ErrNotWorkspaceMember, true
	case "45021":
		return ErrAssigneeNotMember, true
	case "45022":
		return ErrTaskNotFound, true
	case "45023":
		return ErrInvalidTaskStatus, true
	case "45024":
		return ErrInvalidTaskPriority, true
	}
	return nil, false
}

// scanTaskCore reads the columns returned by the task mutation functions
// (create_task / assign_task / set_task_status). People details are filled by
// the resolver from the team roster.
func scanTaskCore(row pgxRow) (*types.TaskRow, error) {
	var t types.TaskRow
	err := row.Scan(
		&t.ID, &t.TeamID, &t.CreatedBy, &t.AssigneeID,
		&t.Title, &t.Description, &t.Status, &t.Priority,
		&t.DueAt, &t.CompletedAt, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func CreateTask(
	ctx context.Context,
	pool *pgxpool.Pool,
	teamID, createdBy uuid.UUID,
	assignee *uuid.UUID,
	title, description, priority string,
	dueAt *time.Time,
) (*types.TaskRow, error) {
	row := pool.QueryRow(
		ctx,
		`SELECT id, team_id, created_by, assignee_id, title, description, status,
		        priority, due_at, completed_at, created_at, updated_at
		   FROM create_task($1, $2, $3, $4, $5, $6, $7)`,
		teamID, createdBy, assignee, title, description, priority, dueAt,
	)
	t, err := scanTaskCore(row)
	if err != nil {
		if mapped, ok := mapTaskError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return t, nil
}

func AssignTask(
	ctx context.Context,
	pool *pgxpool.Pool,
	taskID, actor uuid.UUID,
	assignee *uuid.UUID,
) (*types.TaskRow, error) {
	row := pool.QueryRow(
		ctx,
		`SELECT id, team_id, created_by, assignee_id, title, description, status,
		        priority, due_at, completed_at, created_at, updated_at
		   FROM assign_task($1, $2, $3)`,
		taskID, actor, assignee,
	)
	t, err := scanTaskCore(row)
	if err != nil {
		if mapped, ok := mapTaskError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return t, nil
}

func SetTaskStatus(
	ctx context.Context,
	pool *pgxpool.Pool,
	taskID, userID uuid.UUID,
	status string,
) (*types.TaskRow, error) {
	row := pool.QueryRow(
		ctx,
		`SELECT id, team_id, created_by, assignee_id, title, description, status,
		        priority, due_at, completed_at, created_at, updated_at
		   FROM set_task_status($1, $2, $3)`,
		taskID, userID, status,
	)
	t, err := scanTaskCore(row)
	if err != nil {
		if mapped, ok := mapTaskError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return t, nil
}

// UpdateTaskDescription edits a task's optional description.
func UpdateTaskDescription(
	ctx context.Context,
	pool *pgxpool.Pool,
	taskID, actor uuid.UUID,
	description string,
) (*types.TaskRow, error) {
	row := pool.QueryRow(
		ctx,
		`SELECT id, team_id, created_by, assignee_id, title, description, status,
		        priority, due_at, completed_at, created_at, updated_at
		   FROM update_task_description($1, $2, $3)`,
		taskID, actor, description,
	)
	t, err := scanTaskCore(row)
	if err != nil {
		if mapped, ok := mapTaskError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return t, nil
}

// UpdateTask patches a task's fields. A nil pointer keeps the current value;
// a nil assignee clears the assignment.
func UpdateTask(
	ctx context.Context,
	pool *pgxpool.Pool,
	taskID, actor uuid.UUID,
	title, description, priority *string,
	assignee *uuid.UUID,
	status *string,
	dueAt *time.Time,
) (*types.TaskRow, error) {
	row := pool.QueryRow(
		ctx,
		`SELECT id, team_id, created_by, assignee_id, title, description, status,
		        priority, due_at, completed_at, created_at, updated_at
		   FROM update_task($1, $2, $3, $4, $5, $6, $7, $8)`,
		taskID, actor, title, description, priority, assignee, status, dueAt,
	)
	t, err := scanTaskCore(row)
	if err != nil {
		if mapped, ok := mapTaskError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return t, nil
}

// TeamTasks returns every task in a workspace with assignee + creator details.
func TeamTasks(
	ctx context.Context,
	pool *pgxpool.Pool,
	teamID, viewer uuid.UUID,
) ([]types.TaskRow, error) {
	rows, err := pool.Query(
		ctx,
		`SELECT task_id, team_id, title, description, status, priority, due_at,
		        completed_at, created_at, updated_at,
		        creator_id, creator_first, creator_surname,
		        assignee_id, assignee_phone, assignee_first, assignee_surname
		   FROM tasks_for_team($1, $2)`,
		teamID, viewer,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []types.TaskRow
	for rows.Next() {
		var t types.TaskRow
		if err := rows.Scan(
			&t.ID, &t.TeamID, &t.Title, &t.Description, &t.Status, &t.Priority,
			&t.DueAt, &t.CompletedAt, &t.CreatedAt, &t.UpdatedAt,
			&t.CreatedBy, &t.CreatorFirst, &t.CreatorSurname,
			&t.AssigneeID, &t.AssigneePhone, &t.AssigneeFirst, &t.AssigneeSurname,
		); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return tasks, nil
}

type pgxRow interface {
	Scan(dest ...any) error
}
