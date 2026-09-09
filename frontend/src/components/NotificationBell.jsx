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
        <div className="glass-pop glass-pop-in absolute right-0 top-12 w-72 rounded-2xl p-2" data-state="open">
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
      )}
    </div>
  );
}

export default NotificationBell;