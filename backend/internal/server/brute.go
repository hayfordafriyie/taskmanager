package server

import (
	"sync"
	"time"
)

type BruteProtector struct {
	mu       sync.Mutex
	max      int
	window   time.Duration
	attempts map[string][]time.Time
	lastSeen map[string]time.Time
}

func NewBruteProtector(max int, window time.Duration) *BruteProtector {
	return &BruteProtector{
		max:      max,
		window:   window,
		attempts: make(map[string][]time.Time),
		lastSeen: make(map[string]time.Time),
	}
}

func (b *BruteProtector) Allow(key string) bool {
	now := time.Now()
	b.mu.Lock()
	defer b.mu.Unlock()

	cutoff := now.Add(-b.window)
	recent := b.attempts[key][:0]
	for _, t := range b.attempts[key] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}
	if len(recent) >= b.max {
		b.attempts[key] = recent
		b.lastSeen[key] = now
		return false
	}
	b.attempts[key] = append(recent, now)
	b.lastSeen[key] = now
	b.gcLocked(now)
	return true
}

func (b *BruteProtector) Reset(key string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.attempts, key)
	delete(b.lastSeen, key)
}

func (b *BruteProtector) gcLocked(now time.Time) {
	if len(b.lastSeen) < 1024 {
		return
	}
	cutoff := now.Add(-b.window)
	for k, t := range b.lastSeen {
		if t.Before(cutoff) {
			delete(b.attempts, k)
			delete(b.lastSeen, k)
		}
	}
}
