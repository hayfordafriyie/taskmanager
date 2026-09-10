import { useState } from "react";
import { CheckboxIcon, MagnifyingGlassIcon, CheckIcon, PersonIcon } from "@radix-ui/react-icons";
import { Panel, ViewHeader, PriorityBadge } from "../ui";
import { useAuth } from "../../auth/AuthContext";
import { useTeamTasks, useSetTaskStatus, toApiStatus } from "../../tasks/hooks";
import { useToast } from "../../../components/Toast";

const filters = ["All", "Open", "Done"];

const PRIORITY_LABEL = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

function creatorName(t) {
  const c = t.createdBy;
  if (!c) return "Teammate";
  return `${c.firstName ?? ""} ${c.surname ?? ""}`.trim() || "Teammate";
}

export function MyTasksView() {
  const toast = useToast();
  const { user } = useAuth();
  const { data: tasks = [], isLoading } = useTeamTasks({ enabled: !!user?.id });
  const setStatus = useSetTaskStatus();

  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  const mine = tasks.filter((t) => t.assignee?.id === user?.id);
  const visible = mine.filter((t) => {
    const done = toApiStatus(t.status) === "DONE";
    if (filter === "Open" && done) return false;
    if (filter === "Done" && !done) return false;
    if (query && !t.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const doneCount = mine.filter((t) => toApiStatus(t.status) === "DONE").length;

  function toggle(t) {
    const done = toApiStatus(t.status) === "DONE";
    setStatus.mutate(
      { taskId: t.id, status: done ? "TODO" : "DONE" },
      {
        onSuccess: (res) => {
          const r = res?.data?.setTaskStatus;
          if (r && !r.success) toast.error(r.message);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

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
          <MagnifyingGlassIcon width={14} height={14} className="t-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            aria-label="Search my tasks"
            className="control rounded-full py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <Panel className="mt-4">
        <header className="flex items-center gap-2">
          <CheckboxIcon width={16} height={16} className="t-faint" />
          <h2 className="font-display text-sm font-semibold t-ink">Tasks</h2>
          <span className="ml-auto text-xs t-soft">
            {doneCount} of {mine.length} done
          </span>
        </header>

        {!user?.id ? (
          <p className="py-8 text-center text-sm t-soft">
            Sign in to see the tasks assigned to you.
          </p>
        ) : isLoading ? (
          <p className="py-8 text-center text-sm t-soft">Loading tasks…</p>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm t-soft">
            {mine.length === 0
              ? "No tasks are assigned to you yet."
              : "No tasks match this view."}
          </p>
        ) : (
          <ul className="divide-soft mt-2">
            {visible.map((t) => {
              const done = toApiStatus(t.status) === "DONE";
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    aria-label={done ? "Mark as open" : "Mark as done"}
                    onClick={() => toggle(t)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-[var(--border-strong)] text-transparent hover:border-emerald-400"
                    }`}
                  >
                    <CheckIcon width={12} height={12} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-medium ${
                        done ? "t-faint line-through" : "t-ink"
                      }`}
                    >
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="truncate text-xs t-faint">{t.description}</p>
                    )}
                    <p className="flex items-center gap-1 truncate text-xs t-soft">
                      <PersonIcon width={11} height={11} />
                      Assigned by {creatorName(t)}
                      {t.dueAt ? ` · Due ${new Date(t.dueAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <PriorityBadge>{PRIORITY_LABEL[t.priority] || t.priority}</PriorityBadge>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export default MyTasksView;
