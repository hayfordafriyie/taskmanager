-- update_task_description: workspace members may edit a task's optional
-- description. Kept in its own migration so the earlier tasks migration stays
-- immutable once applied.
CREATE OR REPLACE FUNCTION update_task_description(
    p_task_id     UUID,
    p_user_id     UUID,
    p_description TEXT
) RETURNS tasks AS $$
DECLARE v_task tasks%ROWTYPE;
BEGIN
    PERFORM require_team_member(task_team(p_task_id), p_user_id);

    UPDATE tasks
    SET description = COALESCE(p_description, ''),
        updated_at  = now()
    WHERE id = p_task_id
    RETURNING * INTO v_task;

    RETURN v_task;
END;
$$ LANGUAGE plpgsql;
