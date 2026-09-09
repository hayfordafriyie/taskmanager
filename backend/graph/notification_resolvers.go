package graph

import (
	"context"
	"fmt"

	"taskmanager/graph/model"
	"taskmanager/internal/db"
	"taskmanager/types"

	"github.com/google/uuid"
)

func toModelNotification(n *types.NotificationRow) *model.Notification {
	return &model.Notification{
		ID:        n.ID,
		Kind:      n.Kind,
		Title:     n.Title,
		Body:      n.Body,
		TaskID:    n.TaskID,
		Read:      n.Read,
		CreatedAt: n.CreatedAt,
	}
}

// Notifications is the resolver for the notifications field.
func (r *queryResolver) Notifications(ctx context.Context) ([]*model.Notification, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := db.UserNotifications(ctx, r.Pool, user.ID)
	if err != nil {
		return nil, fmt.Errorf("load notifications: %w", err)
	}
	out := make([]*model.Notification, 0, len(rows))
	for i := range rows {
		out = append(out, toModelNotification(&rows[i]))
	}
	return out, nil
}

// UnreadNotificationCount is the resolver for the unreadNotificationCount field.
func (r *queryResolver) UnreadNotificationCount(ctx context.Context) (int32, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return 0, err
	}
	count, err := db.UnreadNotificationCount(ctx, r.Pool, user.ID)
	if err != nil {
		return 0, fmt.Errorf("count notifications: %w", err)
	}
	return int32(count), nil
}

// MarkNotificationRead is the resolver for the markNotificationRead field.
func (r *mutationResolver) MarkNotificationRead(ctx context.Context, id uuid.UUID) (bool, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return false, err
	}
	_, err = db.MarkNotificationRead(ctx, r.Pool, id, user.ID)
	if err != nil {
		if err == db.ErrNotificationNotFound {
			return false, nil
		}
		return false, fmt.Errorf("mark notification read: %w", err)
	}
	return true, nil
}

// MarkNotificationUnread is the resolver for the markNotificationUnread field.
func (r *mutationResolver) MarkNotificationUnread(ctx context.Context, id uuid.UUID) (bool, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return false, err
	}
	_, err = db.MarkNotificationUnread(ctx, r.Pool, id, user.ID)
	if err != nil {
		if err == db.ErrNotificationNotFound {
			return false, nil
		}
		return false, fmt.Errorf("mark notification unread: %w", err)
	}
	return true, nil
}

// MarkAllNotificationsRead is the resolver for the markAllNotificationsRead field.
func (r *mutationResolver) MarkAllNotificationsRead(ctx context.Context) (bool, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return false, err
	}
	if _, err := db.MarkAllNotificationsRead(ctx, r.Pool, user.ID); err != nil {
		return false, fmt.Errorf("mark all notifications read: %w", err)
	}
	return true, nil
}

// MarkAllNotificationsUnread is the resolver for the markAllNotificationsUnread field.
func (r *mutationResolver) MarkAllNotificationsUnread(ctx context.Context) (bool, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return false, err
	}
	if _, err := db.MarkAllNotificationsUnread(ctx, r.Pool, user.ID); err != nil {
		return false, fmt.Errorf("mark all notifications unread: %w", err)
	}
	return true, nil
}

// DeleteNotification is the resolver for the deleteNotification field.
func (r *mutationResolver) DeleteNotification(ctx context.Context, id uuid.UUID) (bool, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return false, err
	}
	deleted, err := db.DeleteNotification(ctx, r.Pool, id, user.ID)
	if err != nil {
		return false, fmt.Errorf("delete notification: %w", err)
	}
	return deleted, nil
}

// DeleteAllNotifications is the resolver for the deleteAllNotifications field.
func (r *mutationResolver) DeleteAllNotifications(ctx context.Context) (bool, error) {
	user, err := r.currentUser(ctx)
	if err != nil {
		return false, err
	}
	if _, err := db.DeleteNotifications(ctx, r.Pool, user.ID); err != nil {
		return false, fmt.Errorf("delete notifications: %w", err)
	}
	return true, nil
}
