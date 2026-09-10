package graph

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"time"
)

// cacheTTL is how long read results stay cached; every mutation bumps the cache
// epoch, so entries rarely live this long in an active workspace.
const cacheTTL = 30 * time.Second

// CacheKey derives a stable key for a GraphQL operation. It includes the raw
// query text, the variables and the caller's bearer token, so different
// selection sets, variables or users never share an entry.
func (r *Resolver) CacheKey(rawQuery, variablesJSON, bearerToken string) string {
	h := sha256.Sum256([]byte(rawQuery + "|" + variablesJSON + "|" + bearerToken))
	return "gql:" + hex.EncodeToString(h[:])
}

// CacheGetRaw returns a cached GraphQL response body.
func (r *Resolver) CacheGetRaw(ctx context.Context, key string) ([]byte, bool) {
	if r.Cache == nil || !r.Cache.Enabled() {
		return nil, false
	}
	return r.Cache.Get(ctx, key)
}

// CacheSetRaw stores a GraphQL response body.
func (r *Resolver) CacheSetRaw(ctx context.Context, key string, data []byte) {
	if r.Cache == nil || !r.Cache.Enabled() || len(data) == 0 {
		return
	}
	r.Cache.Set(ctx, key, data, cacheTTL)
}

// VariablesKey renders operation variables deterministically for cache keys.
func VariablesKey(vars map[string]any) string {
	if len(vars) == 0 {
		return ""
	}
	raw, err := json.Marshal(vars)
	if err != nil {
		return ""
	}
	return string(raw)
}

// cacheGetJSON loads a cached JSON payload into out. Returns true on a hit.
func (r *Resolver) cacheGetJSON(ctx context.Context, key string, out any) bool {
	if r.Cache == nil || !r.Cache.Enabled() {
		return false
	}
	raw, ok := r.Cache.Get(ctx, key)
	if !ok || len(raw) == 0 {
		return false
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return false
	}
	return true
}

// cacheSetJSON stores a JSON payload. Failures are ignored (cache is best-effort).
func (r *Resolver) cacheSetJSON(ctx context.Context, key string, value any) {
	if r.Cache == nil || !r.Cache.Enabled() {
		return
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return
	}
	r.Cache.Set(ctx, key, raw, cacheTTL)
}

// InvalidateCache bumps the cache epoch. It is called after every GraphQL
// mutation so no stale read survives a write.
func (r *Resolver) InvalidateCache(ctx context.Context) {
	if r.Cache == nil {
		return
	}
	r.Cache.Invalidate(ctx)
}

// CacheEnabled reports whether the Redis cache is active (used by middleware).
func (r *Resolver) CacheEnabled() bool {
	return r.Cache != nil && r.Cache.Enabled()
}
