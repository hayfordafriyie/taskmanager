import {
  CheckCircledIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckboxIcon,
  TargetIcon,
  ChatBubbleIcon,
  CalendarIcon,
} from "@radix-ui/react-icons";
import { useAuth } from "../auth/AuthContext";
import { useDashboard } from "../dashboard/hooks";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const PRIORITY_LABEL = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };
const STATUS_LABEL = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
};

const BREAKDOWN_BAR = {
  IN_PROGRESS: "bg-sky-500",
  REVIEW: "bg-amber-500",
  TODO: "bg-zinc-400",
  DONE: "bg-emerald-500",
};

const priorityTint = {
  High: "tone-red",
  Medium: "tone-amber",
  Low: "tone-neutral",
};

function dueLabel(dueAt) {
  if (!dueAt) return "No due date";
  const due = new Date(dueAt);
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(due) - startOfDay(now)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function relativeTime(iso) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function initialsOf(person) {
  if (!person) return "?";
  return `${person.firstName?.[0] ?? ""}${person.surname?.[0] ?? ""}`.toUpperCase() || "?";
}

function SectionHeader({ title, icon: Icon }) {
  return (
    <header className="flex items-center gap-2">
      <Icon width={16} height={16} className="t-faint" />
      <h2 className="font-display text-sm font-semibold t-ink">
        {title}
      </h2>
    </header>
  );
}

export function DashboardView() {
  const { user } = useAuth();
  const { data, isLoading } = useDashboard({ enabled: !!user?.id });

  const stats = [
    {
      label: "Tasks done today",
      value: data?.stats?.doneToday ?? 0,
      Icon: CheckCircledIcon,
      tint: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "In progress",
      value: data?.stats?.inProgress ?? 0,
      Icon: ClockIcon,
      tint: "text-sky-600 dark:text-sky-400",
    },
    {
      label: "Overdue",
      value: data?.stats?.overdue ?? 0,
      Icon: ExclamationTriangleIcon,
      tint: "text-red-600 dark:text-red-400",
    },
    {
      label: "Completed this week",
      value: data?.stats?.completedThisWeek ?? 0,
      Icon: CheckboxIcon,
      tint: "text-amber-600 dark:text-amber-400",
    },
  ];

  const upcoming = data?.upcomingTasks ?? [];
  const breakdown = data?.statusBreakdown ?? [];
  const activity = data?.activity ?? [];
  const week = data?.dueThisWeek ?? [];
  const completedToday = data?.completedToday ?? 0;

  return (
    <div>
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold t-ink">
            {greeting()}, {user?.firstName ?? "Hayford"}
          </h1>
          <p className="mt-1 text-sm t-soft">
            {todayLabel()}
          </p>
        </div>
        <span className="tone-emerald hidden rounded-full px-3 py-1 text-xs font-medium sm:inline-block">
          {completedToday} tasks completed today
        </span>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
        {stats.map(({ label, value, Icon, tint }) => (
          <div key={label} className="glass-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm t-soft">{label}</p>
              <Icon width={18} height={18} className={tint} />
            </div>
            <p className="mt-2 font-display text-3xl font-bold t-ink">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="glass-card p-4 lg:col-span-2">
          <SectionHeader title="Upcoming tasks" icon={CheckboxIcon} />
          <ul className="divide-soft mt-3">
            {upcoming.map((t) => {
              const priority = PRIORITY_LABEL[t.priority] || t.priority;
              return (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-400 to-zinc-700 text-xs font-semibold text-white">
                    {initialsOf(t.assignee || t.createdBy)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium t-ink">
                      {t.title}
                    </p>
                    <p className="truncate text-xs t-soft">
                      {STATUS_LABEL[t.status] || t.status} · Due {dueLabel(t.dueAt)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityTint[priority] || priorityTint.Low}`}
                  >
                    {priority}
                  </span>
                </li>
              );
            })}
            {!isLoading && upcoming.length === 0 && (
              <li className="py-6 text-center text-sm t-soft">
                No upcoming tasks. Add one from the Board.
              </li>
            )}
          </ul>
        </section>

        <section className="glass-card p-4">
          <SectionHeader title="Task status" icon={TargetIcon} />
          <ul className="mt-3 space-y-4">
            {breakdown.map((p) => (
              <li key={p.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium t-ink">
                    {p.label}
                  </span>
                  <span className="text-xs t-soft">
                    {p.count} · {p.percent}%
                  </span>
                </div>
                <div className="track mt-1.5 h-2 w-full">
                  <div
                    className={`h-full rounded-full ${BREAKDOWN_BAR[p.key] || "bg-zinc-400"}`}
                    style={{ width: `${p.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass-card p-4">
          <SectionHeader title="Recent activity" icon={ChatBubbleIcon} />
          <ul className="mt-3 space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="text-sm">
                <p className="t-ink">{a.title}</p>
                {a.body && <p className="mt-0.5 text-xs t-soft">{a.body}</p>}
                <p className="mt-0.5 text-xs t-faint">
                  {relativeTime(a.createdAt)}
                </p>
              </li>
            ))}
            {!isLoading && activity.length === 0 && (
              <li className="text-sm t-soft">Nothing yet.</li>
            )}
          </ul>
        </section>

        <section className="glass-card p-4 lg:col-span-2">
          <SectionHeader title="Due this week" icon={CalendarIcon} />
          <div className="mt-3 grid grid-cols-7 gap-2">
            {week.map((d) => (
              <div
                key={d.day}
                title={d.label}
                className="flex flex-col items-center gap-1.5 glass-tile py-3"
              >
                <span className="text-xs font-medium t-soft">
                  {d.day}
                </span>
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-gradient-to-br from-zinc-400 to-zinc-700 px-1 font-display text-sm font-semibold text-white">
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default DashboardView;
