CREATE TABLE IF NOT EXISTS teams (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    owner_id   UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
    team_id    UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       TEXT        NOT NULL CHECK (role IN ('admin', 'member', 'guest')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id);

CREATE TABLE IF NOT EXISTS invites (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    phone       TEXT        NOT NULL,
    role        TEXT        NOT NULL CHECK (role IN ('admin', 'member', 'guest')),
    invited_by  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
    expires_at  TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_phone ON invites (phone, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_pending_unique
    ON invites (team_id, phone) WHERE status = 'pending';

-- ensure_personal_team: the owner's personal workspace, created lazily.
CREATE OR REPLACE FUNCTION ensure_personal_team(p_owner_id UUID)
RETURNS teams AS $$
DECLARE v_team teams%ROWTYPE;
BEGIN
    SELECT * INTO v_team FROM teams WHERE owner_id = p_owner_id LIMIT 1;
    IF v_team.id IS NULL THEN
        INSERT INTO teams (name, owner_id)
        VALUES ('Personal Workspace', p_owner_id)
        RETURNING * INTO v_team;
        INSERT INTO team_members (team_id, user_id, role)
        VALUES (v_team.id, p_owner_id, 'admin');
    END IF;
    RETURN v_team;
END;
$$ LANGUAGE plpgsql;

-- member_role: role for a user inside a team, or NULL when not a member.
CREATE OR REPLACE FUNCTION member_role(p_team_id UUID, p_user_id UUID)
RETURNS TEXT AS $$
DECLARE v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM team_members
    WHERE team_id = p_team_id AND user_id = p_user_id;
    RETURN v_role;
END;
$$ LANGUAGE plpgsql;

-- get_team: load a team by id.
CREATE OR REPLACE FUNCTION get_team(p_team_id UUID)
RETURNS teams AS $$
DECLARE v_team teams%ROWTYPE;
BEGIN
    SELECT * INTO v_team FROM teams WHERE id = p_team_id;
    IF v_team.id IS NULL THEN
        RAISE EXCEPTION 'team not found' USING ERRCODE = '45018';
    END IF;
    RETURN v_team;
END;
$$ LANGUAGE plpgsql;

-- invite_member: create a pending invitation, protecting against duplicate
-- pending invites, self-invites, and inviting people already in the team.
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

    IF EXISTS (
        SELECT 1 FROM invites
        WHERE team_id = p_team_id AND phone = p_phone AND status = 'pending'
    ) THEN
        RAISE EXCEPTION 'this person has already been invited'
            USING ERRCODE = '45012';
    END IF;

    INSERT INTO invites (team_id, phone, role, invited_by, expires_at)
    VALUES (p_team_id, p_phone, p_role, p_invited_by, p_expires_at)
    RETURNING * INTO v_invite;
    RETURN v_invite;
END;
$$ LANGUAGE plpgsql;

-- accept_invite: convert a pending invite into a team membership for the
-- invited user. Returns the resulting team plus the assigned role.
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

    RETURN QUERY
    SELECT t.id, t.name, v_invite.role
    FROM teams t
    WHERE t.id = v_invite.team_id;
END;
$$ LANGUAGE plpgsql;

-- revoke_invite: cancel a pending invite created by the given user.
CREATE OR REPLACE FUNCTION revoke_invite(p_invite_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE invites
    SET status = 'revoked'
    WHERE id = p_invite_id
      AND status = 'pending'
      AND invited_by = p_user_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- team_members_with_roles: members of a team joined with user details.
CREATE OR REPLACE FUNCTION team_members_with_roles(p_team_id UUID)
RETURNS TABLE(
    user_id    UUID,
    phone      TEXT,
    first_name TEXT,
    surname    TEXT,
    role       TEXT,
    joined_at  TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.phone, u.first_name, u.surname, tm.role, tm.created_at
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = p_team_id
    ORDER BY tm.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- team_invites: pending invites of a team with the inviter's details.
CREATE OR REPLACE FUNCTION team_invites(p_team_id UUID)
RETURNS TABLE(
    invite_id  UUID,
    phone      TEXT,
    role       TEXT,
    invited_by UUID,
    inviter_first_name TEXT,
    inviter_surname    TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    status     TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT i.id, i.phone, i.role, i.invited_by,
           u.first_name, u.surname, i.expires_at, i.created_at, i.status
    FROM invites i
    JOIN users u ON u.id = i.invited_by
    WHERE i.team_id = p_team_id AND i.status = 'pending'
    ORDER BY i.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- pending_invites_for_phone: active invitations addressed to a phone number.
CREATE OR REPLACE FUNCTION pending_invites_for_phone(p_phone TEXT)
RETURNS TABLE(
    invite_id  UUID,
    team_id    UUID,
    team_name  TEXT,
    role       TEXT,
    invited_by UUID,
    inviter_first_name TEXT,
    inviter_surname    TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT i.id, i.team_id, t.name, i.role, i.invited_by,
           u.first_name, u.surname, i.expires_at, i.created_at
    FROM invites i
    JOIN teams t ON t.id = i.team_id
    JOIN users u ON u.id = i.invited_by
    WHERE i.phone = p_phone AND i.status = 'pending' AND i.expires_at > now()
    ORDER BY i.created_at DESC;
END;
$$ LANGUAGE plpgsql;