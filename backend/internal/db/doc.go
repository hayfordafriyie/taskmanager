package db

import (
	"context"
	"errors"

	"taskmanager/types"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrDocNotFound          = errors.New("document not found")
	ErrDocForbidden         = errors.New("you do not have permission for this document")
	ErrInvalidDocVisibility = errors.New("invalid document visibility")
)

func mapDocError(err error) (error, bool) {
	pgErr, ok := err.(*pgconn.PgError)
	if !ok {
		return nil, false
	}
	switch pgErr.Code {
	case "45020":
		return ErrNotWorkspaceMember, true
	case "45070":
		return ErrDocNotFound, true
	case "45072":
		return ErrDocForbidden, true
	case "45073":
		return ErrInvalidDocVisibility, true
	}
	return nil, false
}

func scanDocCore(row pgxRow) (*types.DocRow, error) {
	var d types.DocRow
	err := row.Scan(
		&d.ID, &d.TeamID, &d.CreatedBy, &d.Title, &d.Body, &d.Visibility,
		&d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// CreateDoc creates a document (any workspace member may create one).
func CreateDoc(
	ctx context.Context,
	pool *pgxpool.Pool,
	teamID, createdBy uuid.UUID,
	title, body, visibility string,
) (*types.DocRow, error) {
	row := pool.QueryRow(
		ctx,
		`SELECT id, team_id, created_by, title, body, visibility, created_at, updated_at
		   FROM create_doc($1, $2, $3, $4, $5)`,
		teamID, createdBy, title, body, visibility,
	)
	d, err := scanDocCore(row)
	if err != nil {
		if mapped, ok := mapDocError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return d, nil
}

// UpdateDoc edits title/body/visibility (NULL leaves a field unchanged) and
// requires edit rights, enforced in SQL.
func UpdateDoc(
	ctx context.Context,
	pool *pgxpool.Pool,
	docID, userID uuid.UUID,
	title, body, visibility *string,
) (*types.DocRow, error) {
	row := pool.QueryRow(
		ctx,
		`SELECT id, team_id, created_by, title, body, visibility, created_at, updated_at
		   FROM update_doc($1, $2, $3, $4, $5)`,
		docID, userID, title, body, visibility,
	)
	d, err := scanDocCore(row)
	if err != nil {
		if mapped, ok := mapDocError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return d, nil
}

func DeleteDoc(ctx context.Context, pool *pgxpool.Pool, docID, userID uuid.UUID) (bool, error) {
	var ok bool
	err := pool.QueryRow(ctx, "SELECT delete_doc($1, $2)", docID, userID).Scan(&ok)
	if err != nil {
		if mapped, ok := mapDocError(err); ok {
			return false, mapped
		}
		return false, err
	}
	return ok, nil
}

// TeamDocs lists the documents a viewer is allowed to see, with creator details,
// their own edit permission and how many members have explicit access.
func TeamDocs(ctx context.Context, pool *pgxpool.Pool, teamID, viewer uuid.UUID) ([]types.DocRow, error) {
	rows, err := pool.Query(
		ctx,
		`SELECT doc_id, title, body, visibility, created_at, updated_at,
		        creator_id, creator_first, creator_surname, can_edit, access_count
		   FROM docs_for_team($1, $2)`,
		teamID, viewer,
	)
	if err != nil {
		if mapped, ok := mapDocError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	defer rows.Close()

	var out []types.DocRow
	for rows.Next() {
		var d types.DocRow
		d.TeamID = teamID
		if err := rows.Scan(
			&d.ID, &d.Title, &d.Body, &d.Visibility, &d.CreatedAt, &d.UpdatedAt,
			&d.CreatedBy, &d.CreatorFirst, &d.CreatorSurname, &d.CanEdit, &d.AccessCount,
		); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func DocAccessList(ctx context.Context, pool *pgxpool.Pool, docID, viewer uuid.UUID) ([]types.DocAccessRow, error) {
	rows, err := pool.Query(
		ctx,
		"SELECT user_id, first_name, surname, phone, can_edit, granted_at FROM doc_access_list($1, $2)",
		docID, viewer,
	)
	if err != nil {
		if mapped, ok := mapDocError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	defer rows.Close()

	var out []types.DocAccessRow
	for rows.Next() {
		var a types.DocAccessRow
		var first, surname, phone string
		a.DocID = docID
		if err := rows.Scan(&a.UserID, &first, &surname, &phone, &a.CanEdit, &a.GrantedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// SetDocAccess grants (or updates) a member's access to a document.
func SetDocAccess(
	ctx context.Context,
	pool *pgxpool.Pool,
	docID, actorID, userID uuid.UUID,
	canEdit bool,
) (*types.DocAccessRow, error) {
	var a types.DocAccessRow
	err := pool.QueryRow(
		ctx,
		`SELECT doc_id, user_id, can_edit, granted_by, created_at
		   FROM set_doc_access($1, $2, $3, $4)`,
		docID, actorID, userID, canEdit,
	).Scan(&a.DocID, &a.UserID, &a.CanEdit, &a.GrantedBy, &a.GrantedAt)
	if err != nil {
		if mapped, ok := mapDocError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return &a, nil
}

func RevokeDocAccess(ctx context.Context, pool *pgxpool.Pool, docID, actorID, userID uuid.UUID) (bool, error) {
	var ok bool
	err := pool.QueryRow(ctx, "SELECT revoke_doc_access($1, $2, $3)", docID, actorID, userID).Scan(&ok)
	if err != nil {
		if mapped, ok := mapDocError(err); ok {
			return false, mapped
		}
		return false, err
	}
	return ok, nil
}
