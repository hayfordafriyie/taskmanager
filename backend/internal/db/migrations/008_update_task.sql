-- update_task: edit a task's editable fields. Only workspace members may edit;
-- NULL keeps the current value. Passing p_assignee_id explicitly clears the
-- assignee. Any status change refreshes completed_at.

CREATE OR REPLACE FUNCTION update_task(
    p_task_id      UUID,
    p_actor_id     UUID,
    p_title        TEXT,
    p_description  TEXT,
    p_priority     TEXT,
    p_assignee_id  UUID,
    p_status       TEXT,
    p_due_at       TIMESTAMPTZ
) RETURNS tasks AS $$
DECLARE v_task tasks%ROWTYPE;
DECLARE v_team_id UUID;
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

    UPDATE tasks
    SET title        = COALESCE(p_title, title),
        description  = COALESCE(p_description, description),
        priority     = COALESCE(p_priority, priority),
        assignee_id  = p_assignee_id,
        status       = COALESCE(p_status, status),
        due_at       = COALESCE(p_due_at, due_at),
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