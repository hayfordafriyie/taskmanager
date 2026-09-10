-- Goals / OKRs: a goal belongs to a workspace and has an owner (a member) plus
-- any number of key results. A goal's progress is the average of its key
-- results, computed on read so it always reflects the latest check-ins.
CREATE TABLE IF NOT EXISTS goals (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    status      TEXT        NOT NULL DEFAULT 'on_track'
                    CHECK (status IN ('on_track', 'at_risk', 'behind', 'done')),
    due_at      TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_team ON goals (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goals_owner ON goals (owner_id);

CREATE TABLE IF NOT EXISTS key_results (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id    UUID        NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    title      TEXT        NOT NULL,
    progress   INT         NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_key_results_goal ON key_results (goal_id, created_at);

-- goal_team: the workspace a goal belongs to (for permission checks).
CREATE OR REPLACE FUNCTION goal_team(p_goal_id UUID)
RETURNS UUID AS $$
DECLARE v_team_id UUID;
BEGIN
    SELECT team_id INTO v_team_id FROM goals WHERE id = p_goal_id;
    IF v_team_id IS NULL THEN
        RAISE EXCEPTION 'goal not found' USING ERRCODE = '45052';
    END IF;
    RETURN v_team_id;
END;
$$ LANGUAGE plpgsql;

-- create_goal: workspace members can create a goal and assign its owner.
CREATE OR REPLACE FUNCTION create_goal(
    p_team_id     UUID,
    p_created_by  UUID,
    p_owner_id    UUID,
    p_title       TEXT,
    p_description TEXT,
    p_status      TEXT,
    p_due_at      TIMESTAMPTZ
) RETURNS goals AS $$
DECLARE v_goal goals%ROWTYPE;
BEGIN
    PERFORM require_team_member(p_team_id, p_created_by);
    PERFORM require_team_member(p_team_id, p_owner_id);

    IF p_status NOT IN ('on_track', 'at_risk', 'behind', 'done') THEN
        RAISE EXCEPTION 'invalid goal status' USING ERRCODE = '45053';
    END IF;

    INSERT INTO goals (team_id, created_by, owner_id, title, description, status, due_at)
    VALUES (p_team_id, p_created_by, p_owner_id, p_title, COALESCE(p_description, ''),
            COALESCE(p_status, 'on_track'), p_due_at)
    RETURNING * INTO v_goal;
    RETURN v_goal;
END;
$$ LANGUAGE plpgsql;

-- goals_for_team: the Goals board — owner details, progress and key-result count.
CREATE OR REPLACE FUNCTION goals_for_team(p_team_id UUID, p_viewer UUID)
RETURNS TABLE(
    goal_id     UUID,
    team_id     UUID,
    title       TEXT,
    description TEXT,
    status      TEXT,
    due_at      TIMESTAMPTZ,
    created_at  TIMESTAMPTZ,
    updated_at  TIMESTAMPTZ,
    owner_id    UUID,
    owner_first TEXT,
    owner_surname TEXT,
    owner_phone TEXT,
    progress    INT,
    kr_count    INT
) AS $$
BEGIN
    PERFORM require_team_member(p_team_id, p_viewer);

    RETURN QUERY
    SELECT g.id, g.team_id, g.title, g.description, g.status, g.due_at,
           g.created_at, g.updated_at,
           g.owner_id, u.first_name, u.surname, u.phone,
           COALESCE((SELECT ROUND(AVG(kr.progress))::INT
                       FROM key_results kr WHERE kr.goal_id = g.id), 0),
           (SELECT COUNT(*)::INT FROM key_results kr WHERE kr.goal_id = g.id)
    FROM goals g
    JOIN users u ON u.id = g.owner_id
    WHERE g.team_id = p_team_id
    ORDER BY g.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- goal_key_results: the key results of one goal.
CREATE OR REPLACE FUNCTION goal_key_results(p_goal_id UUID, p_viewer UUID)
RETURNS TABLE(
    kr_id      UUID,
    title      TEXT,
    progress   INT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    PERFORM require_team_member(goal_team(p_goal_id), p_viewer);

    RETURN QUERY
    SELECT kr.id, kr.title, kr.progress, kr.created_at
    FROM key_results kr
    WHERE kr.goal_id = p_goal_id
    ORDER BY kr.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- create_key_result: add a measurable result to a goal.
CREATE OR REPLACE FUNCTION create_key_result(
    p_goal_id UUID,
    p_user_id UUID,
    p_title   TEXT
) RETURNS key_results AS $$
DECLARE v_kr key_results%ROWTYPE;
BEGIN
    PERFORM require_team_member(goal_team(p_goal_id), p_user_id);

    INSERT INTO key_results (goal_id, title)
    VALUES (p_goal_id, p_title)
    RETURNING * INTO v_kr;
    RETURN v_kr;
END;
$$ LANGUAGE plpgsql;

-- set_key_result_progress: check in on a key result (0-100).
CREATE OR REPLACE FUNCTION set_key_result_progress(
    p_kr_id    UUID,
    p_user_id  UUID,
    p_progress INT
) RETURNS key_results AS $$
DECLARE v_kr key_results%ROWTYPE;
DECLARE v_goal_id UUID;
BEGIN
    SELECT goal_id INTO v_goal_id FROM key_results WHERE id = p_kr_id;
    IF v_goal_id IS NULL THEN
        RAISE EXCEPTION 'key result not found' USING ERRCODE = '45054';
    END IF;
    PERFORM require_team_member(goal_team(v_goal_id), p_user_id);

    UPDATE key_results
    SET progress = GREATEST(0, LEAST(100, p_progress))
    WHERE id = p_kr_id
    RETURNING * INTO v_kr;

    UPDATE goals SET updated_at = now() WHERE id = v_goal_id;
    RETURN v_kr;
END;
$$ LANGUAGE plpgsql;

-- update_goal_status: move a goal between on track / at risk / behind / done.
CREATE OR REPLACE FUNCTION update_goal_status(
    p_goal_id UUID,
    p_user_id UUID,
    p_status  TEXT
) RETURNS goals AS $$
DECLARE v_goal goals%ROWTYPE;
BEGIN
    IF p_status NOT IN ('on_track', 'at_risk', 'behind', 'done') THEN
        RAISE EXCEPTION 'invalid goal status' USING ERRCODE = '45053';
    END IF;
    PERFORM require_team_member(goal_team(p_goal_id), p_user_id);

    UPDATE goals
    SET status = p_status, updated_at = now()
    WHERE id = p_goal_id
    RETURNING * INTO v_goal;
    RETURN v_goal;
END;
$$ LANGUAGE plpgsql;

-- delete_goal: remove a goal (and its key results) from the workspace.
CREATE OR REPLACE FUNCTION delete_goal(p_goal_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    PERFORM require_team_member(goal_team(p_goal_id), p_user_id);
    DELETE FROM goals WHERE id = p_goal_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
