-- In-app notifications. A row is one notification owned by a recipient
-- (user_id). kind encodes the source so the UI can style/route each type.
CREATE TABLE IF NOT EXISTS notifications (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT        NOT NULL,
    title      TEXT        NOT NULL,
    body       TEXT        NOT NULL DEFAULT '',
    task_id    UUID        REFERENCES tasks(id) ON DELETE CASCADE,
    read       BOOLEAN     NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
    ON notifications (user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);

-- create_notification: insert a notification for a user.
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id    UUID,
    p_kind       TEXT,
    p_title      TEXT,
    p_body       TEXT,
    p_task_id    UUID
) RETURNS notifications AS $$
DECLARE v_n notifications%ROWTYPE;
BEGIN
    INSERT INTO notifications (user_id, kind, title, body, task_id)
    VALUES (p_user_id, p_kind, p_title, COALESCE(p_body, ''), p_task_id)
    RETURNING * INTO v_n;
    RETURN v_n;
END;
$$ LANGUAGE plpgsql;

-- user_notifications: a recipient's notifications, newest first.
CREATE OR REPLACE FUNCTION user_notifications(p_user_id UUID)
RETURNS TABLE(
    n_id       UUID,
    n_kind     TEXT,
    n_title    TEXT,
    n_body     TEXT,
    n_task_id  UUID,
    n_read     BOOLEAN,
    n_created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT n.id, n.kind, n.title, n.body, n.task_id, n.read, n.created_at
    FROM notifications n
    WHERE n.user_id = p_user_id
    ORDER BY n.created_at DESC, n.id DESC;
END;
$$ LANGUAGE plpgsql;

-- unread_notification_count: how many unread notifications a user has.
CREATE OR REPLACE FUNCTION unread_notification_count(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE v_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM notifications
    WHERE user_id = p_user_id AND NOT read;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- mark_notification_read / _unread: toggle a single owned notification.
CREATE OR REPLACE FUNCTION mark_notification_read(p_id UUID, p_user_id UUID)
RETURNS notifications AS $$
DECLARE v_n notifications%ROWTYPE;
BEGIN
    UPDATE notifications SET read = true
    WHERE id = p_id AND user_id = p_user_id
    RETURNING * INTO v_n;
    IF v_n.id IS NULL THEN
        RAISE EXCEPTION 'notification not found' USING ERRCODE = '45030';
    END IF;
    RETURN v_n;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mark_notification_unread(p_id UUID, p_user_id UUID)
RETURNS notifications AS $$
DECLARE v_n notifications%ROWTYPE;
BEGIN
    UPDATE notifications SET read = false
    WHERE id = p_id AND user_id = p_user_id
    RETURNING * INTO v_n;
    IF v_n.id IS NULL THEN
        RAISE EXCEPTION 'notification not found' USING ERRCODE = '45030';
    END IF;
    RETURN v_n;
END;
$$ LANGUAGE plpgsql;

-- mark_all_notifications_read / _unread: toggle everything owned by the user.
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE v_count BIGINT;
BEGIN
    UPDATE notifications SET read = true
    WHERE user_id = p_user_id AND NOT read;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mark_all_notifications_unread(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE v_count BIGINT;
BEGIN
    UPDATE notifications SET read = false
    WHERE user_id = p_user_id AND read;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- delete_notification: remove a single owned notification.
CREATE OR REPLACE FUNCTION delete_notification(p_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM notifications WHERE id = p_id AND user_id = p_user_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- delete_notifications: remove all notifications owned by a user.
CREATE OR REPLACE FUNCTION delete_notifications(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE v_count BIGINT;
BEGIN
    DELETE FROM notifications WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- create_due_reminders: notify each assignee when one of their tasks is due
-- within the window and is NOT done (to-do, in progress or review). It is
-- idempotent per (assignee, task): an existing, still-unread due-soon
-- notification suppresses another until the user reads it. Returns the number
-- of reminders created.
CREATE OR REPLACE FUNCTION create_due_reminders(
    p_now          TIMESTAMPTZ,
    p_window_hours NUMERIC
) RETURNS BIGINT AS $$
DECLARE v_inserted BIGINT := 0;
DECLARE v_title   TEXT;
DECLARE v_task    RECORD;
BEGIN
    FOR v_task IN
        SELECT t.id AS task_id, t.title AS task_title,
               t.assignee_id, t.due_at, cu.first_name, cu.surname
        FROM tasks t
        JOIN users cu ON cu.id = t.created_by
        WHERE t.assignee_id IS NOT NULL
          AND t.status <> 'done'
          AND t.due_at IS NOT NULL
          AND t.due_at > p_now
          AND t.due_at <= p_now + (p_window_hours || ' hours')::INTERVAL
    LOOP
        IF EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.user_id = v_task.assignee_id
              AND n.kind = 'task_due_soon'
              AND n.task_id = v_task.task_id
              AND NOT n.read
        ) THEN
            CONTINUE;
        END IF;

        v_title := format(
            '“%s” is due %s',
            v_task.task_title,
            to_char(v_task.due_at, 'Mon DD')
        );

        PERFORM create_notification(
            v_task.assignee_id,
            'task_due_soon',
            v_title,
            format(
                'Assigned to you by %s %s. It is not done yet.',
                v_task.first_name, v_task.surname
            ),
            v_task.task_id
        );
        v_inserted := v_inserted + 1;
    END LOOP;
    RETURN v_inserted;
END;
$$ LANGUAGE plpgsql;
