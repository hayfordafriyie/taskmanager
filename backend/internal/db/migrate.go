package db

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations
var migrationsFS embed.FS

const migrationLockID = 7270001

func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(
		ctx,
		"CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
	); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	if _, err := pool.Exec(ctx, "SELECT pg_advisory_lock($1)", migrationLockID); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}
	defer pool.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", migrationLockID)

	entries, err := fs.ReadDir(migrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("list migrations: %w", err)
	}

	list, err := parseMigrations(entries)
	if err != nil {
		return err
	}
	sort.Slice(list, func(i, j int) bool { return list[i].version < list[j].version })

	for _, m := range list {
		err := func() error {
			var applied bool
			if err := pool.QueryRow(
				ctx, "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)", m.version,
			).Scan(&applied); err != nil {
				return fmt.Errorf("check migration %d: %w", m.version, err)
			}
			if applied {
				return nil
			}
			tx, err := pool.Begin(ctx)
			if err != nil {
				return fmt.Errorf("begin migration %d: %w", m.version, err)
			}
			if _, err := tx.Exec(ctx, m.sql); err != nil {
				_ = tx.Rollback(ctx)
				return fmt.Errorf("apply migration %d (%s): %w", m.version, m.name, err)
			}
			if _, err := tx.Exec(
				ctx, "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)", m.version, m.name,
			); err != nil {
				_ = tx.Rollback(ctx)
				return fmt.Errorf("record migration %d: %w", m.version, err)
			}
			if err := tx.Commit(ctx); err != nil {
				return fmt.Errorf("commit migration %d: %w", m.version, err)
			}
			return nil
		}()
		if err != nil {
			return err
		}
	}
	return nil
}

type migration struct {
	version int
	name    string
	sql     string
}

func parseMigrations(entries []fs.DirEntry) ([]migration, error) {
	var list []migration
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		prefix, _, ok := strings.Cut(e.Name(), "_")
		if !ok {
			return nil, fmt.Errorf("migration %q: expected version prefix like 001_", e.Name())
		}
		version, err := strconv.Atoi(prefix)
		if err != nil {
			return nil, fmt.Errorf("migration %q: invalid version prefix: %w", e.Name(), err)
		}
		content, err := migrationsFS.ReadFile("migrations/" + e.Name())
		if err != nil {
			return nil, fmt.Errorf("read migration %q: %w", e.Name(), err)
		}
		list = append(list, migration{version: version, name: e.Name(), sql: string(content)})
	}
	return list, nil
}
