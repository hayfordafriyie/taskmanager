package graph

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"taskmanager/graph/model"
	"taskmanager/internal/db"

	"github.com/google/uuid"
)

// Reports is the resolver for the reports field. It aggregates the team's
// tasks into completion/status/workload analytics for the reports view.
func (r *queryResolver) Reports(ctx context.Context) (*model.Reports, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}

	rows, err := db.TeamTasks(ctx, r.Pool, teamID, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load tasks: %w", err)
	}
	roster, err := r.rosterOf(ctx, teamID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	total := len(rows)

	var (
		completedTasks int32
		overdueTasks   int32
		counts         = map[string]int32{}
		completedOn    = map[string]int32{}
		openByUser     = map[uuid.UUID]int32{}
		doneByUser     = map[uuid.UUID]int32{}
	)

	for i := range rows {
		t := rows[i]
		status := normalizeStatus(t.Status)
		counts[status]++

		if status != "DONE" && t.DueAt != nil && t.DueAt.Before(now) {
			overdueTasks++
		}
		if t.CompletedAt != nil {
			completedTasks++
			completedOn[t.CompletedAt.Local().Format("Mon")]++
		}
		if t.AssigneeID != nil {
			if status == "DONE" {
				doneByUser[*t.AssigneeID]++
			} else {
				openByUser[*t.AssigneeID]++
			}
		}
	}

	// Completion for the last seven days, oldest first.
	perDay := make([]*model.ReportPoint, 0, 7)
	for i := 6; i >= 0; i-- {
		d := now.AddDate(0, 0, -i)
		perDay = append(perDay, &model.ReportPoint{
			Label: d.Format("Mon"),
			Value: completedOn[d.Format("Mon")],
		})
	}

	byStatus := make([]*model.ReportSlice, 0, len(statusOrder))
	for _, s := range statusOrder {
		count := counts[s.Key]
		var percent int32
		if total > 0 {
			percent = int32((int(count)*100 + int(total)/2) / int(total))
		}
		byStatus = append(byStatus, &model.ReportSlice{
			Key:     s.Key,
			Label:   s.Label,
			Count:   count,
			Percent: percent,
		})
	}

	// Per-person workload across the roster.
	workload := make([]*model.ReportWorkload, 0, len(roster))
	for id, m := range roster {
		open := openByUser[id]
		done := doneByUser[id]
		assigned := open + done
		var percent int32
		if assigned > 0 {
			percent = int32((int(done)*100 + int(assigned)/2) / int(assigned))
		}
		name := strings.TrimSpace(m.FirstName + " " + m.Surname)
		workload = append(workload, &model.ReportWorkload{
			UserID:   id,
			Name:     name,
			Initials: reportInitials(m.FirstName, m.Surname),
			Open:     open,
			Done:     done,
			Total:    assigned,
			Percent:  percent,
		})
	}
	sort.SliceStable(workload, func(a, b int) bool {
		return workload[a].Total > workload[b].Total
	})

	var completionRate int32
	if total > 0 {
		completionRate = int32((int(completedTasks)*100 + int(total)/2) / int(total))
	}

	return &model.Reports{
		CompletedPerDay: perDay,
		ByStatus:        byStatus,
		Workload:        workload,
		TotalTasks:      int32(total),
		CompletedTasks:  completedTasks,
		OverdueTasks:    overdueTasks,
		CompletionRate:  completionRate,
	}, nil
}

func reportInitials(first, surname string) string {
	f, s := strings.TrimSpace(first), strings.TrimSpace(surname)
	switch {
	case f == "" && s == "":
		return "?"
	case f == "":
		return strings.ToUpper(s[:1])
	case s == "":
		return strings.ToUpper(f[:1])
	default:
		return strings.ToUpper(f[:1] + s[:1])
	}
}