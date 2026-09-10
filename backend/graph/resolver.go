package graph

import (
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"taskmanager/internal/cache"
	"taskmanager/internal/notif"
	"taskmanager/internal/realtime"
	"taskmanager/internal/server"
)

const (
	brutePhoneMax    = 5
	brutePhoneWindow = time.Minute
	bruteIPMax       = 20
	bruteIPWindow    = time.Minute
)

type Resolver struct {
	Pool       *pgxpool.Pool
	SMSQueue   *notif.Worker
	Realtime   *realtime.Hub
	Cache      *cache.Cache
	brutePhone *server.BruteProtector
	bruteIP    *server.BruteProtector
}

func NewResolver(pool *pgxpool.Pool, smsQueue *notif.Worker) *Resolver {
	if smsQueue == nil {
		smsQueue = notif.NewWorker(notif.SenderFunc(notif.SendSMSPayload), 1, 100, nil)
	}
	return &Resolver{
		Pool:       pool,
		SMSQueue:   smsQueue,
		Realtime:   realtime.NewHub(),
		Cache:      cache.FromEnv(),
		brutePhone: server.NewBruteProtector(brutePhoneMax, brutePhoneWindow),
		bruteIP:    server.NewBruteProtector(bruteIPMax, bruteIPWindow),
	}
}
