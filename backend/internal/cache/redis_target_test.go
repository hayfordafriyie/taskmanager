package cache

import (
	"os"
	"testing"
)

// Regression: a Redis password containing URL-reserved characters ("/") used to
// make net/url fail, so connect() dialled the raw URL and the cache silently
// disabled itself ("too many colons in address").
func TestParseRedisTargetReservedCharsInPassword(t *testing.T) {
	t.Setenv("REDIS_PASSWORD", "")
	addr, password, db, err := parseRedisTarget("redis://:wPqSZmEn/XoyMb64gvPUXZ1lgAo26PNF@redis:6379/0")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if addr != "redis:6379" {
		t.Errorf("addr = %q, want redis:6379", addr)
	}
	if password != "wPqSZmEn/XoyMb64gvPUXZ1lgAo26PNF" {
		t.Errorf("password = %q, want the full value including the slash", password)
	}
	if db != "0" {
		t.Errorf("db = %q, want 0", db)
	}
}

func TestParseRedisTargetVariantions(t *testing.T) {
	cases := []struct {
		name, raw, addr, password, db string
	}{
		{"plain url", "redis://redis:6379/0", "redis:6379", "", "0"},
		{"password no reserved", "redis://:secret@redis:6379/1", "redis:6379", "secret", "1"},
		{"no port", "redis://redis/2", "redis:6379", "", "2"},
		{"bare host", "127.0.0.1:6379", "127.0.0.1:6379", "", ""},
		{"bare host default port", "localhost", "localhost:6379", "", ""},
		{"reserved chars", "redis://:a+b?c#d@cache:6380/3", "cache:6380", "a+b?c#d", "3"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("REDIS_PASSWORD", "")
			addr, password, db, err := parseRedisTarget(tc.raw)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if addr != tc.addr || password != tc.password || db != tc.db {
				t.Errorf("got (addr=%q pass=%q db=%q), want (addr=%q pass=%q db=%q)",
					addr, password, db, tc.addr, tc.password, tc.db)
			}
		})
	}
}

func TestParseRedisTargetExplicitPasswordWins(t *testing.T) {
	t.Setenv("REDIS_PASSWORD", "from-env")
	addr, password, db, err := parseRedisTarget("redis://:from-url@redis:6379/0")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if addr != "redis:6379" || password != "from-env" || db != "0" {
		t.Errorf("got (addr=%q pass=%q db=%q), want (addr=redis:6379 pass=from-env db=0)", addr, password, db)
	}
	os.Unsetenv("REDIS_PASSWORD")
}

func TestMaskRedisTargetHidesPassword(t *testing.T) {
	got := maskRedisTarget("redis://:wPqSZmEn/XoyMb64gvPUXZ1lgAo26PNF@redis:6379/0")
	want := "redis://:****@redis:6379/0"
	if got != want {
		t.Errorf("maskRedisTarget = %q, want %q", got, want)
	}
	if plain := maskRedisTarget("redis://redis:6379/0"); plain != "redis://redis:6379/0" {
		t.Errorf("maskRedisTarget mangled a passwordless url: %q", plain)
	}
}
