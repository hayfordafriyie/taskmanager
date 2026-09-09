-- Tasks live in a team/workspace. Every user has a personal team via
-- ensure_personal_team, so personal tasks are simply tasks on your own team.
CREATE TABLE IF NOT EXISTS tasks (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id      UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignee_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
    title        TEXT        NOT NULL,
    description  TEXT        NOT NULL DEFAULT '',
    status       TEXT        NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
    priority     TEXT        NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high')),
    due_at       TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_team_status ON tasks (team_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks (assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_team_created ON tasks (team_id, created_at DESC);

-- require_team_member: returns the viewer's role or raises when they are not
-- part of the team (tasks are strictly per-workspace).
CREATE OR REPLACE FUNCTION require_team_member(p_team_id UUID, p_user_id UUID)
RETURNS TEXT AS $$
DECLARE v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM team_members
    WHERE team_id = p_team_id AND user_id = p_user_id;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'you are not a member of this workspace'
            USING ERRCODE = '45020';
    END IF;
    RETURN v_role;
END;
$$ LANGUAGE plpgsql;

-- create_task: validate that the creator and (optional) assignee both belong
-- to the team, then insert the task.
CREATE OR REPLACE FUNCTION create_task(
    p_team_id      UUID,
    p_created_by   UUID,
    p_assignee_id  UUID,
    p_title        TEXT,
    p_description  TEXT,
    p_priority     TEXT,
    p_due_at       TIMESTAMPTZ
) RETURNS tasks AS $$
DECLARE v_task tasks%ROWTYPE;
BEGIN
    PERFORM require_team_member(p_team_id, p_created_by);

    IF p_assignee_id IS NOT NULL
       AND (SELECT member_role(p_team_id, p_assignee_id)) IS NULL THEN
        RAISE EXCEPTION 'assignee is not a member of this workspace'
            USING ERRCODE = '45021';
    END IF;

    INSERT INTO tasks (team_id, created_by, assignee_id, title, description,
                       priority, due_at)
    VALUES (p_team_id, p_created_by, p_assignee_id, p_title, p_description,
            COALESCE(p_priority, 'medium'), p_due_at)
    RETURNING * INTO v_task;

    RETURN v_task;
END;
$$ LANGUAGE plpgsql;

-- task_team: the team a task belongs to (for permission checks in updates).
CREATE OR REPLACE FUNCTION task_team(p_task_id UUID)
RETURNS UUID AS $$
DECLARE v_team_id UUID;
BEGIN
    SELECT team_id INTO v_team_id FROM tasks WHERE id = p_task_id;
    IF v_team_id IS NULL THEN
        RAISE EXCEPTION 'task not found' USING ERRCODE = '45022';
    END IF;
    RETURN v_team_id;
END;
$$ LANGUAGE plpgsql;

-- set_task_status: only workspace members may move a task. Sets completed_at
-- when moving to done and clears it otherwise. Returns the updated task.
CREATE OR REPLACE FUNCTION set_task_status(
    p_task_id UUID,
    p_user_id UUID,
    p_status  TEXT
) RETURNS tasks AS $$
DECLARE v_task tasks%ROWTYPE;
BEGIN
    IF p_status NOT IN ('todo', 'in_progress', 'review', 'done') THEN
        RAISE EXCEPTION 'invalid task status' USING ERRCODE = '45023';
    END IF;

    PERFORM require_team_member(task_team(p_task_id), p_user_id);

    UPDATE tasks
    SET status       = p_status,
        completed_at = CASE WHEN p_status = 'done' THEN now() ELSE NULL END,
        updated_at   = now()
    WHERE id = p_task_id
    RETURNING * INTO v_task;

    RETURN v_task;
END;
$$ LANGUAGE plpgsql;

-- assign_task: reassign a task to a workspace member (assignee may be NULL to
-- unassign). Both the actor and the new assignee must be members.
CREATE OR REPLACE FUNCTION assign_task(
    p_task_id      UUID,
    p_actor_id     UUID,
    p_assignee_id  UUID
) RETURNS tasks AS $$
DECLARE v_task tasks%ROWTYPE;
DECLARE v_team_id UUID;
BEGIN
    v_team_id := task_team(p_task_id);
    PERFORM require_team_member(v_team_id, p_actor_id);

    IF p_assignee_id IS NOT NULL
       AND (SELECT member_role(v_team_id, p_assignee_id)) IS NULL THEN
        RAISE EXCEPTION 'assignee is not a member of this workspace'
            USING ERRCODE = '45021';
    END IF;

    UPDATE tasks
    SET assignee_id = p_assignee_id,
        updated_at  = now()
    WHERE id = p_task_id
    RETURNING * INTO v_task;

    RETURN v_task;
END;
$$ LANGUAGE plpgsql;

-- tasks_for_team: every task in the workspace with assignee + creator details
-- (used to render boards/lists and to resolve SMS recipients).
CREATE OR REPLACE FUNCTION tasks_for_team(p_team_id UUID, p_viewer UUID)
RETURNS TABLE(
    task_id          UUID,
    team_id          UUID,
    title            TEXT,
    description      TEXT,
    status           TEXT,
    priority         TEXT,
    due_at           TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ,
    creator_id       UUID,
    creator_first    TEXT,
    creator_surname  TEXT,
    assignee_id      UUID,
    assignee_phone   TEXT,
    assignee_first   TEXT,
    assignee_surname TEXT
) AS $$
BEGIN
    PERFORM require_team_member(p_team_id, p_viewer);

    RETURN QUERY
    SELECT t.id, t.team_id, t.title, t.description, t.status, t.priority,
           t.due_at, t.completed_at, t.created_at, t.updated_at,
           t.created_by, cu.first_name, cu.surname,
           t.assignee_id, au.phone, au.first_name, au.surname
    FROM tasks t
    JOIN users cu ON cu.id = t.created_by
    LEFT JOIN users au ON au.id = t.assignee_id
    WHERE t.team_id = p_team_id
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;
