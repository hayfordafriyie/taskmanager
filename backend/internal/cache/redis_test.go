package cache

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeRedis is a tiny in-process RESP server covering the commands the cache
// uses (PING, GET, SET, INCR). It lets us verify real protocol behaviour
// without a Redis instance.
type fakeRedis struct {
	ln    net.Listener
	mu    sync.Mutex
	store map[string]string
}

func newFakeRedis(t *testing.T) *fakeRedis {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	f := &fakeRedis{ln: ln, store: map[string]string{}}
	go f.serve()
	t.Cleanup(func() { _ = ln.Close() })
	return f
}

func (f *fakeRedis) addr() string { return f.ln.Addr().String() }

func (f *fakeRedis) serve() {
	for {
		conn, err := f.ln.Accept()
		if err != nil {
			return
		}
		go f.handle(conn)
	}
}

func (f *fakeRedis) handle(conn net.Conn) {
	defer conn.Close()
	r := bufio.NewReader(conn)
	for {
		args, err := readCommand(r)
		if err != nil {
			return
		}
		if len(args) == 0 {
			continue
		}
		cmd := strings.ToUpper(args[0])
		switch cmd {
		case "PING":
			fmt.Fprint(conn, "+PONG\r\n")
		case "AUTH", "SELECT":
			fmt.Fprint(conn, "+OK\r\n")
		case "SET":
			f.mu.Lock()
			f.store[args[1]] = args[2]
			f.mu.Unlock()
			fmt.Fprint(conn, "+OK\r\n")
		case "GET":
			f.mu.Lock()
			v, ok := f.store[args[1]]
			f.mu.Unlock()
			if !ok {
				fmt.Fprint(conn, "$-1\r\n")
				continue
			}
			fmt.Fprintf(conn, "$%d\r\n%s\r\n", len(v), v)
		case "INCR":
			f.mu.Lock()
			cur, _ := strconv.Atoi(f.store[args[1]])
			cur++
			f.store[args[1]] = strconv.Itoa(cur)
			f.mu.Unlock()
			fmt.Fprintf(conn, ":%d\r\n", cur)
		default:
			fmt.Fprint(conn, "-ERR unknown command\r\n")
		}
	}
}

func readCommand(r *bufio.Reader) ([]string, error) {
	line, err := r.ReadString('\n')
	if err != nil {
		return nil, err
	}
	line = strings.TrimRight(line, "\r\n")
	if !strings.HasPrefix(line, "*") {
		// inline command
		return strings.Fields(line), nil
	}
	n, err := strconv.Atoi(line[1:])
	if err != nil {
		return nil, err
	}
	args := make([]string, 0, n)
	for i := 0; i < n; i++ {
		head, err := r.ReadString('\n')
		if err != nil {
			return nil, err
		}
		head = strings.TrimRight(head, "\r\n")
		if !strings.HasPrefix(head, "$") {
			return nil, fmt.Errorf("expected bulk string, got %q", head)
		}
		size, err := strconv.Atoi(head[1:])
		if err != nil {
			return nil, err
		}
		buf := make([]byte, size+2)
		if _, err := ioReadFull(r, buf); err != nil {
			return nil, err
		}
		args = append(args, string(buf[:size]))
	}
	return args, nil
}

func ioReadFull(r *bufio.Reader, buf []byte) (int, error) {
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

func TestDisabledCacheIsANoOp(t *testing.T) {
	t.Setenv("REDIS_URL", "")
	t.Setenv("REDIS_ADDR", "")

	c := FromEnv()
	if c.Enabled() {
		t.Fatalf("cache should be disabled without REDIS_URL")
	}
	if _, ok := c.Get(context.Background(), "anything"); ok {
		t.Fatalf("disabled cache must always miss")
	}
	// These must not panic or block when disabled.
	c.Set(context.Background(), "k", []byte("v"), time.Second)
	c.Invalidate(context.Background())
}

func TestCacheRoundTripAgainstFakeRedis(t *testing.T) {
	fake := newFakeRedis(t)
	t.Setenv("REDIS_URL", "redis://"+fake.addr())
	t.Setenv("REDIS_ADDR", "")

	c := FromEnv()
	if !c.Enabled() {
		t.Fatalf("cache should be enabled: %s", c.Reason())
	}

	ctx := context.Background()
	c.Set(ctx, "tasks:team-1", []byte(`{"a":1}`), time.Minute)

	got, ok := c.Get(ctx, "tasks:team-1")
	if !ok {
		t.Fatalf("expected a cache hit after Set")
	}
	if string(got) != `{"a":1}` {
		t.Fatalf("unexpected cached value %q", string(got))
	}

	if _, ok := c.Get(ctx, "tasks:missing"); ok {
		t.Fatalf("expected a miss for an unknown key")
	}

	hits, misses := c.Stats()
	if hits != 1 || misses != 1 {
		t.Fatalf("unexpected stats hits=%d misses=%d", hits, misses)
	}
}

func TestInvalidateBumpsEpochAndDropsEntries(t *testing.T) {
	fake := newFakeRedis(t)
	t.Setenv("REDIS_URL", "redis://"+fake.addr())
	t.Setenv("REDIS_ADDR", "")

	c := FromEnv()
	if !c.Enabled() {
		t.Fatalf("cache should be enabled: %s", c.Reason())
	}

	ctx := context.Background()
	c.Set(ctx, "dashboard:u1", []byte(`{"x":1}`), time.Minute)
	if _, ok := c.Get(ctx, "dashboard:u1"); !ok {
		t.Fatalf("expected the entry to be cached before invalidation")
	}

	// Any mutation invalidates the whole cache.
	c.Invalidate(ctx)

	if _, ok := c.Get(ctx, "dashboard:u1"); ok {
		t.Fatalf("entry must be gone after Invalidate (epoch bumped)")
	}

	// New writes land under the new epoch and are readable again.
	c.Set(ctx, "dashboard:u1", []byte(`{"x":2}`), time.Minute)
	got, ok := c.Get(ctx, "dashboard:u1")
	if !ok || string(got) != `{"x":2}` {
		t.Fatalf("expected the refreshed value, got %q ok=%v", string(got), ok)
	}
}
