import { useRef, useState } from "react";
import {
  BellIcon,
  CheckIcon,
  Cross1Icon,
  ReaderIcon,
  TrashIcon,
  DoubleArrowDownIcon,
  EyeNoneIcon,
} from "@radix-ui/react-icons";
import Tooltip from "./Tooltip";
import { useDismissOnOutside } from "../hooks/useDismiss";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkNotificationUnread,
  useMarkAllNotificationsRead,
  useMarkAllNotificationsUnread,
  useDeleteNotification,
  useDeleteAllNotifications,
} from "../modules/notifications/hooks";

function timeAgo(iso) {
  const then = new Date(iso);
  const diff = Math.max(0, Date.now() - then.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  useDismissOnOutside(rootRef, () => setOpen(false), open);
  const { data: notifications = [] } = useNotifications();
  const { data: unread = 0 } = useUnreadNotificationCount();

  const markRead = useMarkNotificationRead();
  const markUnread = useMarkNotificationUnread();
  const markAllRead = useMarkAllNotificationsRead();
  const markAllUnread = useMarkAllNotificationsUnread();
  const del = useDeleteNotification();
  const delAll = useDeleteAllNotifications();

  function toggle() {
    setOpen((o) => !o);
  }

  return (
    <div className="relative" ref={rootRef}>
      <Tooltip content="Notifications">
        <button
          type="button"
          onClick={toggle}
          aria-label={`Notifications (${unread} unread)`}
          aria-expanded={open}
          className="ring-accent t-soft relative rounded-full p-2 transition-colors hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
        >
          <BellIcon width={18} height={18} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-rose-500 px-1 text-[10px] font-semibold text-white shadow-sm">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-full z-50 pt-3">
          <div
            className="glass-pop glass-pop-in relative w-[min(20rem,calc(100vw-3rem))] overflow-hidden rounded-2xl sm:w-[24rem]"
            data-state="open"
            role="dialog"
            aria-label="Notifications"
          >
            <span
              aria-hidden="true"
              className="absolute -top-[7px] right-4 h-3.5 w-3.5 rotate-45 rounded-[2px] border-l border-t"
              style={{
                borderColor: "var(--border-soft)",
                background: "var(--glass-strong)",
              }}
            />
            <header className="flex items-center justify-between gap-2 px-4 py-3">
              <p className="t-ink text-sm font-semibold">
                Notifications
                {unread > 0 && (
                  <span className="ml-2 rounded-full bg-[var(--accent-tint)] px-2 py-0.5 text-xs text-[var(--accent)]">
                    {unread} unread
                  </span>
                )}
              </p>
              <div className="flex items-center gap-1">
                <Tooltip content="Mark all as read">
                  <button
                    type="button"
                    aria-label="Mark all as read"
                    onClick={() => markAllRead.mutate()}
                    className="ring-accent rounded-lg p-1.5 t-faint transition-colors hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
                  >
                    <CheckIcon width={14} height={14} />
                  </button>
                </Tooltip>
                <Tooltip content="Mark all as unread">
                  <button
                    type="button"
                    aria-label="Mark all as unread"
                    onClick={() => markAllUnread.mutate()}
                    className="ring-accent rounded-lg p-1.5 t-faint transition-colors hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
                  >
                    <EyeNoneIcon width={14} height={14} />
                  </button>
                </Tooltip>
                <Tooltip content="Delete all notifications">
                  <button
                    type="button"
                    aria-label="Delete all notifications"
                    onClick={() => delAll.mutate()}
                    className="ring-accent rounded-lg p-1.5 t-faint transition-colors hover:bg-[var(--glass-b)] hover:text-red-500"
                  >
                    <TrashIcon width={14} height={14} />
                  </button>
                </Tooltip>
              </div>
            </header>

            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm t-soft">
                <DoubleArrowDownIcon width={16} height={16} className="mx-auto mb-1 t-faint" />
                No notifications yet.
              </p>
            ) : (
              <ul className="max-h-[22rem] divide-y divide-[var(--border-subtle)] overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id} className="group flex gap-3 px-4 py-3">
                    <button
                      type="button"
                      aria-label={n.read ? `Mark ${n.title} as unread` : `Mark ${n.title} as read`}
                      onClick={() => (n.read ? markUnread.mutate({ id: n.id }) : markRead.mutate({ id: n.id }))}
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full transition-colors ${
                        n.read
                          ? "bg-transparent ring-1 ring-[var(--border-strong)]"
                          : "bg-[var(--accent)] shadow-[0_0_0_3px_var(--accent-tint)]"
                      }`}
                      title={n.read ? "Unread" : "Read"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${n.read ? "t-soft" : "font-medium t-ink"}`}>
                        {n.title}
                      </p>
                      {n.body && <p className="mt-0.5 text-xs t-soft">{n.body}</p>}
                      <p className="mt-0.5 flex items-center gap-2 text-[11px] t-faint">
                        {n.kind === "task_due_soon" && <ReaderIcon width={11} height={11} />}
                        <span>{timeAgo(n.createdAt)}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete notification ${n.title}`}
                      onClick={() => del.mutate({ id: n.id })}
                      className="ring-accent h-fit self-start rounded-lg p-1.5 t-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--glass-b)] hover:text-red-500"
                    >
                      <Cross1Icon width={12} height={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
