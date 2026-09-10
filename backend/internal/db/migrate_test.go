package db

import (
	"io/fs"
	"testing"
	"testing/fstest"
)

// readDirNames mirrors what Migrate does before parsing.
func readDirNames(fsys fs.FS) ([]fs.DirEntry, error) {
	return fs.ReadDir(fsys, ".")
}

func TestParseMigrationsReadsAndVersionsFiles(t *testing.T) {
	fsys := fstest.MapFS{
		"001_init.sql":  {Data: []byte("SELECT 1;")},
		"010_time.sql":  {Data: []byte("SELECT 3;")},
		"002_teams.sql": {Data: []byte("SELECT 2;")},
		"README.md":     {Data: []byte("not a migration")},
		"notes.txt":     {Data: []byte("ignored")},
	}
	entries, err := readDirNames(fsys)
	if err != nil {
		t.Fatalf("readDir: %v", err)
	}

	list, err := parseMigrations(fsys, entries)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list) != 3 {
		t.Fatalf("got %d migrations, want 3 (non-sql files must be skipped)", len(list))
	}
	byVersion := map[int]string{}
	for _, m := range list {
		byVersion[m.version] = m.name
	}
	if byVersion[1] != "001_init.sql" || byVersion[2] != "002_teams.sql" || byVersion[10] != "010_time.sql" {
		t.Errorf("unexpected versions parsed: %+v", byVersion)
	}
}

// Two files sharing a version silently swallowed one of them in production
// (008_chat.sql vs 008_update_task.sql left update_task missing), so the parser
// must refuse duplicates instead of quietly running only the first.
func TestParseMigrationsRejectsDuplicateVersions(t *testing.T) {
	fsys := fstest.MapFS{
		"008_chat.sql":        {Data: []byte("SELECT 1;")},
		"008_update_task.sql": {Data: []byte("SELECT 2;")},
	}
	entries, err := readDirNames(fsys)
	if err != nil {
		t.Fatalf("readDir: %v", err)
	}

	if _, err := parseMigrations(fsys, entries); err == nil {
		t.Fatal("expected an error for two migrations sharing version 8")
	}
}

func TestParseMigrationsRejectsBadPrefix(t *testing.T) {
	fsys := fstest.MapFS{
		"init.sql": {Data: []byte("SELECT 1;")},
	}
	entries, err := readDirNames(fsys)
	if err != nil {
		t.Fatalf("readDir: %v", err)
	}
	if _, err := parseMigrations(fsys, entries); err == nil {
		t.Fatal("expected an error for a migration without a version prefix")
	}
}
