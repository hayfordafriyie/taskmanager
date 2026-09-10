-- Distinguish workspaces by owner.
--
-- Every account's own workspace is created as "Personal Workspace", so when a
-- user belongs to somebody else's team the switcher listed two identical names
-- and there was no way to tell which one was theirs. The list now carries the
-- owner's name so the client can label a joined team "<Owner>'s workspace".

DROP FUNCTION IF EXISTS teams_for_user(UUID);
CREATE OR REPLACE FUNCTION teams_for_user(p_user_id UUID)
RETURNS TABLE (
    out_team_id    UUID,
    out_name       TEXT,
    out_role       TEXT,
    out_is_owner   BOOLEAN,
    out_is_active  BOOLEAN,
    out_members    INTEGER,
    out_owner_name TEXT,
    out_created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id,
           t.name,
           m.role,
           (t.owner_id = p_user_id),
           (u.active_team_id = t.id),
           (SELECT COUNT(*)::INTEGER FROM team_members tm WHERE tm.team_id = t.id),
           NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.surname)), ''),
           t.created_at
    FROM team_members m
    JOIN teams t ON t.id = m.team_id
    JOIN users u ON u.id = p_user_id
    LEFT JOIN users o ON o.id = t.owner_id
    WHERE m.user_id = p_user_id
    ORDER BY (u.active_team_id = t.id) DESC,
             (t.owner_id = p_user_id) DESC,
             t.created_at;
END;
$$ LANGUAGE plpgsql;
