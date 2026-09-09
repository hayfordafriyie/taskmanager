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
          className="relative rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <BellIcon width={18} height={18} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
        </button>
      </Tooltip>
      {open && (
        <div className="absolute right-0 top-12 w-72 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <p className="px-2 py-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Notifications
          </p>
          {notifications.map((n) => (
            <div
              key={n.id}
              className="rounded p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {n.title}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {n.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;