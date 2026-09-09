import { useState } from "react";
import { CheckboxIcon, MagnifyingGlassIcon, CheckIcon } from "@radix-ui/react-icons";
import { Panel, ViewHeader, PriorityBadge, Avatar } from "../ui";

const initialTasks = [
  { id: 1, title: "Finish GraphQL resolver tests", project: "Backend", due: "Today", priority: "High", assignee: "KO", done: false },
  { id: 2, title: "Write onboarding email copy", project: "Marketing", due: "Tomorrow", priority: "Medium", assignee: "AM", done: false },
  { id: 3, title: "Review Q3 roadmap notes", project: "Planning", due: "Sep 12", priority: "High", assignee: "HB", done: false },
  { id: 4, title: "Fix Radix Select focus ring", project: "Frontend", due: "Sep 14", priority: "Low", assignee: "KA", done: true },
  { id: 5, title: "Update API rate-limit docs", project: "Docs", due: "Sep 15", priority: "Medium", assignee: "HB", done: false },
  { id: 6, title: "Prepare demo environment", project: "DevOps", due: "Sep 16", priority: "Low", assignee: "KA", done: true },
];

const filters = ["All", "Open", "Done"];

export function MyTasksView() {
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  function toggle(id) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }

  const visible = tasks.filter((t) => {
    if (filter === "Open" && t.done) return false;
    if (filter === "Done" && !t.done) return false;
    if (query && !t.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div>
      <ViewHeader title="My tasks" subtitle="Everything assigned to you, in one place." />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="seg">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className="seg-btn"
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative">
          <MagnifyingGlassIcon width={14} height={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            className="control rounded-full py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <Panel className="mt-4">
        <SectionTitleRow done={doneCount} total={tasks.length} />
        <ul className="divide-soft mt-2">
          {visible.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-3">
              <button
                type="button"
                aria-label={t.done ? "Mark as open" : "Mark as done"}
                onClick={() => toggle(t.id)}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                  t.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-zinc-300 text-transparent hover:border-emerald-400 dark:border-zinc-600"
                }`}
              >
                <CheckIcon width={12} height={12} />
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-medium ${
                    t.done
                      ? "text-zinc-400 line-through dark:text-zinc-500"
                      : "text-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  {t.title}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t.project} · Due {t.due}
                </p>
              </div>
              <PriorityBadge>{t.priority}</PriorityBadge>
              <Avatar initial={t.assignee} className="h-7 w-7 text-[10px]" />
            </li>
          ))}
          {visible.length === 0 && (
            <li className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No tasks match this view.
            </li>
          )}
        </ul>
      </Panel>
    </div>
  );
}

function SectionTitleRow({ done, total }) {
  return (
    <header className="flex items-center gap-2">
      <CheckboxIcon width={16} height={16} className="text-zinc-400 dark:text-zinc-500" />
      <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Tasks
      </h2>
      <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
        {done} of {total} done
      </span>
    </header>
  );
}