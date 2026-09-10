-- Time tracking: members log minutes against a workspace, optionally linked to
-- a task. Aggregations (this week's totals, per-day rows, top label) are done in
-- SQL so the Time view is a thin renderer.
CREATE TABLE IF NOT EXISTS time_entries (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id    UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id    UUID        REFERENCES tasks(id) ON DELETE SET NULL,
    label      TEXT        NOT NULL,
    minutes    INT         NOT NULL CHECK (minutes > 0),
    spent_on   DATE        NOT NULL DEFAULT current_date,
    note       TEXT        NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_day
    ON time_entries (team_id, user_id, spent_on);
CREATE INDEX IF NOT EXISTS idx_time_entries_task
    ON time_entries (task_id);

-- log_time: record time for a member. When a task is given it must belong to the
-- same workspace, and the task title is used as the label if none is supplied.
CREATE OR REPLACE FUNCTION log_time(
    p_team_id  UUID,
    p_user_id  UUID,
    p_task_id  UUID,
    p_label    TEXT,
    p_minutes  INT,
    p_spent_on DATE,
    p_note     TEXT
) RETURNS time_entries AS $$
DECLARE v_entry time_entries%ROWTYPE;
DECLARE v_label TEXT;
BEGIN
    PERFORM require_team_member(p_team_id, p_user_id);

    IF p_minutes IS NULL OR p_minutes <= 0 THEN
        RAISE EXCEPTION 'minutes must be greater than zero' USING ERRCODE = '45060';
    END IF;

    v_label := NULLIF(btrim(COALESCE(p_label, '')), '');

    IF p_task_id IS NOT NULL THEN
        IF (SELECT team_id FROM tasks WHERE id = p_task_id) IS DISTINCT FROM p_team_id THEN
            RAISE EXCEPTION 'task does not belong to this workspace' USING ERRCODE = '45062';
        END IF;
        IF v_label IS NULL THEN
            SELECT title INTO v_label FROM tasks WHERE id = p_task_id;
        END IF;
    END IF;

    IF v_label IS NULL THEN
        v_label := 'General';
    END IF;

    INSERT INTO time_entries (team_id, user_id, task_id, label, minutes, spent_on, note)
    VALUES (p_team_id, p_user_id, p_task_id, v_label, p_minutes,
            COALESCE(p_spent_on, current_date), COALESCE(p_note, ''))
    RETURNING * INTO v_entry;
    RETURN v_entry;
END;
$$ LANGUAGE plpgsql;

-- time_entries_for_range: raw entries in a date window, with task titles.
CREATE OR REPLACE FUNCTION time_entries_for_range(
    p_team_id UUID,
    p_user_id UUID,
    p_from    DATE,
    p_to      DATE
) RETURNS TABLE(
    entry_id   UUID,
    label      TEXT,
    task_id    UUID,
    task_title TEXT,
    minutes    INT,
    spent_on   DATE,
    note       TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    PERFORM require_team_member(p_team_id, p_user_id);

    RETURN QUERY
    SELECT te.id, te.label, te.task_id, t.title, te.minutes, te.spent_on,
           te.note, te.created_at
    FROM time_entries te
    LEFT JOIN tasks t ON t.id = te.task_id
    WHERE te.team_id = p_team_id
      AND te.user_id = p_user_id
      AND te.spent_on BETWEEN p_from AND p_to
    ORDER BY te.spent_on ASC, te.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- time_summary: totals for the same window — hours logged, daily average (over
-- days actually worked), and the label with the most minutes.
CREATE OR REPLACE FUNCTION time_summary(
    p_team_id UUID,
    p_user_id UUID,
    p_from    DATE,
    p_to      DATE
) RETURNS TABLE(
    total_minutes BIGINT,
    entry_count   BIGINT,
    active_days   BIGINT,
    top_label     TEXT,
    top_minutes   BIGINT
) AS $$
BEGIN
    PERFORM require_team_member(p_team_id, p_user_id);

    RETURN QUERY
    SELECT COALESCE(SUM(te.minutes), 0)::BIGINT,
           COUNT(*)::BIGINT,
           COUNT(DISTINCT te.spent_on)::BIGINT,
           (SELECT te2.label
              FROM time_entries te2
             WHERE te2.team_id = p_team_id AND te2.user_id = p_user_id
               AND te2.spent_on BETWEEN p_from AND p_to
             GROUP BY te2.label
             ORDER BY SUM(te2.minutes) DESC, te2.label ASC
             LIMIT 1),
           COALESCE((SELECT SUM(te3.minutes)::BIGINT
              FROM time_entries te3
             WHERE te3.team_id = p_team_id AND te3.user_id = p_user_id
               AND te3.spent_on BETWEEN p_from AND p_to
             GROUP BY te3.label
             ORDER BY SUM(te3.minutes) DESC, te3.label ASC
             LIMIT 1), 0)
    FROM time_entries te
    WHERE te.team_id = p_team_id
      AND te.user_id = p_user_id
      AND te.spent_on BETWEEN p_from AND p_to;
END;
$$ LANGUAGE plpgsql;

-- delete_time_entry: members may remove their own entries.
CREATE OR REPLACE FUNCTION delete_time_entry(p_entry_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM time_entries WHERE id = p_entry_id AND user_id = p_user_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
