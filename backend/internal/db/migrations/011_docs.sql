-- Docs (team wiki) with per-member permissions.
--
-- visibility:
--   'team'       -> every member of the workspace can read it
--   'private'    -> only the creator (and admins) can read it
--   'restricted' -> only members explicitly granted access in doc_access
-- Editing is allowed for the creator, workspace admins, and members granted
-- can_edit. Admins can always read/edit anything in their workspace.
CREATE TABLE IF NOT EXISTS docs (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id    UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT        NOT NULL,
    body       TEXT        NOT NULL DEFAULT '',
    visibility TEXT        NOT NULL DEFAULT 'team'
                   CHECK (visibility IN ('team', 'private', 'restricted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docs_team ON docs (team_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS doc_access (
    doc_id     UUID        NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_edit   BOOLEAN     NOT NULL DEFAULT false,
    granted_by UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (doc_id, user_id)
);

-- doc_team: the workspace a doc belongs to (permission checks).
CREATE OR REPLACE FUNCTION doc_team(p_doc_id UUID)
RETURNS UUID AS $$
DECLARE v_team_id UUID;
BEGIN
    SELECT team_id INTO v_team_id FROM docs WHERE id = p_doc_id;
    IF v_team_id IS NULL THEN
        RAISE EXCEPTION 'document not found' USING ERRCODE = '45070';
    END IF;
    RETURN v_team_id;
END;
$$ LANGUAGE plpgsql;

-- can_view_doc / can_edit_doc: the permission rules, in one place.
CREATE OR REPLACE FUNCTION can_view_doc(p_doc_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE v_doc docs%ROWTYPE;
DECLARE v_role TEXT;
BEGIN
    SELECT * INTO v_doc FROM docs WHERE id = p_doc_id;
    IF v_doc.id IS NULL THEN
        RETURN false;
    END IF;

    v_role := member_role(v_doc.team_id, p_user_id);
    IF v_role IS NULL THEN
        RETURN false; -- not in the workspace at all
    END IF;

    IF v_doc.created_by = p_user_id OR v_role = 'admin' THEN
        RETURN true;
    END IF;
    IF v_doc.visibility = 'team' THEN
        RETURN true;
    END IF;
    IF v_doc.visibility = 'restricted' THEN
        RETURN EXISTS (SELECT 1 FROM doc_access WHERE doc_id = p_doc_id AND user_id = p_user_id);
    END IF;
    RETURN false; -- private
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION can_edit_doc(p_doc_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE v_doc docs%ROWTYPE;
DECLARE v_role TEXT;
BEGIN
    SELECT * INTO v_doc FROM docs WHERE id = p_doc_id;
    IF v_doc.id IS NULL THEN
        RETURN false;
    END IF;

    v_role := member_role(v_doc.team_id, p_user_id);
    IF v_role IS NULL THEN
        RETURN false;
    END IF;
    IF v_doc.created_by = p_user_id OR v_role = 'admin' THEN
        RETURN true;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM doc_access
        WHERE doc_id = p_doc_id AND user_id = p_user_id AND can_edit
    );
END;
$$ LANGUAGE plpgsql;

-- create_doc: any member can create; restricted docs start with just the creator.
CREATE OR REPLACE FUNCTION create_doc(
    p_team_id    UUID,
    p_created_by UUID,
    p_title      TEXT,
    p_body       TEXT,
    p_visibility TEXT
) RETURNS docs AS $$
DECLARE v_doc docs%ROWTYPE;
BEGIN
    PERFORM require_team_member(p_team_id, p_created_by);

    IF p_visibility NOT IN ('team', 'private', 'restricted') THEN
        RAISE EXCEPTION 'invalid document visibility' USING ERRCODE = '45073';
    END IF;

    INSERT INTO docs (team_id, created_by, title, body, visibility)
    VALUES (p_team_id, p_created_by, p_title, COALESCE(p_body, ''),
            COALESCE(p_visibility, 'team'))
    RETURNING * INTO v_doc;
    RETURN v_doc;
END;
$$ LANGUAGE plpgsql;

-- update_doc: title/body/visibility edits require edit rights.
CREATE OR REPLACE FUNCTION update_doc(
    p_doc_id     UUID,
    p_user_id    UUID,
    p_title      TEXT,
    p_body       TEXT,
    p_visibility TEXT
) RETURNS docs AS $$
DECLARE v_doc docs%ROWTYPE;
BEGIN
    IF NOT can_edit_doc(p_doc_id, p_user_id) THEN
        RAISE EXCEPTION 'you do not have permission to edit this document'
            USING ERRCODE = '45072';
    END IF;
    IF p_visibility IS NOT NULL AND p_visibility NOT IN ('team', 'private', 'restricted') THEN
        RAISE EXCEPTION 'invalid document visibility' USING ERRCODE = '45073';
    END IF;

    UPDATE docs
    SET title      = COALESCE(NULLIF(p_title, ''), title),
        body       = COALESCE(p_body, body),
        visibility = COALESCE(p_visibility, visibility),
        updated_at = now()
    WHERE id = p_doc_id
    RETURNING * INTO v_doc;
    RETURN v_doc;
END;
$$ LANGUAGE plpgsql;

-- delete_doc: the creator (or an admin) may delete a document.
CREATE OR REPLACE FUNCTION delete_doc(p_doc_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE v_team_id UUID;
DECLARE v_creator UUID;
DECLARE v_role TEXT;
BEGIN
    SELECT team_id, created_by INTO v_team_id, v_creator FROM docs WHERE id = p_doc_id;
    IF v_team_id IS NULL THEN
        RETURN false;
    END IF;
    v_role := member_role(v_team_id, p_user_id);
    IF v_role IS NULL OR (v_creator <> p_user_id AND v_role <> 'admin') THEN
        RAISE EXCEPTION 'you do not have permission to delete this document'
            USING ERRCODE = '45072';
    END IF;
    DELETE FROM docs WHERE id = p_doc_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- set_doc_access: grant (or update) a member's access to a restricted doc.
CREATE OR REPLACE FUNCTION set_doc_access(
    p_doc_id   UUID,
    p_actor_id UUID,
    p_user_id  UUID,
    p_can_edit BOOLEAN
) RETURNS doc_access AS $$
DECLARE v_access doc_access%ROWTYPE;
DECLARE v_team_id UUID;
BEGIN
    v_team_id := doc_team(p_doc_id);
    IF NOT can_edit_doc(p_doc_id, p_actor_id) THEN
        RAISE EXCEPTION 'you do not have permission to share this document'
            USING ERRCODE = '45072';
    END IF;
    IF member_role(v_team_id, p_user_id) IS NULL THEN
        RAISE EXCEPTION 'that person is not a member of this workspace'
            USING ERRCODE = '45020';
    END IF;

    INSERT INTO doc_access (doc_id, user_id, can_edit, granted_by)
    VALUES (p_doc_id, p_user_id, COALESCE(p_can_edit, false), p_actor_id)
    ON CONFLICT (doc_id, user_id)
    DO UPDATE SET can_edit = EXCLUDED.can_edit, granted_by = EXCLUDED.granted_by
    RETURNING * INTO v_access;
    RETURN v_access;
END;
$$ LANGUAGE plpgsql;

-- revoke_doc_access: remove a member's explicit access.
CREATE OR REPLACE FUNCTION revoke_doc_access(
    p_doc_id   UUID,
    p_actor_id UUID,
    p_user_id  UUID
) RETURNS BOOLEAN AS $$
BEGIN
    IF NOT can_edit_doc(p_doc_id, p_actor_id) THEN
        RAISE EXCEPTION 'you do not have permission to change sharing'
            USING ERRCODE = '45072';
    END IF;
    DELETE FROM doc_access WHERE doc_id = p_doc_id AND user_id = p_user_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- docs_for_team: the documents a viewer may see, with creator + permission flags.
CREATE OR REPLACE FUNCTION docs_for_team(p_team_id UUID, p_viewer UUID)
RETURNS TABLE(
    doc_id       UUID,
    title        TEXT,
    body         TEXT,
    visibility   TEXT,
    created_at   TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ,
    creator_id   UUID,
    creator_first TEXT,
    creator_surname TEXT,
    can_edit     BOOLEAN,
    access_count INT
) AS $$
BEGIN
    PERFORM require_team_member(p_team_id, p_viewer);

    RETURN QUERY
    SELECT d.id, d.title, d.body, d.visibility, d.created_at, d.updated_at,
           d.created_by, u.first_name, u.surname,
           can_edit_doc(d.id, p_viewer),
           (SELECT COUNT(*)::INT FROM doc_access da WHERE da.doc_id = d.id)
    FROM docs d
    JOIN users u ON u.id = d.created_by
    WHERE d.team_id = p_team_id
      AND can_view_doc(d.id, p_viewer)
    ORDER BY d.updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- doc_access_list: who has explicit access (requires edit rights).
CREATE OR REPLACE FUNCTION doc_access_list(p_doc_id UUID, p_viewer UUID)
RETURNS TABLE(
    user_id    UUID,
    first_name TEXT,
    surname    TEXT,
    phone      TEXT,
    can_edit   BOOLEAN,
    granted_at TIMESTAMPTZ
) AS $$
BEGIN
    IF NOT can_edit_doc(p_doc_id, p_viewer) THEN
        RAISE EXCEPTION 'you do not have permission to view sharing'
            USING ERRCODE = '45072';
    END IF;

    RETURN QUERY
    SELECT da.user_id, u.first_name, u.surname, u.phone, da.can_edit, da.created_at
    FROM doc_access da
    JOIN users u ON u.id = da.user_id
    WHERE da.doc_id = p_doc_id
    ORDER BY u.first_name ASC, u.surname ASC;
END;
$$ LANGUAGE plpgsql;
