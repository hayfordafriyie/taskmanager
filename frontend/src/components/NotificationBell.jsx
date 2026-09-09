import { useState } from "react";
import { BellIcon } from "@radix-ui/react-icons";
import Tooltip from "./Tooltip";

const notifications = [
  { id: 1, title: "New invite", description: "Kojo invited you to a task." },
  { id: 2, title: "Task due", description: "Finish report by 5pm today." },
  { id: 3, title: "Reminder", description: "Team sync at 10am tomorrow." },
];

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const unread = notifications.length;

  function toggle() {
    setOpen((o) => !o);
  }

  return (
    <div className="relative">
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
              {unread}
            </span>
          )}
        </button>
      </Tooltip>
      {open && (
        <div className="absolute right-0 top-full z-50 pt-3">
          <div
            className="glass-pop glass-pop-in relative w-[min(18rem,calc(100vw-4.5rem))] rounded-2xl p-2 sm:w-72"
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
            <p className="t-ink px-2 py-1 text-sm font-semibold">
              Notifications
            </p>
            {notifications.map((n) => (
              <div
                key={n.id}
                className="rounded-xl p-2 transition-colors hover:bg-[var(--glass-b)]"
              >
                <p className="t-ink text-sm font-medium">{n.title}</p>
                <p className="t-soft mt-0.5 text-xs">{n.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;