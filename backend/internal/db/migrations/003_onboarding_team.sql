-- Onboarding: every user owns a personal team as soon as they sign up.
-- 1) Migrate existing accounts that predate teams by backfilling one per owner.
-- 2) create_user now provisions the personal team atomically inside the same
--    transaction so a fresh signup never lands without a team to invite to.

CREATE OR REPLACE FUNCTION backfill_personal_teams()
RETURNS INT AS $$
DECLARE v_teams INT;
BEGIN
    INSERT INTO teams (name, owner_id)
    SELECT 'Personal Workspace', id FROM users
    ON CONFLICT (owner_id) DO NOTHING;

    INSERT INTO team_members (team_id, user_id, role)
    SELECT t.id, u.id, 'admin'
    FROM users u
    JOIN teams t ON t.owner_id = u.id
    LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = u.id
    WHERE tm.team_id IS NULL;

    GET DIAGNOSTICS v_teams = ROW_COUNT;
    RETURN v_teams;
END;
$$ LANGUAGE plpgsql;

-- Run the backfill now for any accounts that existed before teams shipped.
SELECT backfill_personal_teams();

-- create_user: registers a user only after phone verification succeeds,
-- and provisions the owner's personal team in the same transaction.
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
DECLARE v_user users%ROWTYPE;
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

    -- Personal workspace: owner is the first and only admin at signup.
    INSERT INTO teams (name, owner_id)
    VALUES ('Personal Workspace', v_user.id)
    ON CONFLICT (owner_id) DO NOTHING;

    INSERT INTO team_members (team_id, user_id, role)
    SELECT t.id, v_user.id, 'admin'
    FROM teams t
    WHERE t.owner_id = v_user.id
    ON CONFLICT (team_id, user_id) DO NOTHING;

    UPDATE otp_requests
    SET verified = false
    WHERE otp_requests.phone = p_phone AND purpose = 'register' AND verified = true;

    RETURN QUERY
    SELECT v_user.id, v_user.phone, v_user.first_name,
           v_user.surname, v_user.other_names, v_user.created_at;
END;
$$ LANGUAGE plpgsql;