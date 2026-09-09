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