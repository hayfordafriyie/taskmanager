package tests

import (
	"fmt"
	"strings"
	"testing"
)

const taskWindowSelection = `success message task { id title status startDate endDate }`

func createTaskWindowQuery(title, start, end string) string {
	extra := ""
	if start != "" {
		extra += fmt.Sprintf(`, startDate: %q`, start)
	}
	if end != "" {
		extra += fmt.Sprintf(`, endDate: %q`, end)
	}
	return fmt.Sprintf(`mutation { createTask(input: { title: %q%s }) { %s } }`,
		title, extra, taskWindowSelection)
}

func updateTaskWindowQuery(id, start, end, extra string) string {
	fields := ""
	if start != "" {
		fields += fmt.Sprintf(`, startDate: %q`, start)
	}
	if end != "" {
		fields += fmt.Sprintf(`, endDate: %q`, end)
	}
	return fmt.Sprintf(`mutation { updateTask(taskId: %q, input: { %s }) { %s } }`,
		id, strings.TrimPrefix(fields+extra, ", "), taskWindowSelection)
}

const teamTasksWindowQuery = `query { teamTasks { id title startDate endDate } }`

func taskFrom(t *testing.T, result map[string]any) map[string]any {
	t.Helper()
	task, ok := result["task"].(map[string]any)
	if !ok {
		t.Fatalf("response has no task: %v", result)
	}
	return task
}

// windowValue returns the RFC3339 string for a date field, or "" when the field
// is absent/null (the API omits unset dates).
func windowValue(task map[string]any, field string) string {
	if raw, ok := task[field].(string); ok {
		return raw
	}
	return ""
}

func TestCreateTaskStoresPlannedWindow(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	token := registerAndLogin(t, srv, sender, "+233550001101")
	resp := gqlQueryAuth(t, srv, createTaskWindowQuery(
		"Windowed task", "2026-09-15T00:00:00Z", "2026-09-20T00:00:00Z"), token)
	if hasGQLErrors(t, resp) {
		t.Fatalf("unexpected graphql errors: %v", resp)
	}

	result := gqlMutation(t, resp, "createTask")
	if result["success"] != true {
		t.Fatalf("createTask failed: %v", result)
	}
	task := taskFrom(t, result)
	if got := windowValue(task, "startDate"); !strings.HasPrefix(got, "2026-09-15") {
		t.Errorf("startDate = %q, want it to start on 2026-09-15", got)
	}
	if got := windowValue(task, "endDate"); !strings.HasPrefix(got, "2026-09-20") {
		t.Errorf("endDate = %q, want it to end on 2026-09-20", got)
	}
}

func TestCreateTaskAllowsOpenWindow(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	token := registerAndLogin(t, srv, sender, "+233550001102")
	resp := gqlQueryAuth(t, srv, createTaskWindowQuery(
		"Start only", "2026-09-15T00:00:00Z", ""), token)
	result := gqlMutation(t, resp, "createTask")
	if result["success"] != true {
		t.Fatalf("createTask with only a start date failed: %v", result)
	}
	task := taskFrom(t, result)
	if got := windowValue(task, "startDate"); !strings.HasPrefix(got, "2026-09-15") {
		t.Errorf("startDate = %q, want 2026-09-15", got)
	}
	if got := windowValue(task, "endDate"); got != "" {
		t.Errorf("endDate = %q, want it unset", got)
	}
}

func TestTeamTasksReturnsPlannedWindow(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	token := registerAndLogin(t, srv, sender, "+233550001103")
	created := gqlMutation(t, gqlQueryAuth(t, srv, createTaskWindowQuery(
		"Visible window", "2026-10-01T00:00:00Z", "2026-10-15T00:00:00Z"), token), "createTask")
	if created["success"] != true {
		t.Fatalf("createTask failed: %v", created)
	}

	resp := gqlQueryAuth(t, srv, teamTasksWindowQuery, token)
	tasks, ok := gqlData(t, resp)["teamTasks"].([]any)
	if !ok || len(tasks) == 0 {
		t.Fatalf("teamTasks returned nothing: %v", resp)
	}
	found := false
	for _, raw := range tasks {
		task, _ := raw.(map[string]any)
		if task["title"] != "Visible window" {
			continue
		}
		found = true
		if got := windowValue(task, "startDate"); !strings.HasPrefix(got, "2026-10-01") {
			t.Errorf("startDate = %q, want 2026-10-01", got)
		}
		if got := windowValue(task, "endDate"); !strings.HasPrefix(got, "2026-10-15") {
			t.Errorf("endDate = %q, want 2026-10-15", got)
		}
	}
	if !found {
		t.Fatalf("created task missing from teamTasks: %v", tasks)
	}
}

func TestUpdateTaskMovesAndClearsWindow(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	token := registerAndLogin(t, srv, sender, "+233550001104")
	created := gqlMutation(t, gqlQueryAuth(t, srv, createTaskWindowQuery(
		"Editable window", "2026-09-15T00:00:00Z", "2026-09-20T00:00:00Z"), token), "createTask")
	id, _ := taskFrom(t, created)["id"].(string)
	if id == "" {
		t.Fatalf("createTask returned no id: %v", created)
	}

	// New end date + explicit clear of the start date.
	resp := gqlQueryAuth(t, srv, updateTaskWindowQuery(id,
		"", "2026-09-25T00:00:00Z", "clearStartDate: true"), token)
	if hasGQLErrors(t, resp) {
		t.Fatalf("unexpected graphql errors: %v", resp)
	}
	updated := gqlMutation(t, resp, "updateTask")
	if updated["success"] != true {
		t.Fatalf("updateTask failed: %v", updated)
	}
	task := taskFrom(t, updated)
	if got := windowValue(task, "startDate"); got != "" {
		t.Errorf("startDate = %q, want it cleared", got)
	}
	if got := windowValue(task, "endDate"); !strings.HasPrefix(got, "2026-09-25") {
		t.Errorf("endDate = %q, want 2026-09-25", got)
	}

	// Omitting both bounds must keep the stored value rather than wipe it.
	resp = gqlQueryAuth(t, srv, updateTaskWindowQuery(id, "", "", ""), token)
	kept := gqlMutation(t, resp, "updateTask")
	if got := windowValue(taskFrom(t, kept), "endDate"); !strings.HasPrefix(got, "2026-09-25") {
		t.Errorf("endDate after a title-only update = %q, want it kept", got)
	}
}

func TestCreateTaskRejectsReversedWindow(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	token := registerAndLogin(t, srv, sender, "+233550001105")
	resp := gqlQueryAuth(t, srv, createTaskWindowQuery(
		"Backwards", "2026-09-20T00:00:00Z", "2026-09-01T00:00:00Z"), token)
	result := gqlMutation(t, resp, "createTask")
	if result["success"] != false {
		t.Fatalf("reversed window was accepted: %v", result)
	}
	if msg, _ := result["message"].(string); !strings.Contains(msg, "end date") {
		t.Errorf("message = %q, want it to explain the end date", msg)
	}
}

func TestUpdateTaskRejectsReversedWindow(t *testing.T) {
	srv, _, sender, cleanup := newTestServer(t)
	defer cleanup()

	token := registerAndLogin(t, srv, sender, "+233550001106")
	created := gqlMutation(t, gqlQueryAuth(t, srv, createTaskWindowQuery(
		"Ordered window", "2026-09-15T00:00:00Z", "2026-09-20T00:00:00Z"), token), "createTask")
	id, _ := taskFrom(t, created)["id"].(string)

	resp := gqlQueryAuth(t, srv, updateTaskWindowQuery(id,
		"", "2026-09-01T00:00:00Z", ""), token)
	updated := gqlMutation(t, resp, "updateTask")
	if updated["success"] != false {
		t.Fatalf("reversed window was accepted on update: %v", updated)
	}
	if msg, _ := updated["message"].(string); !strings.Contains(msg, "end date") {
		t.Errorf("message = %q, want it to explain the end date", msg)
	}
}
