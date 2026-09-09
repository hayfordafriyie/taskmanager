package graph

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"taskmanager/internal/notif"
)

type Resolver struct {
	Pool     *pgxpool.Pool
	SMSQueue *notif.Worker
}

func NewResolver(pool *pgxpool.Pool, smsQueue *notif.Worker) *Resolver {
	if smsQueue == nil {
		smsQueue = notif.NewWorker(notif.SenderFunc(notif.SendSMSPayload), 1, 100, nil)
	}
	return &Resolver{Pool: pool, SMSQueue: smsQueue}
}
