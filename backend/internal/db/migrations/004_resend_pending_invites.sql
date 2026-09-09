-- Resend semantics: inviting a phone that already has a pending invite renews
-- that invite (new role, fresh expiry, re-sent SMS) instead of erroring.
-- Self-invites and invites to existing members are still rejected.

CREATE OR REPLACE FUNCTION invite_member(
    p_team_id    UUID,
    p_phone      TEXT,
    p_role       TEXT,
    p_invited_by UUID,
    p_expires_at TIMESTAMPTZ
) RETURNS invites AS $$
DECLARE v_invite invites%ROWTYPE;
BEGIN
    IF p_phone = (SELECT phone FROM users WHERE id = p_invited_by) THEN
        RAISE EXCEPTION 'you cannot invite yourself'
            USING ERRCODE = '45013';
    END IF;

    IF EXISTS (
        SELECT 1 FROM team_members tm
        JOIN users u ON u.id = tm.user_id
        WHERE tm.team_id = p_team_id AND u.phone = p_phone
    ) THEN
        RAISE EXCEPTION 'person is already a member of this team'
            USING ERRCODE = '45011';
    END IF;

    DELETE FROM invites
    WHERE team_id = p_team_id
      AND phone = p_phone
      AND status = 'pending'
      AND expires_at <= now();

    -- A still-pending invite is resent: renew it and hand it back so the
    -- SMS is dispatched again with an open, unexpired window.
    UPDATE invites
    SET role = p_role,
        invited_by = p_invited_by,
        expires_at = p_expires_at,
        created_at = now()
    WHERE team_id = p_team_id
      AND phone = p_phone
      AND status = 'pending'
    RETURNING * INTO v_invite;

    IF v_invite.id IS NOT NULL THEN
        RETURN v_invite;
    END IF;

    INSERT INTO invites (team_id, phone, role, invited_by, expires_at)
    VALUES (p_team_id, p_phone, p_role, p_invited_by, p_expires_at)
    RETURNING * INTO v_invite;
    RETURN v_invite;
END;
$$ LANGUAGE plpgsql;