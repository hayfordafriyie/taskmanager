package db

import (
	"context"
	"errors"

	"taskmanager/types"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotificationNotFound = errors.New("notification not found")

func mapNotificationError(err error) (error, bool) {
	pgErr, ok := err.(*pgconn.PgError)
	if !ok {
		return nil, false
	}
	switch pgErr.Code {
	case "45030":
		return ErrNotificationNotFound, true
	}
	return nil, false
}

func scanNotification(row pgxRow) (*types.NotificationRow, error) {
	var n types.NotificationRow
	if err := row.Scan(&n.ID, &n.UserID, &n.Kind, &n.Title, &n.Body, &n.TaskID, &n.Read, &n.CreatedAt); err != nil {
		return nil, err
	}
	return &n, nil
}

func CreateNotification(
	ctx context.Context,
	pool *pgxpool.Pool,
	userID uuid.UUID,
	kind, title, body string,
	taskID *uuid.UUID,
) (*types.NotificationRow, error) {
	row := pool.QueryRow(
		ctx,
		`SELECT id, user_id, kind, title, body, task_id, read, created_at
		   FROM create_notification($1, $2, $3, $4, $5)`,
		userID, kind, title, body, taskID,
	)
	n, err := scanNotification(row)
	if err != nil {
		return nil, err
	}
	return n, nil
}

func UserNotifications(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) ([]types.NotificationRow, error) {
	rows, err := pool.Query(
		ctx,
		`SELECT n_id, n_kind, n_title, n_body, n_task_id, n_read, n_created_at
		   FROM user_notifications($1)`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []types.NotificationRow
	for rows.Next() {
		var n types.NotificationRow
		n.UserID = userID
		if err := rows.Scan(&n.ID, &n.Kind, &n.Title, &n.Body, &n.TaskID, &n.Read, &n.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, n)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func UnreadNotificationCount(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (int64, error) {
	var count int64
	err := pool.QueryRow(ctx, "SELECT unread_notification_count($1)", userID).Scan(&count)
	return count, err
}

func MarkNotificationRead(ctx context.Context, pool *pgxpool.Pool, id, userID uuid.UUID) (*types.NotificationRow, error) {
	return notificationToggle(ctx, pool, "mark_notification_read", id, userID)
}

func MarkNotificationUnread(ctx context.Context, pool *pgxpool.Pool, id, userID uuid.UUID) (*types.NotificationRow, error) {
	return notificationToggle(ctx, pool, "mark_notification_unread", id, userID)
}

func notificationToggle(ctx context.Context, pool *pgxpool.Pool, fn string, id, userID uuid.UUID) (*types.NotificationRow, error) {
	row := pool.QueryRow(
		ctx,
		`SELECT id, user_id, kind, title, body, task_id, read, created_at
		   FROM `+fn+`($1, $2)`,
		id, userID,
	)
	n, err := scanNotification(row)
	if err != nil {
		if mapped, ok := mapNotificationError(err); ok {
			return nil, mapped
		}
		return nil, err
	}
	return n, nil
}

func MarkAllNotificationsRead(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (int64, error) {
	return countToggle(ctx, pool, "mark_all_notifications_read", userID)
}

func MarkAllNotificationsUnread(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (int64, error) {
	return countToggle(ctx, pool, "mark_all_notifications_unread", userID)
}

func countToggle(ctx context.Context, pool *pgxpool.Pool, fn string, userID uuid.UUID) (int64, error) {
	var count int64
	err := pool.QueryRow(ctx, "SELECT "+fn+"($1)", userID).Scan(&count)
	return count, err
}

func DeleteNotification(ctx context.Context, pool *pgxpool.Pool, id, userID uuid.UUID) (bool, error) {
	var ok bool
	err := pool.QueryRow(ctx, "SELECT delete_notification($1, $2)", id, userID).Scan(&ok)
	return ok, err
}

func DeleteNotifications(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (int64, error) {
	var count int64
	err := pool.QueryRow(ctx, "SELECT delete_notifications($1)", userID).Scan(&count)
	return count, err
}

// CreateDueReminders asks the DB to notify assignees of tasks due within the
// window (in hours) that are not done / in review. Returns how many reminders
// were created.
func CreateDueReminders(ctx context.Context, pool *pgxpool.Pool, windowHours float64) (int64, error) {
	var count int64
	err := pool.QueryRow(ctx, "SELECT create_due_reminders(now(), $1)", windowHours).Scan(&count)
	return count, err
}
