// Package cache is a tiny Redis-backed cache with graceful degradation.
//
// It speaks the Redis protocol directly over TCP (no third-party dependency),
// so the backend keeps building and running even where Redis isn't reachable —
// in that case every operation becomes a no-op.
//
// Invalidation is epoch-based: all keys are namespaced by a version counter
// (`tm:ver`). Bumping it with INCR instantly invalidates every cached entry for
// every backend replica, without scanning keys.
package cache

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	versionKey   = "tm:ver"
	opTimeout    = 750 * time.Millisecond
	versionTTL   = time.Second
	defaultTTL   = 30 * time.Second
	dialTimeout  = 2 * time.Second
	statsLogTime = 10 * time.Minute
)

// Cache is a small Redis client wrapper. The zero value is a disabled cache.
type Cache struct {
	mu      sync.Mutex
	conn    net.Conn
	reader  *bufio.Reader
	enabled bool
	reason  string

	memoVer int64
	memoAt  time.Time

	hits   int64
	misses int64
}

// FromEnv builds a cache from REDIS_URL (redis://[:password@]host:port/db) or
// REDIS_ADDR. It never fails: if Redis is unavailable the cache is disabled.
func FromEnv() *Cache {
	raw := strings.TrimSpace(os.Getenv("REDIS_URL"))
	if raw == "" {
		if addr := strings.TrimSpace(os.Getenv("REDIS_ADDR")); addr != "" {
			raw = "redis://" + addr
		}
	}
	if raw == "" {
		return &Cache{reason: "REDIS_URL/REDIS_ADDR not set"}
	}

	c := &Cache{}
	if err := c.connect(raw); err != nil {
		c.reason = err.Error()
		log.Printf("cache: redis disabled (%v)", err)
		return c
	}
	c.enabled = true
	log.Printf("cache: redis enabled at %s", raw)
	return c
}

func (c *Cache) connect(raw string) error {
	addr := raw
	password := ""
	db := ""

	if u, err := url.Parse(raw); err == nil && u.Scheme != "" {
		addr = u.Host
		if u.User != nil {
			password, _ = u.User.Password()
		}
		if p := strings.TrimPrefix(u.Path, "/"); p != "" {
			db = p
		}
	}
	if !strings.Contains(addr, ":") {
		addr += ":6379"
	}

	conn, err := net.DialTimeout("tcp", addr, dialTimeout)
	if err != nil {
		return fmt.Errorf("dial %s: %w", addr, err)
	}
	c.conn = conn
	c.reader = bufio.NewReader(conn)

	if password != "" {
		if _, err := c.do("AUTH", password); err != nil {
			_ = conn.Close()
			return fmt.Errorf("auth: %w", err)
		}
	}
	if db != "" && db != "0" {
		if _, err := c.do("SELECT", db); err != nil {
			_ = conn.Close()
			return fmt.Errorf("select db %s: %w", db, err)
		}
	}
	if _, err := c.do("PING"); err != nil {
		_ = conn.Close()
		return fmt.Errorf("ping: %w", err)
	}
	return nil
}

// Enabled reports whether Redis is reachable (and caching is active).
func (c *Cache) Enabled() bool { return c != nil && c.enabled }

// Reason explains why caching is disabled (for logs/diagnostics).
func (c *Cache) Reason() string {
	if c == nil {
		return "nil cache"
	}
	return c.reason
}

// Keyspace returns the current version prefix, used in diagnostics/tests.
func (c *Cache) Keyspace(ctx context.Context) string {
	return fmt.Sprintf("tm:%d", c.version(ctx))
}

// Get reads a cached value. Returns ok=false on miss or when disabled.
func (c *Cache) Get(ctx context.Context, key string) ([]byte, bool) {
	if !c.Enabled() {
		return nil, false
	}
	full := c.buildKey(ctx, key)
	val, isNil, err := c.get(full)
	if err != nil || isNil {
		c.count(false)
		return nil, false
	}
	c.count(true)
	return []byte(val), true
}

// Set stores a value with a TTL (<=0 uses the default).
func (c *Cache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) {
	if !c.Enabled() {
		return
	}
	if ttl <= 0 {
		ttl = defaultTTL
	}
	full := c.buildKey(ctx, key)
	if _, err := c.do("SET", full, string(value), "EX", strconv.Itoa(int(ttl.Seconds()))); err != nil {
		c.disable(err)
	}
}

// Invalidate bumps the version counter, invalidating every cached entry. It is
// called after any GraphQL mutation. Failures only disable the cache; they never
// break the request.
func (c *Cache) Invalidate(ctx context.Context) {
	if !c.Enabled() {
		return
	}
	if _, err := c.do("INCR", versionKey); err != nil {
		c.disable(err)
		return
	}
	c.mu.Lock()
	c.memoAt = time.Time{}
	c.mu.Unlock()
}

// Stats returns hit/miss counters (diagnostics).
func (c *Cache) Stats() (hits, misses int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.hits, c.misses
}

func (c *Cache) count(hit bool) {
	c.mu.Lock()
	if hit {
		c.hits++
	} else {
		c.misses++
	}
	c.mu.Unlock()
}

func (c *Cache) buildKey(ctx context.Context, key string) string {
	return fmt.Sprintf("tm:%d:%s", c.version(ctx), key)
}

// version returns the current cache epoch, memoised briefly to avoid a Redis
// round-trip on every key.
func (c *Cache) version(ctx context.Context) int64 {
	c.mu.Lock()
	if time.Since(c.memoAt) < versionTTL {
		v := c.memoVer
		c.mu.Unlock()
		return v
	}
	c.mu.Unlock()

	val, _, err := c.get(versionKey)
	if err != nil {
		return 0
	}
	if val == "" {
		return 0
	}
	v, err := strconv.ParseInt(val, 10, 64)
	if err != nil {
		return 0
	}

	c.mu.Lock()
	c.memoVer = v
	c.memoAt = time.Now()
	c.mu.Unlock()
	return v
}

func (c *Cache) disable(err error) {
	c.mu.Lock()
	wasEnabled := c.enabled
	c.enabled = false
	c.reason = err.Error()
	conn := c.conn
	c.conn = nil
	c.mu.Unlock()
	if wasEnabled {
		log.Printf("cache: redis disabled after error (%v)", err)
	}
	if conn != nil {
		_ = conn.Close()
	}
}

// --- minimal RESP client -------------------------------------------------

func (c *Cache) get(key string) (value string, isNil bool, err error) {
	reply, err := c.do("GET", key)
	if err != nil {
		return "", false, err
	}
	if reply.nil {
		return "", true, nil
	}
	return reply.val, false, nil
}

type respReply struct {
	val  string
	nil  bool
	kind byte
}

func (c *Cache) do(args ...string) (respReply, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn == nil {
		return respReply{}, fmt.Errorf("cache connection is not available")
	}

	var sb strings.Builder
	sb.WriteString("*")
	sb.WriteString(strconv.Itoa(len(args)))
	sb.WriteString("\r\n")
	for _, a := range args {
		sb.WriteString("$")
		sb.WriteString(strconv.Itoa(len(a)))
		sb.WriteString("\r\n")
		sb.WriteString(a)
		sb.WriteString("\r\n")
	}

	_ = c.conn.SetDeadline(time.Now().Add(opTimeout))
	if _, err := c.conn.Write([]byte(sb.String())); err != nil {
		return respReply{}, err
	}
	return c.readReply()
}

func (c *Cache) readReply() (respReply, error) {
	line, err := c.readLine()
	if err != nil {
		return respReply{}, err
	}
	if line == "" {
		return respReply{}, fmt.Errorf("empty reply")
	}
	kind := line[0]
	body := line[1:]

	switch kind {
	case '+':
		return respReply{val: body, kind: kind}, nil
	case '-':
		return respReply{}, fmt.Errorf("redis error: %s", body)
	case ':':
		return respReply{val: body, kind: kind}, nil
	case '$':
		n, err := strconv.Atoi(body)
		if err != nil {
			return respReply{}, fmt.Errorf("bad bulk length %q", body)
		}
		if n < 0 {
			return respReply{nil: true, kind: kind}, nil
		}
		buf := make([]byte, n+2)
		if _, err := readFull(c.reader, buf); err != nil {
			return respReply{}, err
		}
		return respReply{val: string(buf[:n]), kind: kind}, nil
	case '*':
		n, err := strconv.Atoi(body)
		if err != nil {
			return respReply{}, fmt.Errorf("bad array length %q", body)
		}
		if n < 0 {
			return respReply{nil: true, kind: kind}, nil
		}
		var last respReply
		for i := 0; i < n; i++ {
			item, err := c.readReply()
			if err != nil {
				return respReply{}, err
			}
			last = item
		}
		return last, nil
	default:
		return respReply{}, fmt.Errorf("unexpected reply type %q", string(kind))
	}
}

func (c *Cache) readLine() (string, error) {
	line, err := c.reader.ReadString('\n')
	if err != nil {
		return "", err
	}
	return strings.TrimRight(line, "\r\n"), nil
}

func readFull(r *bufio.Reader, buf []byte) (int, error) {
	total := 0
	for total < len(buf) {
		n, err := r.Read(buf[total:])
		total += n
		if err != nil {
			return total, err
		}
	}
	return total, nil
}
