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

// rosterOf returns the team's members keyed by user id, used to render task
// creator/assignee details and to resolve SMS recipient phone numbers.
func (r *Resolver) rosterOf(ctx context.Context, teamID uuid.UUID) (map[uuid.UUID]types.TeamMemberRow, error) {
	members, err := db.TeamMembers(ctx, r.Pool, teamID)
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]types.TeamMemberRow, len(members))
	for _, m := range members {
		out[m.ID] = m
	}
	return out, nil
}

func toModelTaskStatus(status string) (model.TaskStatus, error) {
	s := model.TaskStatus(strings.ToUpper(status))
	if !s.IsValid() {
		return "", fmt.Errorf("unsupported task status %q", status)
	}
	return s, nil
}

func toModelPriority(priority string) (model.Priority, error) {
	p := model.Priority(strings.ToUpper(priority))
	if !p.IsValid() {
		return "", fmt.Errorf("unsupported task priority %q", priority)
	}
	return p, nil
}

func taskStatusLabel(status string) string {
	switch strings.ToLower(status) {
	case "in_progress":
		return "in progress"
	case "done":
		return "done"
	case "review":
		return "review"
	default:
		return "to do"
	}
}

func (r *Resolver) taskModel(t *types.TaskRow, roster map[uuid.UUID]types.TeamMemberRow) (*model.Task, error) {
	st, err := toModelTaskStatus(t.Status)
	if err != nil {
		return nil, err
	}
	pr, err := toModelPriority(t.Priority)
	if err != nil {
		return nil, err
	}
	task := &model.Task{
		ID:          t.ID,
		TeamID:      t.TeamID,
		Title:       t.Title,
		Description: t.Description,
		Status:      st,
		Priority:    pr,
		DueAt:       t.DueAt,
		CompletedAt: t.CompletedAt,
		CreatedAt:   t.CreatedAt,
		UpdatedAt:   t.UpdatedAt,
	}

	if c, ok := roster[t.CreatedBy]; ok {
		task.CreatedBy = toModelUser(&types.UserRow{
			ID: c.ID, Phone: c.Phone, FirstName: c.FirstName, Surname: c.Surname,
		})
	} else {
		task.CreatedBy = &model.User{ID: t.CreatedBy}
	}

	if t.AssigneeID != nil {
		if a, ok := roster[*t.AssigneeID]; ok {
			task.Assignee = toModelUser(&types.UserRow{
				ID: a.ID, Phone: a.Phone, FirstName: a.FirstName, Surname: a.Surname,
			})
		} else {
			task.Assignee = &model.User{ID: *t.AssigneeID}
		}
	}
	return task, nil
}

func (r *Resolver) taskFail(message string) *model.TaskResult {
	return &model.TaskResult{Success: false, Message: message}
}

// myTeamID resolves the personal workspace for a user.
func (r *Resolver) myTeamID(ctx context.Context, userID uuid.UUID) (uuid.UUID, error) {
	team, err := db.EnsurePersonalTeam(ctx, r.Pool, userID)
	if err != nil {
		return uuid.Nil, err
	}
	return team.ID, nil
}

// sendTaskSMS fans a message out to unique, non-empty phone numbers.
func (r *Resolver) sendTaskSMS(phones []string, message string) {
	seen := map[string]bool{}
	for _, p := range phones {
		p = strings.TrimSpace(p)
		if p == "" || seen[p] {
			continue
		}
		seen[p] = true
	}
	if len(seen) == 0 {
		return
	}
	list := make([]string, 0, len(seen))
	for p := range seen {
		list = append(list, p)
	}
	r.SMSQueue.Enqueue(types.SMSPayload{PhoneNumbers: list, Message: message}, "")
}

func personName(m types.TeamMemberRow) string {
	name := strings.TrimSpace(m.FirstName + " " + m.Surname)
	if name == "" {
		return "A teammate"
	}
	return name
}

// TeamTasks is the resolver for the teamTasks field.
func (r *queryResolver) TeamTasks(ctx context.Context) ([]*model.Task, error) {
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
	tasks := make([]*model.Task, 0, len(rows))
	for i := range rows {
		t, err := r.taskModel(&rows[i], roster)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

// CreateTask is the resolver for the createTask field.
func (r *mutationResolver) CreateTask(ctx context.Context, input model.CreateTaskInput) (*model.TaskResult, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(input.Title) == "" {
		return r.taskFail("task title is required"), nil
	}
	description := ""
	if input.Description != nil {
		description = *input.Description
	}
	priority := "medium"
	if input.Priority != nil {
		priority = strings.ToLower(string(*input.Priority))
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}

	created, err := db.CreateTask(ctx, r.Pool, teamID, user.ID, input.AssigneeID, input.Title, description, priority, input.DueAt)
	if err != nil {
		switch err {
		case db.ErrAssigneeNotMember, db.ErrNotWorkspaceMember:
			return r.taskFail(err.Error()), nil
		default:
			return nil, fmt.Errorf("create task: %w", err)
		}
	}

	roster, err := r.rosterOf(ctx, teamID)
	if err != nil {
		return nil, err
	}
	task, err := r.taskModel(created, roster)
	if err != nil {
		return nil, err
	}

	if created.AssigneeID != nil && *created.AssigneeID != user.ID {
		assignee, ok := roster[*created.AssigneeID]
		if ok {
			r.notifyTaskUser(ctx, *created.AssigneeID, "task_assigned",
				"You were assigned a task",
				fmt.Sprintf("%s assigned you “%s”.", personName(roster[user.ID]), created.Title),
				&created.ID)
			msg := fmt.Sprintf(
				"%s assigned you “%s”. Log in to Task Manager to view and update it.",
				personName(roster[user.ID]), created.Title,
			)
			r.sendTaskSMS([]string{assignee.Phone}, msg)
		}
	}
	return &model.TaskResult{Success: true, Message: "task created", Task: task}, nil
}

// AssignTask is the resolver for the assignTask field.
func (r *mutationResolver) AssignTask(ctx context.Context, taskID uuid.UUID, assigneeID *uuid.UUID) (*model.TaskResult, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}

	updated, err := db.AssignTask(ctx, r.Pool, taskID, user.ID, assigneeID)
	if err != nil {
		switch err {
		case db.ErrTaskNotFound, db.ErrAssigneeNotMember, db.ErrNotWorkspaceMember:
			return r.taskFail(err.Error()), nil
		default:
			return nil, fmt.Errorf("assign task: %w", err)
		}
	}

	roster, err := r.rosterOf(ctx, teamID)
	if err != nil {
		return nil, err
	}
	task, err := r.taskModel(updated, roster)
	if err != nil {
		return nil, err
	}

	if updated.AssigneeID != nil && *updated.AssigneeID != user.ID {
		assignee, ok := roster[*updated.AssigneeID]
		if ok {
			r.notifyTaskUser(ctx, *updated.AssigneeID, "task_assigned",
				"You were assigned a task",
				fmt.Sprintf("%s assigned you “%s”.", personName(roster[user.ID]), updated.Title),
				&updated.ID)
			msg := fmt.Sprintf(
				"%s assigned you “%s”. Log in to Task Manager to view and update it.",
				personName(roster[user.ID]), updated.Title,
			)
			r.sendTaskSMS([]string{assignee.Phone}, msg)
		}
	}
	return &model.TaskResult{Success: true, Message: "task assigned", Task: task}, nil
}

// SetTaskStatus is the resolver for the setTaskStatus field.
func (r *mutationResolver) SetTaskStatus(ctx context.Context, taskID uuid.UUID, status model.TaskStatus) (*model.TaskResult, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}

	updated, err := db.SetTaskStatus(ctx, r.Pool, taskID, user.ID, strings.ToLower(string(status)))
	if err != nil {
		switch err {
		case db.ErrTaskNotFound, db.ErrNotWorkspaceMember, db.ErrInvalidTaskStatus:
			return r.taskFail(err.Error()), nil
		default:
			return nil, fmt.Errorf("update task status: %w", err)
		}
	}

	roster, err := r.rosterOf(ctx, teamID)
	if err != nil {
		return nil, err
	}
	task, err := r.taskModel(updated, roster)
	if err != nil {
		return nil, err
	}

	// Notify the assignee and the creator/assigner so everyone involved knows.
	var recipients []string
	if updated.AssigneeID != nil {
		if assignee, ok := roster[*updated.AssigneeID]; ok {
			recipients = append(recipients, assignee.Phone)
		}
	}
	if creator, ok := roster[updated.CreatedBy]; ok {
		recipients = append(recipients, creator.Phone)
	}
	actor := personName(roster[user.ID])
	msg := fmt.Sprintf(
		"%s moved “%s” to %s in Task Manager.", actor, updated.Title, taskStatusLabel(updated.Status),
	)
	r.sendTaskSMS(recipients, msg)
	r.notifyTaskUser(ctx, updated.CreatedBy, "task_status", "Task status changed", msg, &updated.ID)
	if updated.AssigneeID != nil {
		r.notifyTaskUser(ctx, *updated.AssigneeID, "task_status", "Task status changed", msg, &updated.ID)
	}
	return &model.TaskResult{Success: true, Message: "task updated", Task: task}, nil
}

// notifyTaskUser creates an in-app notification; failures are non-fatal.
func (r *Resolver) notifyTaskUser(ctx context.Context, userID uuid.UUID, kind, title, body string, taskID *uuid.UUID) {
	if _, err := db.CreateNotification(ctx, r.Pool, userID, kind, title, body, taskID); err != nil {
		_ = err // in-app delivery is best effort
	}
}

// UpdateTask is the resolver for the updateTask field.
func (r *mutationResolver) UpdateTask(ctx context.Context, taskID uuid.UUID, input model.UpdateTaskInput) (*model.TaskResult, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	if input.Title != nil && strings.TrimSpace(*input.Title) == "" {
		return r.taskFail("task title is required"), nil
	}

	var title, description, priority, status *string
	if input.Title != nil {
		t := strings.TrimSpace(*input.Title)
		title = &t
	}
	if input.Description != nil {
		description = input.Description
	}
	if input.Priority != nil {
		p := strings.ToLower(string(*input.Priority))
		priority = &p
	}
	if input.Status != nil {
		s := strings.ToLower(string(*input.Status))
		status = &s
	}

	updated, err := db.UpdateTask(ctx, r.Pool, taskID, user.ID, title, description, priority, input.AssigneeID, status, nil)
	if err != nil {
		switch err {
		case db.ErrTaskNotFound, db.ErrNotWorkspaceMember, db.ErrAssigneeNotMember, db.ErrInvalidTaskStatus, db.ErrInvalidTaskPriority:
			return r.taskFail(err.Error()), nil
		default:
			return nil, fmt.Errorf("update task: %w", err)
		}
	}

	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}
	roster, err := r.rosterOf(ctx, teamID)
	if err != nil {
		return nil, err
	}
	task, err := r.taskModel(updated, roster)
	if err != nil {
		return nil, err
	}

	msg := fmt.Sprintf("%s updated “%s”.", personName(roster[user.ID]), updated.Title)
	r.notifyTaskUser(ctx, updated.CreatedBy, "task_updated", "Task details updated", msg, &updated.ID)
	if updated.AssigneeID != nil && *updated.AssigneeID != updated.CreatedBy {
		r.notifyTaskUser(ctx, *updated.AssigneeID, "task_updated", "Task details updated", msg, &updated.ID)
	}

	return &model.TaskResult{Success: true, Message: "task updated", Task: task}, nil
}

// UpdateTaskDescription is the resolver for the updateTaskDescription field.
func (r *mutationResolver) UpdateTaskDescription(ctx context.Context, taskID uuid.UUID, description string) (*model.TaskResult, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}

	updated, err := db.UpdateTaskDescription(ctx, r.Pool, taskID, user.ID, description)
	if err != nil {
		switch err {
		case db.ErrTaskNotFound, db.ErrNotWorkspaceMember:
			return r.taskFail(err.Error()), nil
		default:
			return nil, fmt.Errorf("update task description: %w", err)
		}
	}

	roster, err := r.rosterOf(ctx, teamID)
	if err != nil {
		return nil, err
	}
	task, err := r.taskModel(updated, roster)
	if err != nil {
		return nil, err
	}

	// Everyone involved should know the details changed.
	msg := fmt.Sprintf("%s updated the details of “%s”.", personName(roster[user.ID]), updated.Title)
	r.notifyTaskUser(ctx, updated.CreatedBy, "task_updated", "Task details updated", msg, &updated.ID)
	if updated.AssigneeID != nil && *updated.AssigneeID != updated.CreatedBy {
		r.notifyTaskUser(ctx, *updated.AssigneeID, "task_updated", "Task details updated", msg, &updated.ID)
	}

	return &model.TaskResult{Success: true, Message: "task updated", Task: task}, nil
}
