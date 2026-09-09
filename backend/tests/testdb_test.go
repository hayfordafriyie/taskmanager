package tests

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"testing"
	"time"

	"taskmanager/internal/db"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func PrepareTestDB(t *testing.T) (*pgxpool.Pool, func()) {
	t.Helper()

	ctx := context.Background()
	admin, err := pgx.Connect(ctx, db.DSN("postgres"))
	if err != nil {
		t.Skipf("skipping: postgres not reachable: %v", err)
	}

	testDB := fmt.Sprintf("taskmanager_test_%d_%s", time.Now().UnixNano(), randSuffix())
	if _, err := admin.Exec(ctx, "DROP DATABASE IF EXISTS "+quoteIdent(testDB)+" WITH (FORCE)"); err != nil {
		admin.Close(context.Background())
		t.Fatalf("drop test db: %v", err)
	}
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+quoteIdent(testDB)); err != nil {
		admin.Close(context.Background())
		t.Fatalf("create test db: %v", err)
	}

	pool, err := pgxpool.New(ctx, db.DSN(testDB))
	if err != nil {
		dropTestDB(t, admin, testDB)
		t.Fatalf("connect to test db: %v", err)
	}

	if err := db.Migrate(ctx, pool); err != nil {
		pool.Close()
		dropTestDB(t, admin, testDB)
		t.Fatalf("migrate test db: %v", err)
	}

	cleanup := func() {
		pool.Close()
		dropTestDB(t, admin, testDB)
	}

	return pool, cleanup
}

func dropTestDB(t *testing.T, admin *pgx.Conn, testDB string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if _, err := admin.Exec(ctx, "DROP DATABASE IF EXISTS "+quoteIdent(testDB)+" WITH (FORCE)"); err != nil {
		t.Logf("failed to drop test db %q: %v", testDB, err)
	}
	admin.Close(context.Background())
}

func quoteIdent(s string) string {
	return `"` + s + `"`
}

func randSuffix() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano()%100000)
	}
	return hex.EncodeToString(b)
}
