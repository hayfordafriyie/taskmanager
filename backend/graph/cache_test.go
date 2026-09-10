package graph

import (
	"context"
	"testing"
)

func TestCacheKeyIsolatesUsersQueriesAndVariables(t *testing.T) {
	r := &Resolver{}

	base := r.CacheKey("query { me { id } }", "", "token-a")
	if base == "" {
		t.Fatalf("expected a key")
	}
	if again := r.CacheKey("query { me { id } }", "", "token-a"); again != base {
		t.Fatalf("same operation must produce the same key")
	}
	if other := r.CacheKey("query { me { id } }", "", "token-b"); other == base {
		t.Fatalf("different callers must not share a cache key")
	}
	if other := r.CacheKey("query { teamTasks { id } }", "", "token-a"); other == base {
		t.Fatalf("different queries must not share a cache key")
	}
	if other := r.CacheKey("query { me { id } }", `{"x":1}`, "token-a"); other == base {
		t.Fatalf("different variables must not share a cache key")
	}
}

func TestVariablesKeyIsDeterministic(t *testing.T) {
	if VariablesKey(nil) != "" {
		t.Fatalf("no variables should render empty")
	}
	a := VariablesKey(map[string]any{"id": "1"})
	b := VariablesKey(map[string]any{"id": "1"})
	if a != b || a == "" {
		t.Fatalf("variables key must be deterministic, got %q and %q", a, b)
	}
	if a == VariablesKey(map[string]any{"id": "2"}) {
		t.Fatalf("different variables must differ")
	}
}

func TestResolverWithoutRedisIsANoOp(t *testing.T) {
	r := &Resolver{}
	if r.CacheEnabled() {
		t.Fatalf("resolver without a cache must report disabled")
	}
	if _, ok := r.CacheGetRaw(context.Background(), "k"); ok {
		t.Fatalf("no cache means no hits")
	}
	// Must not panic when Redis is absent.
	r.CacheSetRaw(context.Background(), "k", []byte("v"))
	r.InvalidateCache(context.Background())
}
