package graph

import (
	"context"
	"fmt"
	"strings"

	"taskmanager/graph/model"
	"taskmanager/internal/db"
	"taskmanager/types"

	"github.com/google/uuid"
)

func docVisibilityFromDB(v string) model.DocVisibility {
	return model.DocVisibility(strings.ToUpper(strings.TrimSpace(v)))
}

func docVisibilityToDB(v model.DocVisibility) string {
	return strings.ToLower(string(v))
}

func toModelDoc(d *types.DocRow) *model.Doc {
	return &model.Doc{
		ID:         d.ID,
		TeamID:     d.TeamID,
		Title:      d.Title,
		Body:       d.Body,
		Visibility: docVisibilityFromDB(d.Visibility),
		CreatedAt:  d.CreatedAt,
		UpdatedAt:  d.UpdatedAt,
		CreatedBy: toModelUser(&types.UserRow{
			ID: d.CreatedBy, FirstName: d.CreatorFirst, Surname: d.CreatorSurname,
		}),
		CanEdit:     d.CanEdit,
		AccessCount: int32(d.AccessCount),
	}
}

// findDoc re-reads a doc through the viewer-filtered list so permission flags
// and access counts are populated consistently.
func (r *Resolver) findDoc(ctx context.Context, teamID, viewerID, docID uuid.UUID) (*types.DocRow, error) {
	docs, err := db.TeamDocs(ctx, r.Pool, teamID, viewerID)
	if err != nil {
		return nil, err
	}
	for i := range docs {
		if docs[i].ID == docID {
			return &docs[i], nil
		}
	}
	return nil, db.ErrDocNotFound
}

func (r *Resolver) docFail(message string) *model.DocResult {
	return &model.DocResult{Success: false, Message: message}
}

// TeamDocs is the resolver for the teamDocs field.
func (r *queryResolver) TeamDocs(ctx context.Context) ([]*model.Doc, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}
	rows, err := db.TeamDocs(ctx, r.Pool, teamID, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load docs: %w", err)
	}
	out := make([]*model.Doc, 0, len(rows))
	for i := range rows {
		out = append(out, toModelDoc(&rows[i]))
	}
	return out, nil
}

// DocAccessList is the resolver for the docAccessList field.
func (r *queryResolver) DocAccessList(ctx context.Context, docID uuid.UUID) ([]*model.DocAccess, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}
	rows, err := db.DocAccessList(ctx, r.Pool, docID, user.ID)
	if err != nil {
		switch err {
		case db.ErrDocForbidden, db.ErrDocNotFound:
			return []*model.DocAccess{}, nil
		default:
			return nil, fmt.Errorf("load doc access: %w", err)
		}
	}
	roster, err := r.rosterOf(ctx, teamID)
	if err != nil {
		return nil, err
	}
	out := make([]*model.DocAccess, 0, len(rows))
	for i := range rows {
		a := rows[i]
		name := "Teammate"
		phone := ""
		if m, ok := roster[a.UserID]; ok {
			if n := strings.TrimSpace(m.FirstName + " " + m.Surname); n != "" {
				name = n
			}
			phone = m.Phone
		}
		out = append(out, &model.DocAccess{
			UserID:    a.UserID,
			Name:      name,
			Phone:     phone,
			CanEdit:   a.CanEdit,
			GrantedAt: a.GrantedAt,
		})
	}
	return out, nil
}

// CreateDoc is the resolver for the createDoc field.
func (r *mutationResolver) CreateDoc(ctx context.Context, title string, body *string, visibility *model.DocVisibility) (*model.DocResult, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(title) == "" {
		return r.docFail("document title is required"), nil
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}

	text := ""
	if body != nil {
		text = *body
	}
	vis := "team"
	if visibility != nil {
		vis = docVisibilityToDB(*visibility)
	}

	created, err := db.CreateDoc(ctx, r.Pool, teamID, user.ID, title, text, vis)
	if err != nil {
		switch err {
		case db.ErrNotWorkspaceMember, db.ErrInvalidDocVisibility:
			return r.docFail(err.Error()), nil
		default:
			return nil, fmt.Errorf("create doc: %w", err)
		}
	}
	created.CreatorFirst = user.FirstName
	created.CreatorSurname = user.Surname
	created.CanEdit = true
	return &model.DocResult{Success: true, Message: "document created", Doc: toModelDoc(created)}, nil
}

// UpdateDoc is the resolver for the updateDoc field.
func (r *mutationResolver) UpdateDoc(ctx context.Context, docID uuid.UUID, title *string, body *string, visibility *model.DocVisibility) (*model.DocResult, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}

	var vis *string
	if visibility != nil {
		v := docVisibilityToDB(*visibility)
		vis = &v
	}

	if _, err := db.UpdateDoc(ctx, r.Pool, docID, user.ID, title, body, vis); err != nil {
		switch err {
		case db.ErrDocForbidden, db.ErrDocNotFound, db.ErrInvalidDocVisibility:
			return r.docFail(err.Error()), nil
		default:
			return nil, fmt.Errorf("update doc: %w", err)
		}
	}

	full, err := r.findDoc(ctx, teamID, user.ID, docID)
	if err != nil {
		return nil, err
	}
	return &model.DocResult{Success: true, Message: "document saved", Doc: toModelDoc(full)}, nil
}

// DeleteDoc is the resolver for the deleteDoc field.
func (r *mutationResolver) DeleteDoc(ctx context.Context, docID uuid.UUID) (bool, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return false, err
	}
	ok, err := db.DeleteDoc(ctx, r.Pool, docID, user.ID)
	if err != nil {
		if err == db.ErrDocForbidden || err == db.ErrDocNotFound {
			return false, nil
		}
		return false, fmt.Errorf("delete doc: %w", err)
	}
	return ok, nil
}

// SetDocAccess is the resolver for the setDocAccess field. It grants (or updates)
// a member's access to a document and returns the refreshed doc.
func (r *mutationResolver) SetDocAccess(ctx context.Context, docID uuid.UUID, userID uuid.UUID, canEdit *bool) (*model.DocResult, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	teamID, err := r.myTeamID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load team: %w", err)
	}

	edit := false
	if canEdit != nil {
		edit = *canEdit
	}
	if _, err := db.SetDocAccess(ctx, r.Pool, docID, user.ID, userID, edit); err != nil {
		switch err {
		case db.ErrDocForbidden, db.ErrDocNotFound, db.ErrNotWorkspaceMember:
			return r.docFail(err.Error()), nil
		default:
			return nil, fmt.Errorf("set doc access: %w", err)
		}
	}

	full, err := r.findDoc(ctx, teamID, user.ID, docID)
	if err != nil {
		return nil, err
	}
	return &model.DocResult{Success: true, Message: "sharing updated", Doc: toModelDoc(full)}, nil
}

// RevokeDocAccess is the resolver for the revokeDocAccess field.
func (r *mutationResolver) RevokeDocAccess(ctx context.Context, docID uuid.UUID, userID uuid.UUID) (bool, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return false, err
	}
	ok, err := db.RevokeDocAccess(ctx, r.Pool, docID, user.ID, userID)
	if err != nil {
		if err == db.ErrDocForbidden || err == db.ErrDocNotFound {
			return false, nil
		}
		return false, fmt.Errorf("revoke doc access: %w", err)
	}
	return ok, nil
}
