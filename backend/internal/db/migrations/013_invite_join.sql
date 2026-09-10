-- Invited users must land in the inviter's workspace.
--
-- Before this migration a signup always created its own "Personal Workspace"
-- and made the signer its admin, while the invitation stayed pending until the
-- invitee found the Invite page and clicked Accept. Because every workspace was
-- called "Personal Workspace" and nothing prompted them, invitees routinely
-- ended up in their own empty workspace instead of the team that invited them.
--
-- Three changes fix it for good:
--   1. users.active_team_id — which workspace the user is working in, so the
--      app can resolve "my team" to a joined team and not just the owned one.
--   2. claim_pending_invites() — accepting every invitation addressed to the
--      user's phone in one shot (membership + invite marked accepted). Used at
--      signup, and reusable if an invite arrives later.
--   3. ensure_personal_team() now resolves active_team_id first and only
--      provisions an owned workspace when there is nothing to join (keeping the
--      existing "Personal Workspace" naming, which older accounts already use).

-- 1. Active workspace pointer (NULL = fall back to resolution rules below).
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS active_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- 2. Join every pending invitation for the user's phone number.
--    (Dropped first: CREATE OR REPLACE cannot change a function's OUT columns.)
DROP FUNCTION IF EXISTS claim_pending_invites(UUID);
CREATE OR REPLACE FUNCTION claim_pending_invites(p_user_id UUID)
RETURNS TABLE (out_team_id UUID, out_team_name TEXT, out_role TEXT) AS $$
DECLARE
    v_phone TEXT;
    v_inv   RECORD;
BEGIN
    SELECT u.phone INTO v_phone FROM users u WHERE u.id = p_user_id;
    IF v_phone IS NULL THEN
        RETURN;
    END IF;

    FOR v_inv IN
        SELECT i.id, i.team_id, i.role
        FROM invites i
        WHERE i.phone = v_phone
          AND i.status = 'pending'
          AND i.expires_at > now()
        ORDER BY i.created_at
    LOOP
        INSERT INTO team_members (team_id, user_id, role)
        VALUES (v_inv.team_id, p_user_id, v_inv.role)
        ON CONFLICT (team_id, user_id) DO NOTHING;

        UPDATE invites
        SET status = 'accepted', accepted_at = now(), accepted_by = p_user_id
        WHERE invites.id = v_inv.id AND invites.status = 'pending';

        RETURN QUERY
        SELECT v_inv.team_id,
               (SELECT t.name FROM teams t WHERE t.id = v_inv.team_id),
               v_inv.role;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Resolve the user's workspace: explicit active team, then a joined team,
--    then their own workspace (created on demand, named after them).
CREATE OR REPLACE FUNCTION ensure_personal_team(p_owner_id UUID)
RETURNS teams AS $$
DECLARE
    v_team teams%ROWTYPE;
BEGIN
    -- (a) the workspace they are currently in, when still a member
    SELECT t.* INTO v_team
    FROM teams t
    JOIN users u ON u.id = p_owner_id
    JOIN team_members m ON m.team_id = t.id AND m.user_id = p_owner_id
    WHERE t.id = u.active_team_id
    LIMIT 1;
    IF v_team.id IS NOT NULL THEN
        RETURN v_team;
    END IF;

    -- (b) a team they were invited into (member, not owner)
    SELECT t.* INTO v_team
    FROM teams t
    JOIN team_members m ON m.team_id = t.id
    WHERE m.user_id = p_owner_id AND t.owner_id <> p_owner_id
    ORDER BY m.created_at
    LIMIT 1;
    IF v_team.id IS NOT NULL THEN
        UPDATE users SET active_team_id = v_team.id WHERE id = p_owner_id;
        RETURN v_team;
    END IF;

    -- (c) their own workspace, created on demand
    SELECT * INTO v_team FROM teams WHERE owner_id = p_owner_id LIMIT 1;
    IF v_team.id IS NULL THEN
        INSERT INTO teams (name, owner_id)
        VALUES ('Personal Workspace', p_owner_id)
        RETURNING * INTO v_team;

        INSERT INTO team_members (team_id, user_id, role)
        VALUES (v_team.id, p_owner_id, 'admin')
        ON CONFLICT (team_id, user_id) DO NOTHING;
    END IF;

    UPDATE users SET active_team_id = v_team.id WHERE id = p_owner_id;
    RETURN v_team;
END;
$$ LANGUAGE plpgsql;

-- 4. Switch the active workspace (only for teams the user belongs to).
CREATE OR REPLACE FUNCTION switch_active_team(p_user_id UUID, p_team_id UUID)
RETURNS teams AS $$
DECLARE v_team teams%ROWTYPE;
BEGIN
    SELECT t.* INTO v_team
    FROM teams t
    JOIN team_members m ON m.team_id = t.id
    WHERE t.id = p_team_id AND m.user_id = p_user_id
    LIMIT 1;

    IF v_team.id IS NULL THEN
        RAISE EXCEPTION 'you are not a member of this workspace'
            USING ERRCODE = '45026';
    END IF;

    UPDATE users SET active_team_id = v_team.id WHERE id = p_user_id;
    RETURN v_team;
END;
$$ LANGUAGE plpgsql;

-- 5. Signup: join pending invitations instead of always starting a workspace.
--    Only when there is nothing to join do we provision an owned workspace.
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
    v_user   users%ROWTYPE;
    v_joined RECORD;
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

    -- An invitation wins over a private workspace: the new account starts
    -- inside the team that invited them, with the role they were invited as.
    SELECT out_team_id INTO v_joined FROM claim_pending_invites(v_user.id) LIMIT 1;
    IF v_joined.out_team_id IS NOT NULL THEN
        -- Qualify the column: this function's OUT parameter is also named id.
        UPDATE users SET active_team_id = v_joined.out_team_id WHERE users.id = v_user.id;
    ELSE
        PERFORM ensure_personal_team(v_user.id);
    END IF;

    UPDATE otp_requests
    SET verified = false
    WHERE otp_requests.phone = p_phone AND purpose = 'register' AND verified = true;

    RETURN QUERY
    SELECT v_user.id, v_user.phone, v_user.first_name,
           v_user.surname, v_user.other_names, v_user.created_at;
END;
$$ LANGUAGE plpgsql;
