package notif

import (
	"errors"
	"log"
	"sync"

	"taskmanager/types"
)

type Sender interface {
	SendSMSPayload(payload types.SMSPayload, senderID string) (float64, error)
}

type SenderFunc func(payload types.SMSPayload, senderID string) (float64, error)

func (f SenderFunc) SendSMSPayload(payload types.SMSPayload, senderID string) (float64, error) {
	return f(payload, senderID)
}

type Worker struct {
	queue   chan types.SMSJob
	send    Sender
	onError func(error)
	done    chan struct{}
	once    sync.Once
	wg      sync.WaitGroup
}

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
