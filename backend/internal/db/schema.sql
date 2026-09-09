CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone         TEXT        NOT NULL UNIQUE,
    first_name    TEXT        NOT NULL,
    surname       TEXT        NOT NULL,
    other_names   TEXT,
    password_hash TEXT        NOT NULL,
    is_verified   BOOLEAN     NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_requests (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone      TEXT        NOT NULL,
    purpose    TEXT        NOT NULL,
    otp_hash   TEXT        NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts   INT         NOT NULL DEFAULT 0,
    verified   BOOLEAN     NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_requests_phone
    ON otp_requests (phone, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- request_otp: issue a new OTP entry, returns its id.
CREATE OR REPLACE FUNCTION request_otp(
    p_phone      TEXT,
    p_purpose    TEXT,
    p_otp_hash   TEXT,
    p_expires_at TIMESTAMPTZ
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
    INSERT INTO otp_requests (phone, purpose, otp_hash, expires_at)
    VALUES (p_phone, p_purpose, p_otp_hash, p_expires_at)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- latest_otp_time: created_at of the most recent OTP for resend-throttling.
CREATE OR REPLACE FUNCTION latest_otp_time(p_phone TEXT, p_purpose TEXT)
RETURNS TIMESTAMPTZ AS $$
DECLARE v_time TIMESTAMPTZ;
BEGIN
    SELECT created_at INTO v_time
    FROM otp_requests
    WHERE phone = p_phone AND purpose = p_purpose
    ORDER BY created_at DESC
    LIMIT 1;
    RETURN v_time;
END;
$$ LANGUAGE plpgsql;

-- verify_otp: validates a submitted code against the latest unverified OTP.
CREATE OR REPLACE FUNCTION verify_otp(p_phone TEXT, p_purpose TEXT, p_code TEXT)
RETURNS TABLE(valid BOOLEAN, reason TEXT) AS $$
DECLARE v_rec otp_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_rec
    FROM otp_requests
    WHERE phone = p_phone AND purpose = p_purpose AND verified = false
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_rec.id IS NULL THEN
        RETURN QUERY SELECT false::BOOLEAN, 'no_active_otp'::TEXT;
        RETURN;
    END IF;
    IF v_rec.expires_at < now() THEN
        RETURN QUERY SELECT false::BOOLEAN, 'expired'::TEXT;
        RETURN;
    END IF;
    IF v_rec.attempts >= 5 THEN
        RETURN QUERY SELECT false::BOOLEAN, 'too_many_attempts'::TEXT;
        RETURN;
    END IF;

    IF v_rec.otp_hash = crypt(p_code, v_rec.otp_hash) THEN
        UPDATE otp_requests SET verified = true WHERE id = v_rec.id;
        RETURN QUERY SELECT true::BOOLEAN, 'ok'::TEXT;
    ELSE
        UPDATE otp_requests SET attempts = attempts + 1 WHERE id = v_rec.id;
        RETURN QUERY SELECT false::BOOLEAN, 'invalid_code'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- phone_verified: true if a verified OTP exists within the given window.
CREATE OR REPLACE FUNCTION phone_verified(
    p_phone   TEXT,
    p_purpose TEXT,
    p_window  INTERVAL
) RETURNS BOOLEAN AS $$
DECLARE v_verified BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM otp_requests
        WHERE phone = p_phone AND purpose = p_purpose AND verified = true
          AND created_at > now() - p_window
    ) INTO v_verified;
    RETURN v_verified;
END;
$$ LANGUAGE plpgsql;

-- phone_registered: true when an account already exists for the phone.
CREATE OR REPLACE FUNCTION phone_registered(p_phone TEXT)
RETURNS BOOLEAN AS $$
DECLARE v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM users WHERE phone = p_phone) INTO v_exists;
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql;

-- create_user: registers a user only after phone verification succeeds.
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

    UPDATE otp_requests
    SET verified = false
    WHERE otp_requests.phone = p_phone AND purpose = 'register' AND verified = true;

    RETURN QUERY
    SELECT v_user.id, v_user.phone, v_user.first_name,
           v_user.surname, v_user.other_names, v_user.created_at;
END;
$$ LANGUAGE plpgsql;

-- create_session: store an auth session for a user with an explicit id.
CREATE OR REPLACE FUNCTION create_session(
    p_id         UUID,
    p_user_id    UUID,
    p_token_hash TEXT,
    p_expires_at TIMESTAMPTZ
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES (p_id, p_user_id, p_token_hash, p_expires_at)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- authenticate_session: resolve a session to its user when the refresh token
-- recorded for the session still matches (rotation invalidates older hashes)
-- and the session is not expired or revoked.
CREATE OR REPLACE FUNCTION authenticate_session(p_session_id UUID, p_token_hash TEXT)
RETURNS TABLE(
    id          UUID,
    phone       TEXT,
    first_name  TEXT,
    surname     TEXT,
    other_names TEXT,
    created_at  TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.phone, u.first_name, u.surname, u.other_names, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = p_session_id
      AND s.token_hash = p_token_hash
      AND s.revoked_at IS NULL
      AND s.expires_at > now();
END;
$$ LANGUAGE plpgsql;

-- revoke_session: invalidate a session by id (logout).
CREATE OR REPLACE FUNCTION revoke_session(p_session_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE sessions SET revoked_at = now() WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- rotate_session: record a new refresh token hash for a live session.
CREATE OR REPLACE FUNCTION rotate_session(p_session_id UUID, p_token_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE sessions
    SET token_hash = p_token_hash
    WHERE id = p_session_id AND revoked_at IS NULL AND expires_at > now();
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- live_session_user: resolve a session to its user when it is still live. Used
-- to enforce immediate revocation for access tokens.
CREATE OR REPLACE FUNCTION live_session_user(p_session_id UUID)
RETURNS TABLE(
    id          UUID,
    phone       TEXT,
    first_name  TEXT,
    surname     TEXT,
    other_names TEXT,
    created_at  TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.phone, u.first_name, u.surname, u.other_names, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = p_session_id
      AND s.revoked_at IS NULL
      AND s.expires_at > now();
END;
$$ LANGUAGE plpgsql;

-- revoke_sessions_for_user: invalidate every session belonging to a user.
CREATE OR REPLACE FUNCTION revoke_sessions_for_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE sessions SET revoked_at = now() WHERE user_id = p_user_id AND revoked_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- set_password: replace the password hash and revoke all existing sessions.
CREATE OR REPLACE FUNCTION set_password(p_phone TEXT, p_password_hash TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET password_hash = p_password_hash, updated_at = now()
    WHERE phone = p_phone;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'phone number is not registered'
            USING ERRCODE = '45002';
    END IF;

    UPDATE sessions
    SET revoked_at = now()
    WHERE user_id = (SELECT id FROM users WHERE phone = p_phone)
      AND revoked_at IS NULL;
END;
$$ LANGUAGE plpgsql;