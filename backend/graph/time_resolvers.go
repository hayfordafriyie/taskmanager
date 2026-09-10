package graph

import (
	"context"
	"fmt"
	"time"

	"taskmanager/graph/model"
	"taskmanager/internal/db"
	"taskmanager/types"

	"github.com/google/uuid"
)

func toModelTimeEntry(e *types.TimeEntryRow) *model.TimeEntry {
	return &model.TimeEntry{
		ID:        e.ID,
		UserID:    e.UserID,
		TaskID:    e.TaskID,
		TaskTitle: e.TaskTitle,
		Label:     e.Label,
		Minutes:   int32(e.Minutes),
		SpentOn:   e.SpentOn,
		Note:      e.Note,
		CreatedAt: e.CreatedAt,
	}
}

// TimeEntries is the resolver for the timeEntries field.
func (r *queryResolver) TimeEntries(ctx context.Context, from time.Time, to time.Time) ([]*model.TimeEntry, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}

	key := fmt.Sprintf("time:%s:%s:%s", user.ID, from.Format("2006-01-02"), to.Format("2006-01-02"))
	var cached []*model.TimeEntry
	if r.cacheGetJSON(ctx, key, &cached) {
		return cached, nil
	}

	rows, err := db.TimeEntries(ctx, r.Pool, teamID, user.ID, from, to)
	if err != nil {
		return nil, fmt.Errorf("load time entries: %w", err)
	}
	out := make([]*model.TimeEntry, 0, len(rows))
	for i := range rows {
		out = append(out, toModelTimeEntry(&rows[i]))
	}
	r.cacheSetJSON(ctx, key, out)
	return out, nil
}

// TimeSummary is the resolver for the timeSummary field.
func (r *queryResolver) TimeSummary(ctx context.Context, from time.Time, to time.Time) (*model.TimeSummary, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}

	key := fmt.Sprintf("timeSummary:%s:%s:%s", user.ID, from.Format("2006-01-02"), to.Format("2006-01-02"))
	var cached model.TimeSummary
	if r.cacheGetJSON(ctx, key, &cached) {
		return &cached, nil
	}

	s, err := db.TimeSummary(ctx, r.Pool, teamID, user.ID, from, to)
	if err != nil {
		return nil, fmt.Errorf("load time summary: %w", err)
	}
	out := &model.TimeSummary{
		TotalMinutes: int32(s.TotalMinutes),
		EntryCount:   int32(s.EntryCount),
		ActiveDays:   int32(s.ActiveDays),
		TopLabel:     s.TopLabel,
		TopMinutes:   int32(s.TopMinutes),
	}
	r.cacheSetJSON(ctx, key, out)
	return out, nil
}

// LogTime is the resolver for the logTime field.
func (r *mutationResolver) LogTime(ctx context.Context, input model.LogTimeInput) (*model.TimeResult, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	if input.Minutes <= 0 {
		return &model.TimeResult{Success: false, Message: "minutes must be greater than zero"}, nil
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}

	label := ""
	if input.Label != nil {
		label = *input.Label
	}
	note := ""
	if input.Note != nil {
		note = *input.Note
	}

	entry, err := db.LogTime(ctx, r.Pool, teamID, user.ID, input.TaskID, label, int(input.Minutes), input.SpentOn, note)
	if err != nil {
		switch err {
		case db.ErrNotWorkspaceMember, db.ErrInvalidMinutes, db.ErrTimeTaskMismatch:
			return &model.TimeResult{Success: false, Message: err.Error()}, nil
		default:
			return nil, fmt.Errorf("log time: %w", err)
		}
	}
	return &model.TimeResult{Success: true, Message: "time logged", Entry: toModelTimeEntry(entry)}, nil
}

// DeleteTimeEntry is the resolver for the deleteTimeEntry field.
func (r *mutationResolver) DeleteTimeEntry(ctx context.Context, entryID uuid.UUID) (bool, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return false, err
	}
	ok, err := db.DeleteTimeEntry(ctx, r.Pool, entryID, user.ID)
	if err != nil {
		return false, fmt.Errorf("delete time entry: %w", err)
	}
	return ok, nil
}
