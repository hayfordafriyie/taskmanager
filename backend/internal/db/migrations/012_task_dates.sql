-- Task scheduling: start_date / end_date let a task carry a planned window in
-- addition to its due_at deadline.
--
-- This migration also (re)creates update_task, which was never applied: the
-- former 008_update_task.sql shared version 8 with 008_chat.sql, so the runner
-- considered version 8 done and skipped it. That duplicate file has been
-- removed and parseMigrations now rejects duplicate versions outright.
--
-- Notes for maintainers:
--   * The task mutation functions are overloaded by their argument lists, so the
--     previous signatures MUST be dropped before the new ones are created —
--     otherwise calling them with the old arity becomes ambiguous.
--   * tasks_for_team changes its RETURN TABLE shape, which CREATE OR REPLACE
--     cannot do, hence the explicit DROP.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS end_date   DATE;

-- A planned window is only meaningful when ordered.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_date_order;
ALTER TABLE tasks ADD CONSTRAINT tasks_date_order
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);

CREATE INDEX IF NOT EXISTS idx_tasks_team_dates ON tasks (team_id, start_date, end_date);

-- ---------------------------------------------------------------------------
-- create_task: now accepts the planned window.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS create_task(UUID, UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION create_task(
    p_team_id      UUID,
    p_created_by   UUID,
    p_assignee_id  UUID,
    p_title        TEXT,
    p_description  TEXT,
    p_priority     TEXT,
    p_due_at       TIMESTAMPTZ,
    p_start_date   DATE,
    p_end_date     DATE
) RETURNS tasks AS $$
DECLARE v_task tasks%ROWTYPE;
BEGIN
    PERFORM require_team_member(p_team_id, p_created_by);

    IF p_assignee_id IS NOT NULL
       AND (SELECT member_role(p_team_id, p_assignee_id)) IS NULL THEN
        RAISE EXCEPTION 'assignee is not a member of this workspace'
            USING ERRCODE = '45021';
    END IF;

    IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_end_date < p_start_date THEN
        RAISE EXCEPTION 'task end date cannot be before its start date'
            USING ERRCODE = '45025';
    END IF;

    INSERT INTO tasks (team_id, created_by, assignee_id, title, description,
                       priority, due_at, start_date, end_date)
    VALUES (p_team_id, p_created_by, p_assignee_id, p_title, p_description,
            COALESCE(p_priority, 'medium'), p_due_at, p_start_date, p_end_date)
    RETURNING * INTO v_task;

    RETURN v_task;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- update_task: dates follow the same contract as the other editable fields —
-- NULL keeps the current value — with explicit clear flags so a date can be
-- removed without depending on client-side omission.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS update_task(UUID, UUID, TEXT, TEXT, TEXT, UUID, TEXT, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION update_task(
    p_task_id      UUID,
    p_actor_id     UUID,
    p_title        TEXT,
    p_description  TEXT,
    p_priority     TEXT,
    p_assignee_id  UUID,
    p_status       TEXT,
    p_due_at       TIMESTAMPTZ,
    p_start_date   DATE DEFAULT NULL,
    p_end_date     DATE DEFAULT NULL,
    p_clear_start  BOOLEAN DEFAULT FALSE,
    p_clear_end    BOOLEAN DEFAULT FALSE
) RETURNS tasks AS $$
DECLARE v_task tasks%ROWTYPE;
DECLARE v_team_id UUID;
DECLARE v_start DATE;
DECLARE v_end   DATE;
BEGIN
    v_team_id := task_team(p_task_id);
    PERFORM require_team_member(v_team_id, p_actor_id);

    IF p_priority IS NOT NULL AND p_priority NOT IN ('low', 'medium', 'high') THEN
        RAISE EXCEPTION 'invalid task priority' USING ERRCODE = '45024';
    END IF;
    IF p_status IS NOT NULL AND p_status NOT IN ('todo', 'in_progress', 'review', 'done') THEN
        RAISE EXCEPTION 'invalid task status' USING ERRCODE = '45023';
    END IF;
    IF p_assignee_id IS NOT NULL
       AND (SELECT member_role(v_team_id, p_assignee_id)) IS NULL THEN
        RAISE EXCEPTION 'assignee is not a member of this workspace'
            USING ERRCODE = '45021';
    END IF;

    -- Resolve the resulting window first so the order check sees final values.
    v_start := CASE WHEN p_clear_start THEN NULL
                    ELSE COALESCE(p_start_date, (SELECT start_date FROM tasks WHERE id = p_task_id))
               END;
    v_end   := CASE WHEN p_clear_end THEN NULL
                    ELSE COALESCE(p_end_date, (SELECT end_date FROM tasks WHERE id = p_task_id))
               END;

    IF v_start IS NOT NULL AND v_end IS NOT NULL AND v_end < v_start THEN
        RAISE EXCEPTION 'task end date cannot be before its start date'
            USING ERRCODE = '45025';
    END IF;

    UPDATE tasks
    SET title        = COALESCE(p_title, title),
        description  = COALESCE(p_description, description),
        priority     = COALESCE(p_priority, priority),
        assignee_id  = p_assignee_id,
        status       = COALESCE(p_status, status),
        due_at       = COALESCE(p_due_at, due_at),
        start_date   = v_start,
        end_date     = v_end,
        completed_at = CASE
                           WHEN COALESCE(p_status, status) = 'done' THEN now()
                           WHEN p_status IS NOT NULL THEN NULL
                           ELSE completed_at
                       END,
        updated_at   = now()
    WHERE id = p_task_id
    RETURNING * INTO v_task;

    RETURN v_task;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- tasks_for_team: the board/list payload now carries the planned window.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS tasks_for_team(UUID, UUID);

CREATE OR REPLACE FUNCTION tasks_for_team(p_team_id UUID, p_viewer UUID)
RETURNS TABLE(
    task_id          UUID,
    team_id          UUID,
    title            TEXT,
    description      TEXT,
    status           TEXT,
    priority         TEXT,
    due_at           TIMESTAMPTZ,
    start_date       DATE,
    end_date         DATE,
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
           t.due_at, t.start_date, t.end_date, t.completed_at, t.created_at, t.updated_at,
           t.created_by, cu.first_name, cu.surname,
           t.assignee_id, au.phone, au.first_name, au.surname
    FROM tasks t
    JOIN users cu ON cu.id = t.created_by
    LEFT JOIN users au ON au.id = t.assignee_id
    WHERE t.team_id = p_team_id
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;
