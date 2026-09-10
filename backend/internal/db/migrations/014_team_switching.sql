-- Owned workspace + joined teams, switchable, with no cross-team mixing.
--
-- A user keeps their own "Personal Workspace" (they are its admin) *and* may
-- belong to other people's teams. users.active_team_id says which one they are
-- working in; every workspace-scoped query resolves through ensure_personal_team
-- so switching changes the whole app consistently.

-- teams_for_user: every workspace the user belongs to, with their role, whether
-- they own it and which one is currently active.
DROP FUNCTION IF EXISTS teams_for_user(UUID);
CREATE OR REPLACE FUNCTION teams_for_user(p_user_id UUID)
RETURNS TABLE (
    out_team_id    UUID,
    out_name       TEXT,
    out_role       TEXT,
    out_is_owner   BOOLEAN,
    out_is_active  BOOLEAN,
    out_members    INTEGER,
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
           t.created_at
    FROM team_members m
    JOIN teams t ON t.id = m.team_id
    JOIN users u ON u.id = p_user_id
    WHERE m.user_id = p_user_id
    ORDER BY (u.active_team_id = t.id) DESC,
             (t.owner_id = p_user_id) DESC,
             t.created_at;
END;
$$ LANGUAGE plpgsql;

-- provision_owned_team: guarantee the user has a workspace of their own (admins
-- of it) without touching which team is active. Called at signup so an invited
-- person still owns their own space and can switch to it later.
CREATE OR REPLACE FUNCTION provision_owned_team(p_user_id UUID)
RETURNS teams AS $$
DECLARE v_team teams%ROWTYPE;
BEGIN
    SELECT * INTO v_team FROM teams WHERE owner_id = p_user_id LIMIT 1;
    IF v_team.id IS NULL THEN
        INSERT INTO teams (name, owner_id)
        VALUES ('Personal Workspace', p_user_id)
        RETURNING * INTO v_team;
    END IF;

    INSERT INTO team_members (team_id, user_id, role)
    VALUES (v_team.id, p_user_id, 'admin')
    ON CONFLICT (team_id, user_id) DO NOTHING;

    RETURN v_team;
END;
$$ LANGUAGE plpgsql;

-- create_user: each account owns a workspace; when there is an invitation for
-- that phone the account STARTS inside the inviting team with the invited role.
CREATE OR REPLACE FUNCTION create_user(
    p_phone         TEXT,
    p_first_name    TEXT,
    p_surname       TEXT,
    p_other_names   TEXT,
    p_password_hash TEXT
) RETURNS TABLE(
    id         UUID,
    phone      TEXT,
    first_name TEXT,
    surname    TEXT,
    other_names TEXT,
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    v_user        users%ROWTYPE;
    v_owned_team  UUID;
    v_joined_team UUID;
BEGIN
    IF phone_registered(p_phone) THEN
        RAISE EXCEPTION 'phone number is already registered'
            USING ERRCODE = '45002';
    END IF;

    IF NOT phone_verified(p_phone, 'register', interval '30 minutes') THEN
        RAISE EXCEPTION 'phone number is not verified'
            USING ERRCODE = '45001';
    END IF;

    INSERT INTO users (phone, first_name, surname, other_names, password_hash)
    VALUES (p_phone, p_first_name, p_surname, NULLIF(p_other_names, ''), p_password_hash)
    RETURNING * INTO v_user;

    -- Always give the account its own workspace…
    PERFORM provision_owned_team(v_user.id);
    SELECT t.id INTO v_owned_team FROM teams t WHERE t.owner_id = v_user.id LIMIT 1;

    -- …then join any invitation, which becomes the active workspace.
    SELECT out_team_id INTO v_joined_team
    FROM claim_pending_invites(v_user.id) LIMIT 1;

    -- Qualify the column: this function's OUT parameter is also named id.
    UPDATE users
    SET active_team_id = COALESCE(v_joined_team, v_owned_team)
    WHERE users.id = v_user.id;

    UPDATE otp_requests
    SET verified = false
    WHERE otp_requests.phone = p_phone AND purpose = 'register' AND verified = true;

    RETURN QUERY
    SELECT v_user.id, v_user.phone, v_user.first_name,
           v_user.surname, v_user.other_names, v_user.created_at;
END;
$$ LANGUAGE plpgsql;

-- accept_invite: accepting an invitation also makes that team the active
-- workspace, so the invitee lands where they just joined (they keep their own
-- workspace and can switch back at any time).
CREATE OR REPLACE FUNCTION accept_invite(p_invite_id UUID, p_user_id UUID)
RETURNS TABLE(team_id UUID, team_name TEXT, role TEXT) AS $$
DECLARE v_invite invites%ROWTYPE;
DECLARE v_user_phone TEXT;
BEGIN
    SELECT * INTO v_invite FROM invites WHERE id = p_invite_id;
    IF v_invite.id IS NULL OR v_invite.status <> 'pending' THEN
        RAISE EXCEPTION 'there is no pending invite to accept'
            USING ERRCODE = '45014';
    END IF;
    IF v_invite.expires_at < now() THEN
        UPDATE invites SET status = 'revoked' WHERE id = p_invite_id;
        RAISE EXCEPTION 'this invite has expired'
            USING ERRCODE = '45015';
    END IF;

    SELECT phone INTO v_user_phone FROM users WHERE id = p_user_id;
    IF v_invite.phone <> v_user_phone THEN
        RAISE EXCEPTION 'this invite is not for you'
            USING ERRCODE = '45016';
    END IF;

    IF EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = v_invite.team_id AND tm.user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'you are already a member of this team'
            USING ERRCODE = '45017';
    END IF;

    INSERT INTO team_members (team_id, user_id, role)
    VALUES (v_invite.team_id, p_user_id, v_invite.role);

    UPDATE invites
    SET status = 'accepted', accepted_at = now(), accepted_by = p_user_id
    WHERE id = p_invite_id;

    -- Qualify the column: an OUT parameter is named team_id.
    UPDATE users SET active_team_id = v_invite.team_id WHERE users.id = p_user_id;

    RETURN QUERY
    SELECT t.id, t.name, v_invite.role
    FROM teams t
    WHERE t.id = v_invite.team_id;
END;
$$ LANGUAGE plpgsql;
