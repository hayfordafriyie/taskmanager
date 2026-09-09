package db

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrPhoneNotVerified = errors.New("phone number is not verified")

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

// LatestOTPTime returns when the most recent OTP was issued. ok is false
// when no OTP has ever been requested for the phone.
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

type UserRow struct {
	ID         uuid.UUID
	Phone      string
	FirstName  string
	Surname    string
	OtherNames *string
	CreatedAt  time.Time
}

func CreateUser(
	ctx context.Context,
	pool *pgxpool.Pool,
	phone, firstName, surname, otherNames, passwordHash string,
) (*UserRow, error) {
	var u UserRow
	err := pool.QueryRow(
		ctx,
		"SELECT id, phone, first_name, surname, other_names, created_at FROM create_user($1, $2, $3, $4, $5)",
		phone, firstName, surname, otherNames, passwordHash,
	).Scan(&u.ID, &u.Phone, &u.FirstName, &u.Surname, &u.OtherNames, &u.CreatedAt)
	if err != nil {
		const errCodePhoneNotVerified = "45001"
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == errCodePhoneNotVerified {
			return nil, ErrPhoneNotVerified
		}
		return nil, err
	}
	return &u, nil
}