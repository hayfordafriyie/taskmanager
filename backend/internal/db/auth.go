package db

import (
	"context"
	"errors"
	"time"

	"taskmanager/types"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func UserByPhone(ctx context.Context, pool *pgxpool.Pool, phone string) (*types.UserCredentials, error) {
	var u types.UserCredentials
	err := pool.QueryRow(
		ctx,
		"SELECT id, phone, first_name, surname, other_names, created_at, password_hash FROM users WHERE phone = $1",
		phone,
	).Scan(&u.ID, &u.Phone, &u.FirstName, &u.Surname, &u.OtherNames, &u.CreatedAt, &u.PasswordHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func UserByID(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID) (*types.UserRow, error) {
	var u types.UserRow
	err := pool.QueryRow(
		ctx,
		"SELECT id, phone, first_name, surname, other_names, created_at FROM users WHERE id = $1",
		id,
	).Scan(&u.ID, &u.Phone, &u.FirstName, &u.Surname, &u.OtherNames, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func SessionUser(ctx context.Context, pool *pgxpool.Pool, sessionID uuid.UUID) (*types.UserRow, error) {
	var u types.UserRow
	err := pool.QueryRow(
		ctx, "SELECT id, phone, first_name, surname, other_names, created_at FROM live_session_user($1)", sessionID,
	).Scan(&u.ID, &u.Phone, &u.FirstName, &u.Surname, &u.OtherNames, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrInvalidSession
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func CreateSession(ctx context.Context, pool *pgxpool.Pool, sessionID, userID uuid.UUID, tokenHash string, expiresAt time.Time) error {
	var id uuid.UUID
	err := pool.QueryRow(
		ctx, "SELECT create_session($1, $2, $3, $4)", sessionID, userID, tokenHash, expiresAt,
	).Scan(&id)
	return err
}

func AuthenticateSession(ctx context.Context, pool *pgxpool.Pool, sessionID uuid.UUID, tokenHash string) (*types.UserRow, error) {
	var u types.UserRow
	err := pool.QueryRow(
		ctx, "SELECT id, phone, first_name, surname, other_names, created_at FROM authenticate_session($1, $2)", sessionID, tokenHash,
	).Scan(&u.ID, &u.Phone, &u.FirstName, &u.Surname, &u.OtherNames, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrInvalidSession
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func RotateSession(ctx context.Context, pool *pgxpool.Pool, sessionID uuid.UUID, tokenHash string) error {
	var rotated bool
	if err := pool.QueryRow(ctx, "SELECT rotate_session($1, $2)", sessionID, tokenHash).Scan(&rotated); err != nil {
		return err
	}
	if !rotated {
		return ErrInvalidSession
	}
	return nil
}

func RevokeSession(ctx context.Context, pool *pgxpool.Pool, sessionID uuid.UUID) error {
	_, err := pool.Exec(ctx, "SELECT revoke_session($1)", sessionID)
	return err
}

func RevokeAllSessions(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) error {
	_, err := pool.Exec(ctx, "SELECT revoke_sessions_for_user($1)", userID)
	return err
}

func SetPassword(ctx context.Context, pool *pgxpool.Pool, phone, passwordHash string) error {
	_, err := pool.Exec(ctx, "SELECT set_password($1, $2)", phone, passwordHash)
	return err
}
