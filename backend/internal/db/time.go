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
	ErrInvalidMinutes   = errors.New("minutes must be greater than zero")
	ErrTimeTaskMismatch = errors.New("task does not belong to this workspace")
)

func mapTimeError(err error) (error, bool) {
	pgErr, ok := err.(*pgconn.PgError)
	if !ok {
		return nil, false
	}
	switch pgErr.Code {
	case "45020":
		return ErrNotWorkspaceMember, true
	case "45060":
		return ErrInvalidMinutes, true
	case "45062":
		return ErrTimeTaskMismatch, true
	}
	return nil, false
}

func dateParam(t *time.Time) any {
	if t == nil {
		return nil
	}
	return t.Format("2006-01-02")
}

// LogTime records minutes for a member, optionally against a task.
func LogTime(
	ctx context.Context,
	pool *pgxpool.Pool,
	teamID, userID uuid.UUID,
	taskID *uuid.UUID,
	label string,
	minutes int,
	spentOn *time.Time,
	note string,
) (*types.TimeEntryRow, error) {
	var e types.TimeEntryRow
	err := pool.QueryRow(
		ctx,
		`SELECT id, team_id, user_id, task_id, label, minutes, spent_on, note, created_at
		   FROM log_time($1, $2, $3, $4, $5, $6, $7)`,
		teamID, userID, taskID, label, minutes, dateParam(spentOn), note,
	).Scan(&e.ID, &e.TeamID, &e.UserID, &e.TaskID, &e.Label, &e.Minutes, &e.SpentOn, &e.Note, &e.CreatedAt)
	if err != nil {
		if mapped, ok := mapTimeError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return &e, nil
}

// TimeEntries lists a member's entries in a date window with task titles.
func TimeEntries(
	ctx context.Context,
	pool *pgxpool.Pool,
	teamID, userID uuid.UUID,
	from, to time.Time,
) ([]types.TimeEntryRow, error) {
	rows, err := pool.Query(
		ctx,
		`SELECT entry_id, label, task_id, task_title, minutes, spent_on, note, created_at
		   FROM time_entries_for_range($1, $2, $3, $4)`,
		teamID, userID, dateParam(&from), dateParam(&to),
	)
	if err != nil {
		if mapped, ok := mapTimeError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	defer rows.Close()

	var out []types.TimeEntryRow
	for rows.Next() {
		var e types.TimeEntryRow
		e.TeamID = teamID
		e.UserID = userID
		if err := rows.Scan(
			&e.ID, &e.Label, &e.TaskID, &e.TaskTitle, &e.Minutes, &e.SpentOn, &e.Note, &e.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// TimeSummary computes totals for a window (hours, daily average, top label).
func TimeSummary(
	ctx context.Context,
	pool *pgxpool.Pool,
	teamID, userID uuid.UUID,
	from, to time.Time,
) (*types.TimeSummaryRow, error) {
	var s types.TimeSummaryRow
	err := pool.QueryRow(
		ctx,
		`SELECT total_minutes, entry_count, active_days, top_label, top_minutes
		   FROM time_summary($1, $2, $3, $4)`,
		teamID, userID, dateParam(&from), dateParam(&to),
	).Scan(&s.TotalMinutes, &s.EntryCount, &s.ActiveDays, &s.TopLabel, &s.TopMinutes)
	if err != nil {
		if mapped, ok := mapTimeError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return &s, nil
}

func DeleteTimeEntry(ctx context.Context, pool *pgxpool.Pool, entryID, userID uuid.UUID) (bool, error) {
	var ok bool
	err := pool.QueryRow(ctx, "SELECT delete_time_entry($1, $2)", entryID, userID).Scan(&ok)
	return ok, err
}
