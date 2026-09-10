package graph

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"taskmanager/graph/model"
	"taskmanager/internal/db"
	"taskmanager/types"
)

var statusOrder = []struct {
	Key   string
	Label string
}{
	{"IN_PROGRESS", "In progress"},
	{"REVIEW", "Review"},
	{"TODO", "To do"},
	{"DONE", "Done"},
}

var weekdayLabels = map[time.Weekday]string{
	time.Monday:    "Mon",
	time.Tuesday:   "Tue",
	time.Wednesday: "Wed",
	time.Thursday:  "Thu",
	time.Friday:    "Fri",
	time.Saturday:  "Sat",
	time.Sunday:    "Sun",
}

func isDone(status string) bool { return status == "done" }

// normalizeStatus upper-cases a DB task status (todo/in_progress/...) to the
// enum form used by the API/frontend (TODO/IN_PROGRESS/...).
func normalizeStatus(status string) string {
	return strings.ToUpper(strings.TrimSpace(status))
}

func sameDayUTC(a, b time.Time) bool {
	ay, am, ad := a.UTC().Date()
	by, bm, bd := b.UTC().Date()
	return ay == by && am == bm && ad == bd
}

// Dashboard is the resolver for the dashboard field. One nested query provides
// everything the dashboard renders.
func (r *queryResolver) Dashboard(ctx context.Context) (*model.Dashboard, error) {
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
	weekAgo := now.AddDate(0, 0, -7)

	var (
		doneToday         int32
		inProgress        int32
		overdue           int32
		completedThisWeek int32
		counts            = map[string]int32{}
	)

	for i := range rows {
		t := rows[i]
		status := normalizeStatus(t.Status)
		counts[status]++

		if status == "IN_PROGRESS" {
			inProgress++
		}
		if status != "DONE" && t.DueAt != nil && t.DueAt.Before(now) {
			overdue++
		}
		if t.CompletedAt != nil {
			if sameDayUTC(*t.CompletedAt, now) {
				doneToday++
			}
			if t.CompletedAt.After(weekAgo) {
				completedThisWeek++
			}
		}
	}

	total := int32(len(rows))
	breakdown := make([]*model.DashboardSlice, 0, len(statusOrder))
	for _, s := range statusOrder {
		count := counts[s.Key]
		var percent int32
		if total > 0 {
			percent = int32((int(count)*100 + int(total)/2) / int(total))
		}
		breakdown = append(breakdown, &model.DashboardSlice{
			Key:     s.Key,
			Label:   s.Label,
			Count:   count,
			Percent: percent,
		})
	}

	upcoming := make([]*model.Task, 0, 5)
	openRows := make([]int, 0, len(rows))
	for i := range rows {
		if normalizeStatus(rows[i].Status) != "DONE" {
			openRows = append(openRows, i)
		}
	}
	sort.SliceStable(openRows, func(a, b int) bool {
		ra, rb := rows[openRows[a]], rows[openRows[b]]
		if ra.DueAt == nil && rb.DueAt == nil {
			return ra.CreatedAt.After(rb.CreatedAt)
		}
		if ra.DueAt == nil {
			return false
		}
		if rb.DueAt == nil {
			return true
		}
		return ra.DueAt.Before(*rb.DueAt)
	})
	for _, idx := range openRows {
		if len(upcoming) >= 5 {
			break
		}
		task, err := r.taskModel(&rows[idx], roster)
		if err != nil {
			return nil, err
		}
		upcoming = append(upcoming, task)
	}

	notifications, err := db.UserNotifications(ctx, r.Pool, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load activity: %w", err)
	}
	activity := make([]*model.DashboardActivity, 0, 5)
	for i := range notifications {
		if len(activity) >= 5 {
			break
		}
		n := notifications[i]
		activity = append(activity, &model.DashboardActivity{
			ID:        n.ID,
			Kind:      n.Kind,
			Title:     n.Title,
			Body:      n.Body,
			CreatedAt: n.CreatedAt,
		})
	}

	dueThisWeek := buildDueThisWeek(rows, now)

	return &model.Dashboard{
		Stats: &model.DashboardStats{
			DoneToday:         doneToday,
			InProgress:        inProgress,
			Overdue:           overdue,
			CompletedThisWeek: completedThisWeek,
		},
		CompletedToday:  doneToday,
		UpcomingTasks:   upcoming,
		StatusBreakdown: breakdown,
		Activity:        activity,
		DueThisWeek:     dueThisWeek,
	}, nil
}

// buildDueThisWeek counts open tasks due on each day of the current week.
func buildDueThisWeek(rows []types.TaskRow, now time.Time) []*model.DashboardDay {
	// Monday-based start of the current week.
	offset := (int(now.Weekday()) + 6) % 7
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).AddDate(0, 0, -offset)

	days := make([]*model.DashboardDay, 0, 7)
	for i := 0; i < 7; i++ {
		d := start.AddDate(0, 0, i)
		var count int32
		for j := range rows {
			t := rows[j]
			if normalizeStatus(t.Status) == "DONE" || t.DueAt == nil {
				continue
			}
			if sameDayUTC(*t.DueAt, d) {
				count++
			}
		}
		days = append(days, &model.DashboardDay{
			Day:   weekdayLabels[d.Weekday()],
			Label: d.Format("Jan 2"),
			Count: count,
		})
	}
	return days
}
