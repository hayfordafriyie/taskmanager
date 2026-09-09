import {
  CheckCircledIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckboxIcon,
  TargetIcon,
  ChatBubbleIcon,
  CalendarIcon,
} from "@radix-ui/react-icons";

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

const stats = [
  { label: "Tasks done today", value: 12, Icon: CheckCircledIcon, tint: "text-emerald-600 dark:text-emerald-400" },
  { label: "In progress", value: 5, Icon: ClockIcon, tint: "text-indigo-600 dark:text-indigo-400" },
  { label: "Overdue", value: 3, Icon: ExclamationTriangleIcon, tint: "text-red-600 dark:text-red-400" },
  { label: "Completed this week", value: 27, Icon: CheckboxIcon, tint: "text-amber-600 dark:text-amber-400" },
];

const tasks = [
  { id: 1, title: "Finish GraphQL resolver tests", priority: "High", due: "Today", tag: "Backend", initial: "KO" },
  { id: 2, title: "Design onboarding email copy", priority: "Medium", due: "Tomorrow", tag: "Marketing", initial: "AM" },
  { id: 3, title: "Review Q3 roadmap", priority: "High", due: "Sep 12", tag: "Planning", initial: "HB" },
  { id: 4, title: "Fix Radix Select focus ring", priority: "Low", due: "Sep 14", tag: "Frontend", initial: "KA" },
];

const projects = [
  { id: 1, name: "Task Manager", progress: 72, bar: "bg-indigo-500" },
  { id: 2, name: "Mobile App", progress: 45, bar: "bg-emerald-500" },
  { id: 3, name: "Website Redesign", progress: 20, bar: "bg-amber-500" },
];

const activity = [
  { id: 1, text: "Kojo completed “Fix Select focus ring”", time: "2m ago" },
  { id: 2, text: "Ama commented on “Q3 roadmap”", time: "1h ago" },
  { id: 3, text: "You were invited to “Mobile App”", time: "3h ago" },
];

const week = [
  { day: "Mon", count: 3 },
  { day: "Tue", count: 2 },
  { day: "Wed", count: 4 },
  { day: "Thu", count: 0 },
  { day: "Fri", count: 5 },
  { day: "Sat", count: 1 },
  { day: "Sun", count: 0 },
];

const priorityTint = {
  High: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

function SectionHeader({ title, icon: Icon }) {
  return (
    <header className="flex items-center gap-2">
      <Icon width={16} height={16} className="text-zinc-400 dark:text-zinc-500" />
      <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
    </header>
  );
}

export function DashboardView() {
  return (
    <div>
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {greeting()}, Hayford
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {todayLabel()}
          </p>
        </div>
        <span className="hidden rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 sm:inline-block">
          12 tasks completed today
        </span>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, Icon, tint }) => (
          <div
            key={label}
            className="glass-card p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
              <Icon width={18} height={18} className={tint} />
            </div>
            <p className="mt-2 font-display text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="glass-card p-4 lg:col-span-2">
          <SectionHeader title="Upcoming tasks" icon={CheckboxIcon} />
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {t.initial}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t.title}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t.tag} · Due {t.due}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityTint[t.priority]}`}
                >
                  {t.priority}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass-card p-4">
          <SectionHeader title="Projects" icon={TargetIcon} />
          <ul className="mt-3 space-y-4">
            {projects.map((p) => (
              <li key={p.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {p.name}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {p.progress}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${p.bar}`}
                    style={{ width: `${p.progress}%` }}
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
                <p className="text-zinc-700 dark:text-zinc-300">{a.text}</p>
                <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                  {a.time}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass-card p-4 lg:col-span-2">
          <SectionHeader title="Due this week" icon={CalendarIcon} />
          <div className="mt-3 grid grid-cols-7 gap-2">
            {week.map((d) => (
              <div
                key={d.day}
                className="flex flex-col items-center gap-1.5 glass-tile py-3"
              >
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {d.day}
                </span>
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-100 px-1 font-display text-sm font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
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