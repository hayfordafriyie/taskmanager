package tests

import (
	"context"
	"errors"
	"testing"
	"time"

	"taskmanager/internal/db"
	"taskmanager/internal/otp"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

func TestConnect(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx)
	if err != nil {
		t.Skipf("skipping: database not reachable: %v", err)
	}
	pool.Close()
}

func TestMigrateIdempotent(t *testing.T) {
	pool, cleanup := PrepareTestDB(t)
	defer cleanup()

	if err := db.Migrate(context.Background(), pool); err != nil {
		t.Fatalf("second migration should succeed, got %v", err)
	}
}

func TestRequestOTPAndLatestOTPTime(t *testing.T) {
	pool, cleanup := PrepareTestDB(t)
	defer cleanup()

	ctx := context.Background()
	phone := "+233537144161"

	if _, ok, err := db.LatestOTPTime(ctx, pool, phone, "register"); err != nil {
		t.Fatalf("LatestOTPTime: %v", err)
	} else if ok {
		t.Fatal("expected ok=false before any OTP")
	}

	code, codeHash, err := otp.Generate()
	if err != nil {
		t.Fatal(err)
	}
	expiresAt := time.Now().Add(otp.DefaultTTL)

	id, err := db.RequestOTP(ctx, pool, phone, "register", codeHash, expiresAt)
	if err != nil {
		t.Fatalf("RequestOTP: %v", err)
	}
	if id == (uuid.UUID{}) {
		t.Fatal("expected non-empty id")
	}

	last, ok, err := db.LatestOTPTime(ctx, pool, phone, "register")
	if err != nil {
		t.Fatalf("LatestOTPTime after request: %v", err)
	}
	if !ok {
		t.Fatal("expected ok=true after request")
	}
	if time.Since(last).Abs() > 30*time.Second {
		t.Fatalf("latest otp time too far in the past: %v", last)
	}
	if code == "" {
		t.Fatal("code must not be empty")
	}
}

func TestVerifyOTPFailures(t *testing.T) {
	pool, cleanup := PrepareTestDB(t)
	defer cleanup()

	ctx := context.Background()
	phone := "+233537144161"
	_, codeHash, _ := otp.Generate()

	if _, err := db.RequestOTP(ctx, pool, phone, "register", codeHash, time.Now().Add(otp.DefaultTTL)); err != nil {
		t.Fatal(err)
	}

	valid, reason, err := db.VerifyOTP(ctx, pool, phone, "register", "999999")
	if err != nil {
		t.Fatal(err)
	}
	if valid || reason != "invalid_code" {
		t.Errorf("expected invalid_code, got valid=%v reason=%s", valid, reason)
	}

	for range 4 {
		db.VerifyOTP(ctx, pool, phone, "register", "000000")
	}
	valid, reason, _ = db.VerifyOTP(ctx, pool, phone, "register", "000000")
	if valid || reason != "too_many_attempts" {
		t.Errorf("expected too_many_attempts after 5 tries, got %s", reason)
	}
}

func TestVerifyOTPSucceedsOnce(t *testing.T) {
	pool, cleanup := PrepareTestDB(t)
	defer cleanup()

	ctx := context.Background()
	phone := "+233537144161"
	code, codeHash, _ := otp.Generate()

	if _, err := db.RequestOTP(ctx, pool, phone, "register", codeHash, time.Now().Add(otp.DefaultTTL)); err != nil {
		t.Fatal(err)
	}

	valid, reason, err := db.VerifyOTP(ctx, pool, phone, "register", code)
	if err != nil {
		t.Fatal(err)
	}
	if !valid || reason != "ok" {
		t.Fatalf("expected valid ok, got valid=%v reason=%s", valid, reason)
	}

	valid, reason, _ = db.VerifyOTP(ctx, pool, phone, "register", code)
	if valid || reason != "no_active_otp" {
		t.Errorf("expected single use to consume otp, got valid=%v reason=%s", valid, reason)
	}
}

func TestVerifyOTPUnknownPhone(t *testing.T) {
	pool, cleanup := PrepareTestDB(t)
	defer cleanup()

	valid, reason, _ := db.VerifyOTP(context.Background(), pool, "+233537144161", "register", "123456")
	if valid || reason != "no_active_otp" {
		t.Errorf("expected no_active_otp, got valid=%v reason=%s", valid, reason)
	}
}

func TestCreateUserRequiresVerification(t *testing.T) {
	pool, cleanup := PrepareTestDB(t)
	defer cleanup()

	ctx := context.Background()
	hash, _ := bcrypt.GenerateFromPassword([]byte("StrongPass1!"), bcrypt.DefaultCost)

	_, err := db.CreateUser(ctx, pool, "+233537144161", "Kojo", "Asante", "", string(hash))
	if !errors.Is(err, db.ErrPhoneNotVerified) {
		t.Fatalf("expected ErrPhoneNotVerified, got %v", err)
	}
}

func TestCreateUserHappyPath(t *testing.T) {
	pool, cleanup := PrepareTestDB(t)
	defer cleanup()

	ctx := context.Background()
	phone := "+233537144161"
	code, codeHash, _ := otp.Generate()

	if _, err := db.RequestOTP(ctx, pool, phone, "register", codeHash, time.Now().Add(otp.DefaultTTL)); err != nil {
		t.Fatal(err)
	}
	if valid, _, _ := db.VerifyOTP(ctx, pool, phone, "register", code); !valid {
		t.Fatal("preconditions failed: could not verify otp")
	}

	passwordHash, _ := bcrypt.GenerateFromPassword([]byte("StrongPass1!"), bcrypt.DefaultCost)
	otherNames := "Nana"
	user, err := db.CreateUser(ctx, pool, phone, "Kojo", "Asante", otherNames, string(passwordHash))
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	if user.Phone != phone || user.FirstName != "Kojo" || user.Surname != "Asante" {
		t.Errorf("unexpected user row: %+v", user)
	}
	if user.OtherNames == nil || *user.OtherNames != otherNames {
		t.Errorf("expected other names %q, got %v", otherNames, user.OtherNames)
	}
}

func TestCreateUserDuplicatePhone(t *testing.T) {
	pool, cleanup := PrepareTestDB(t)
	defer cleanup()

	ctx := context.Background()
	phone := "+233537144161"
	if _, err := registerUser(ctx, pool, phone); err != nil {
		t.Fatal(err)
	}

	code2, hash2, _ := otp.Generate()
	db.RequestOTP(ctx, pool, phone, "register", hash2, time.Now().Add(otp.DefaultTTL))
	db.VerifyOTP(ctx, pool, phone, "register", code2)

	passwordHash, _ := bcrypt.GenerateFromPassword([]byte("StrongPass1!"), bcrypt.DefaultCost)
	_, err := db.CreateUser(ctx, pool, phone, "Ama", "Mensah", "", string(passwordHash))
	if !errors.Is(err, db.ErrPhoneAlreadyRegistered) {
		t.Fatalf("expected ErrPhoneAlreadyRegistered, got %v", err)
	}

	count, err := countUsers(ctx, pool)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected exactly 1 user, got %d", count)
	}
}

func TestPhoneRegistered(t *testing.T) {
	pool, cleanup := PrepareTestDB(t)
	defer cleanup()

	ctx := context.Background()
	phone := "+233537144161"

	registered, err := db.PhoneRegistered(ctx, pool, phone)
	if err != nil {
		t.Fatalf("PhoneRegistered: %v", err)
	}
	if registered {
		t.Fatal("expected not registered before creating user")
	}

	if _, err := registerUser(ctx, pool, phone); err != nil {
		t.Fatal(err)
	}

	registered, err = db.PhoneRegistered(ctx, pool, phone)
	if err != nil {
		t.Fatal(err)
	}
	if !registered {
		t.Fatal("expected registered after creating user")
	}
}

func registerUser(ctx context.Context, pool *pgxpool.Pool, phone string) (*db.UserRow, error) {
	code, codeHash, _ := otp.Generate()
	if _, err := db.RequestOTP(ctx, pool, phone, "register", codeHash, time.Now().Add(otp.DefaultTTL)); err != nil {
		return nil, err
	}
	valid, _, err := db.VerifyOTP(ctx, pool, phone, "register", code)
	if err != nil {
		return nil, err
	}
	if !valid {
		return nil, errors.New("otp not verified")
	}
	passwordHash, _ := bcrypt.GenerateFromPassword([]byte("StrongPass1!"), bcrypt.DefaultCost)
	return db.CreateUser(ctx, pool, phone, "Kojo", "Asante", "", string(passwordHash))
}

func countUsers(ctx context.Context, pool *pgxpool.Pool) (int64, error) {
	var count int64
	err := pool.QueryRow(ctx, "SELECT count(*) FROM users").Scan(&count)
	return count, err
}