package tests

import (
	"errors"
	"sync"
	"testing"
	"time"

	"taskmanager/internal/notif"
	"taskmanager/types"
)

type trackedSender struct {
	mu    sync.Mutex
	calls int
	fail  bool
}

func (s *trackedSender) SendSMSPayload(payload types.SMSPayload, senderID string) (float64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls++
	if s.fail {
		return 0, errors.New("boom")
	}
	return 1, nil
}

func (s *trackedSender) callCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.calls
}

type blockingSender struct {
	block chan struct{}
	mu    sync.Mutex
	calls int
}

func (s *blockingSender) SendSMSPayload(payload types.SMSPayload, senderID string) (float64, error) {
	s.mu.Lock()
	s.calls++
	s.mu.Unlock()
	<-s.block
	return 1, nil
}

func (s *blockingSender) callCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.calls
}

func TestWorkerDeliversAsync(t *testing.T) {
	s := &trackedSender{}
	w := notif.NewWorker(s, 2, 8, nil)
	defer w.Close()

	w.Enqueue(smsPayload(), "")
	w.Enqueue(smsPayload(), "")
	w.Enqueue(smsPayload(), "")

	waitUntil(t, 5*time.Second, func() bool {
		return s.callCount() == 3
	})
}

func TestWorkerReportsSendError(t *testing.T) {
	s := &trackedSender{fail: true}
	var mu sync.Mutex
	var got []error
	w := notif.NewWorker(s, 1, 4, func(err error) {
		mu.Lock()
		got = append(got, err)
		mu.Unlock()
	})
	defer w.Close()

	w.Enqueue(smsPayload(), "")

	waitUntil(t, 5*time.Second, func() bool {
		mu.Lock()
		defer mu.Unlock()
		return len(got) > 0
	})
}

func TestWorkerQueueFullDrops(t *testing.T) {
	s := &blockingSender{block: make(chan struct{})}
	var mu sync.Mutex
	var drops []error
	w := notif.NewWorker(s, 1, 1, func(err error) {
		mu.Lock()
		drops = append(drops, err)
		mu.Unlock()
	})
	defer func() {
		close(s.block)
		w.Close()
	}()

	w.Enqueue(smsPayload(), "")
	waitUntil(t, 5*time.Second, func() bool { return s.callCount() == 1 })

	if ok := w.Enqueue(smsPayload(), ""); !ok {
		t.Fatal("expected queue to accept second message")
	}
	if ok := w.Enqueue(smsPayload(), ""); ok {
		t.Fatal("expected queue overflow to be rejected")
	}

	waitUntil(t, 5*time.Second, func() bool {
		mu.Lock()
		defer mu.Unlock()
		return len(drops) > 0
	})
}

func TestWorkerDrainsQueuedMessagesOnClose(t *testing.T) {
	s := &trackedSender{}
	w := notif.NewWorker(s, 2, 8, nil)

	w.Enqueue(smsPayload(), "")
	w.Enqueue(smsPayload(), "")
	w.Enqueue(smsPayload(), "")
	w.Close()

	if n := s.callCount(); n != 3 {
		t.Fatalf("expected all 3 queued messages delivered on close, got %d", n)
	}
}
