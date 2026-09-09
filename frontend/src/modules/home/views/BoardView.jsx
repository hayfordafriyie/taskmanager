import { PlusIcon, ColumnsIcon } from "@radix-ui/react-icons";
import { Panel, ViewHeader, PriorityBadge, Avatar } from "../ui";

const columns = [
  {
    id: "todo",
    title: "To do",
    tint: "text-zinc-500 dark:text-zinc-400",
    dot: "bg-zinc-400",
    tasks: [
      { id: 1, title: "Write release notes for v2", tag: "Docs", priority: "Medium", due: "Sep 18", assignee: "AM" },
      { id: 2, title: "Add export to CSV", tag: "Backend", priority: "High", due: "Sep 19", assignee: "KO" },
    ],
  },
  {
    id: "progress",
    title: "In progress",
    tint: "text-indigo-600 dark:text-indigo-400",
    dot: "bg-indigo-500",
    tasks: [
      { id: 3, title: "Design task detail screen", tag: "Frontend", priority: "High", due: "Sep 13", assignee: "KA" },
      { id: 4, title: "GraphQL pagination", tag: "Backend", priority: "Medium", due: "Sep 14", assignee: "KO" },
      { id: 5, title: "Draft help center articles", tag: "Docs", priority: "Low", due: "Sep 15", assignee: "AM" },
    ],
  },
  {
    id: "review",
    title: "Review",
    tint: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    tasks: [
      { id: 6, title: "Auth middleware refactor", tag: "Backend", priority: "High", due: "Sep 12", assignee: "HB" },
    ],
  },
  {
    id: "done",
    title: "Done",
    tint: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    tasks: [
      { id: 7, title: "Onboarding flow", tag: "Frontend", priority: "Medium", due: "Sep 10", assignee: "KA" },
      { id: 8, title: "Rate limiting", tag: "Backend", priority: "High", due: "Sep 9", assignee: "KO" },
    ],
  },
];

export function BoardView() {
  return (
    <div>
      <ViewHeader title="Board" subtitle="Drag tasks across columns as work progresses." />
      <div className="-mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pb-4">
        {columns.map((col) => (
          <Panel key={col.id} className="w-72 shrink-0">
            <header className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
              <h2 className={`font-display text-sm font-semibold ${col.tint}`}>
                {col.title}
              </h2>
              <span className="badge-tint badge px-2 py-0.5 text-xs">
                {col.tasks.length}
              </span>
            </header>
            <ul className="mt-3 space-y-3">
              {col.tasks.map((t) => (
                <li
                  key={t.id}
                  className="glass-tile p-3 transition-all hover:-translate-y-0.5 hover:bg-[var(--glass-hover)]"
                >
                  <p className="text-sm font-medium t-ink">
                    {t.title}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t.tag} · Due {t.due}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <PriorityBadge>{t.priority}</PriorityBadge>
                    <Avatar initial={t.assignee} className="h-6 w-6 text-[10px]" />
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="ring-accent mt-3 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors text-[var(--ink-faint)] hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
            >
              <PlusIcon width={14} height={14} />
              Add task
            </button>
          </Panel>
        ))}
      </div>
      <p className="hidden items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500 lg:flex">
        <ColumnsIcon width={14} height={14} />
        Board view – drag-and-drop coming soon.
      </p>
    </div>
  );
}