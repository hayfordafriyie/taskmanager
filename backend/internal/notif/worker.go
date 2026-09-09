package notif

import (
	"errors"
	"log"
	"sync"

	"taskmanager/types"
)

// Sender delivers a single SMS payload. SendSMSPayload satisfies this
// interface.
type Sender interface {
	SendSMSPayload(payload types.SMSPayload, senderID string) (float64, error)
}

// SenderFunc adapts a function to the Sender interface.
type SenderFunc func(payload types.SMSPayload, senderID string) (float64, error)

func (f SenderFunc) SendSMSPayload(payload types.SMSPayload, senderID string) (float64, error) {
	return f(payload, senderID)
}

// Worker delivers queued SMS payloads in the background so callers never
// block on the network. A non-blocking Enqueue lets the caller fire-and-forget;
// delivery failures and dropped messages are reported through an optional
// onError hook (or the package logger when it is nil).
type Worker struct {
	queue   chan types.SMSJob
	send    Sender
	onError func(error)
	done    chan struct{}
	once    sync.Once
	wg      sync.WaitGroup
}

// NewWorker starts n goroutines that deliver queued messages. The queue holds
// up to queueSize waiting messages; anything beyond that is dropped and
// reported via onError. n and queueSize default to 1 when <= 0.
func NewWorker(send Sender, n, queueSize int, onError func(error)) *Worker {
	if n < 1 {
		n = 1
	}
	if queueSize < 1 {
		queueSize = 1
	}
	w := &Worker{
		queue:   make(chan types.SMSJob, queueSize),
		send:    send,
		onError: onError,
		done:    make(chan struct{}),
	}
	for i := 0; i < n; i++ {
		w.wg.Add(1)
		go w.run()
	}
	return w
}

// Enqueue queues a message without blocking the caller. It returns false and
// reports an error via onError when the queue is full or the worker is
// shutting down.
func (w *Worker) Enqueue(payload types.SMSPayload, senderID string) bool {
	j := types.SMSJob{Payload: payload, SenderID: senderID}
	select {
	case w.queue <- j:
		return true
	case <-w.done:
		return false
	default:
		w.reportError(errors.New("sms queue is full, message dropped"))
		return false
	}
}

// Close stops accepting new messages and waits for any already queued
// messages to be delivered.
func (w *Worker) Close() {
	w.once.Do(func() {
		close(w.done)
		w.wg.Wait()
	})
}

func (w *Worker) run() {
	defer w.wg.Done()
	for {
		select {
		case j := <-w.queue:
			w.sendJob(j)
		case <-w.done:
			for {
				select {
				case j := <-w.queue:
					w.sendJob(j)
				default:
					return
				}
			}
		}
	}
}

func (w *Worker) sendJob(j types.SMSJob) {
	if _, err := w.send.SendSMSPayload(j.Payload, j.SenderID); err != nil {
		w.reportError(err)
	}
}

func (w *Worker) reportError(err error) {
	if w.onError != nil {
		w.onError(err)
		return
	}
	log.Printf("sms worker: %v", err)
}