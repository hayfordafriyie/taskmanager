-- Inbox chat: direct conversations between team members, WhatsApp-style.
-- One conversation row + its members + ordered messages. Read state is tracked
-- per member (last_read_at) so unread counts and "seen" come for free.
CREATE TABLE IF NOT EXISTS conversations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    kind            TEXT        NOT NULL DEFAULT 'direct'
                        CHECK (kind IN ('direct', 'group')),
    last_message_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at    TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user
    ON conversation_members (user_id);

CREATE TABLE IF NOT EXISTS messages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body            TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages (conversation_id, created_at);

-- require_conversation_member: raise unless the user belongs to the conversation.
CREATE OR REPLACE FUNCTION require_conversation_member(p_conversation_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM conversation_members
        WHERE conversation_id = p_conversation_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'you are not part of this conversation'
            USING ERRCODE = '45040';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ensure_direct_conversation: return (creating if needed) the 1:1 conversation
-- between two members of the same team. Idempotent, so opening the same chat
-- again continues the old conversation.
CREATE OR REPLACE FUNCTION ensure_direct_conversation(
    p_team_id UUID,
    p_user_a  UUID,
    p_user_b  UUID
) RETURNS conversations AS $$
DECLARE v_conv conversations%ROWTYPE;
BEGIN
    PERFORM require_team_member(p_team_id, p_user_a);
    PERFORM require_team_member(p_team_id, p_user_b);

    IF p_user_a = p_user_b THEN
        RAISE EXCEPTION 'you cannot start a conversation with yourself'
            USING ERRCODE = '45041';
    END IF;

    SELECT c.* INTO v_conv
    FROM conversations c
    WHERE c.team_id = p_team_id
      AND c.kind = 'direct'
      AND EXISTS (SELECT 1 FROM conversation_members m
                  WHERE m.conversation_id = c.id AND m.user_id = p_user_a)
      AND EXISTS (SELECT 1 FROM conversation_members m
                  WHERE m.conversation_id = c.id AND m.user_id = p_user_b)
      AND (SELECT COUNT(*) FROM conversation_members m WHERE m.conversation_id = c.id) = 2
    LIMIT 1;

    IF v_conv.id IS NOT NULL THEN
        RETURN v_conv;
    END IF;

    INSERT INTO conversations (team_id, kind)
    VALUES (p_team_id, 'direct')
    RETURNING * INTO v_conv;

    INSERT INTO conversation_members (conversation_id, user_id)
    VALUES (v_conv.id, p_user_a), (v_conv.id, p_user_b);

    RETURN v_conv;
END;
$$ LANGUAGE plpgsql;

-- list_conversations: a user's inbox, newest activity first, with the peer,
-- the last message and an unread count.
CREATE OR REPLACE FUNCTION list_conversations(p_user_id UUID)
RETURNS TABLE(
    conversation_id UUID,
    team_id         UUID,
    kind            TEXT,
    peer_id         UUID,
    peer_first      TEXT,
    peer_surname    TEXT,
    peer_phone      TEXT,
    last_body       TEXT,
    last_sender_id  UUID,
    last_at         TIMESTAMPTZ,
    unread_count    BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.team_id, c.kind,
           peer.id, peer.first_name, peer.surname, peer.phone,
           lm.body, lm.sender_id, COALESCE(c.last_message_at, c.created_at),
           (SELECT COUNT(*) FROM messages m2
             WHERE m2.conversation_id = c.id
               AND m2.sender_id <> p_user_id
               AND m2.created_at > me.last_read_at)
    FROM conversation_members me
    JOIN conversations c ON c.id = me.conversation_id
    LEFT JOIN LATERAL (
        SELECT u.id, u.first_name, u.surname, u.phone
        FROM conversation_members om
        JOIN users u ON u.id = om.user_id
        WHERE om.conversation_id = c.id AND om.user_id <> p_user_id
        LIMIT 1
    ) peer ON true
    LEFT JOIN LATERAL (
        SELECT m.body, m.sender_id
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
    ) lm ON true
    WHERE me.user_id = p_user_id
    ORDER BY COALESCE(c.last_message_at, c.created_at) DESC;
END;
$$ LANGUAGE plpgsql;

-- conversation_messages: messages in a conversation (oldest first), with the
-- sender's details. p_after enables incremental "real-time" fetches.
CREATE OR REPLACE FUNCTION conversation_messages(
    p_conversation_id UUID,
    p_user_id         UUID,
    p_limit           INT,
    p_after           TIMESTAMPTZ
) RETURNS TABLE(
    message_id  UUID,
    sender_id   UUID,
    sender_first TEXT,
    sender_surname TEXT,
    sender_phone TEXT,
    body        TEXT,
    created_at  TIMESTAMPTZ
) AS $$
BEGIN
    PERFORM require_conversation_member(p_conversation_id, p_user_id);

    RETURN QUERY
    SELECT m.id, m.sender_id, u.first_name, u.surname, u.phone, m.body, m.created_at
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = p_conversation_id
      AND (p_after IS NULL OR m.created_at > p_after)
    ORDER BY m.created_at ASC
    LIMIT COALESCE(NULLIF(p_limit, 0), 200);
END;
$$ LANGUAGE plpgsql;

-- send_message: append a message and bump the conversation's activity.
CREATE OR REPLACE FUNCTION send_message(
    p_conversation_id UUID,
    p_sender_id       UUID,
    p_body            TEXT
) RETURNS messages AS $$
DECLARE v_msg messages%ROWTYPE;
BEGIN
    PERFORM require_conversation_member(p_conversation_id, p_sender_id);

    IF COALESCE(btrim(p_body), '') = '' THEN
        RAISE EXCEPTION 'message cannot be empty' USING ERRCODE = '45042';
    END IF;

    INSERT INTO messages (conversation_id, sender_id, body)
    VALUES (p_conversation_id, p_sender_id, p_body)
    RETURNING * INTO v_msg;

    UPDATE conversations
    SET last_message_at = v_msg.created_at
    WHERE id = p_conversation_id;

    -- the sender has implicitly read their own message
    UPDATE conversation_members
    SET last_read_at = v_msg.created_at
    WHERE conversation_id = p_conversation_id AND user_id = p_sender_id;

    RETURN v_msg;
END;
$$ LANGUAGE plpgsql;

-- mark_conversation_read: clear the unread badge for one member.
CREATE OR REPLACE FUNCTION mark_conversation_read(
    p_conversation_id UUID,
    p_user_id         UUID
) RETURNS BOOLEAN AS $$
BEGIN
    PERFORM require_conversation_member(p_conversation_id, p_user_id);
    UPDATE conversation_members
    SET last_read_at = now()
    WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- message_recipients: everyone in a conversation except the sender, used for
-- in-app notifications and SMS alerts.
CREATE OR REPLACE FUNCTION message_recipients(
    p_conversation_id UUID,
    p_sender_id       UUID
) RETURNS TABLE(
    user_id   UUID,
    first_name TEXT,
    surname   TEXT,
    phone     TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.first_name, u.surname, u.phone
    FROM conversation_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.conversation_id = p_conversation_id
      AND cm.user_id <> p_sender_id;
END;
$$ LANGUAGE plpgsql;
