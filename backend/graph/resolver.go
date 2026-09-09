package graph

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"taskmanager/internal/notif"
)

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require
// here.

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