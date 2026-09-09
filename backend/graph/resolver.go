package graph

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"taskmanager/internal/notif"
)

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require
// here.

type SMSSender interface {
	SendSMSPayload(payload notif.SMSPayload, senderID string) (float64, error)
}

type mnotifySender struct{}

func (mnotifySender) SendSMSPayload(payload notif.SMSPayload, senderID string) (float64, error) {
	return notif.SendSMSPayload(payload, senderID)
}

type Resolver struct {
	Pool      *pgxpool.Pool
	SMSSender SMSSender
}

func NewResolver(pool *pgxpool.Pool, smsSender SMSSender) *Resolver {
	if smsSender == nil {
		smsSender = mnotifySender{}
	}
	return &Resolver{Pool: pool, SMSSender: smsSender}
}