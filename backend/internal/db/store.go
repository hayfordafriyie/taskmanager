package db

import (
	"context"
	"errors"
	"time"

	"taskmanager/types"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrPhoneNotVerified       = errors.New("phone number is not verified")
	ErrPhoneAlreadyRegistered = errors.New("phone number is already registered")
	ErrUserNotFound           = errors.New("user not found")
	ErrInvalidSession         = errors.New("invalid or expired session")
)

func RequestOTP(
	ctx context.Context,
	pool *pgxpool.Pool,
	phone, purpose, otpHash string,
	expiresAt time.Time,
) (uuid.UUID, error) {
	var id uuid.UUID
	err := pool.QueryRow(
		ctx, "SELECT request_otp($1, $2, $3, $4)", phone, purpose, otpHash, expiresAt,
	).Scan(&id)
	return id, err
}

func LatestOTPTime(
	ctx context.Context,
	pool *pgxpool.Pool,
	phone, purpose string,
) (t time.Time, ok bool, err error) {
	var nullable *time.Time
	if err := pool.QueryRow(
		ctx, "SELECT latest_otp_time($1, $2)", phone, purpose,
	).Scan(&nullable); err != nil {
		return time.Time{}, false, err
	}
	if nullable == nil {
		return time.Time{}, false, nil
	}
	return *nullable, true, nil
}

func VerifyOTP(
	ctx context.Context,
	pool *pgxpool.Pool,
	phone, purpose, code string,
) (valid bool, reason string, err error) {
	err = pool.QueryRow(
		ctx, "SELECT valid, reason FROM verify_otp($1, $2, $3)", phone, purpose, code,
	).Scan(&valid, &reason)
	return valid, reason, err
}

func PhoneRegistered(
	ctx context.Context,
	pool *pgxpool.Pool,
	phone string,
) (bool, error) {
	var registered bool
	if err := pool.QueryRow(
		ctx, "SELECT phone_registered($1)", phone,
	).Scan(&registered); err != nil {
		return false, err
	}
	return registered, nil
}

func CreateUser(
	ctx context.Context,
	pool *pgxpool.Pool,
	phone, firstName, surname, otherNames, passwordHash string,
) (*types.UserRow, error) {
	var u types.UserRow
	err := pool.QueryRow(
		ctx,
		"SELECT id, phone, first_name, surname, other_names, created_at FROM create_user($1, $2, $3, $4, $5)",
		phone, firstName, surname, otherNames, passwordHash,
	).Scan(&u.ID, &u.Phone, &u.FirstName, &u.Surname, &u.OtherNames, &u.CreatedAt)
	if err != nil {
		const (
			errCodePhoneNotVerified = "45001"
			errCodePhoneRegistered  = "45002"
			errCodeDuplicatePhone   = "23505"
		)
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			switch pgErr.Code {
			case errCodePhoneNotVerified:
				return nil, ErrPhoneNotVerified
			case errCodePhoneRegistered, errCodeDuplicatePhone:
				return nil, ErrPhoneAlreadyRegistered
			}
		}
		return nil, err
	}
	return &u, nil
}
