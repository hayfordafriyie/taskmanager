import { useMemo, useState } from "react";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { Panel, ViewHeader } from "../ui";
import { useAuth } from "../../auth/AuthContext";
import { useTeamTasks, toApiStatus } from "../../tasks/hooks";
import type {
  CalendarDayCellProps,
  CalendarFilter,
  CalendarFilterOption,
  DatedTask,
} from "../../../types/dates";
import type { Task, TaskStatus } from "../../../types/tasks";

const weekdays: readonly string[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const FILTERS: readonly CalendarFilterOption[] = [
  { key: "all", label: "All" },
  { key: "assigned", label: "Assigned to me" },
  { key: "created", label: "Created by me" },
];

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
};

const STATUS_TONE: Record<TaskStatus, string> = {
  TODO: "tone-neutral",
  IN_PROGRESS: "tone-indigo",
  REVIEW: "tone-amber",
  DONE: "tone-emerald",
};

const STATUS_DOT: Record<TaskStatus, string> = {
  TODO: "bg-zinc-400/80",
  IN_PROGRESS: "bg-sky-400/80",
  REVIEW: "bg-amber-400/80",
  DONE: "bg-emerald-400/80",
};

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function statusOf(task: Task): TaskStatus {
  return toApiStatus(task.status);
}

function DayCell({ day, tasks, isToday }: CalendarDayCellProps) {
  if (day == null) {
    return <div aria-hidden="true" />;
  }
  const shown = tasks.slice(0, 3);
  const more = tasks.length - shown.length;
  const allDone = tasks.length > 0 && tasks.every((t) => statusOf(t) === "DONE");
  const hasTasks = tasks.length > 0;

  return (
    <div className="glass-tile flex min-h-[4.5rem] flex-col rounded-xl p-1.5 transition-transform hover:-translate-y-0.5 sm:min-h-[6rem]">
      <div className="flex items-start justify-between gap-1">
        <span
          className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-display text-sm font-semibold leading-none sm:h-7 sm:min-w-7 sm:text-[15px] ${
            isToday
              ? "bg-[var(--accent)] text-white"
              : hasTasks
                ? allDone
                  ? "tone-emerald"
                  : "accent-text bg-[var(--accent-tint)]"
                : "t-ink"
          }`}
        >
          {day}
        </span>
        {more > 0 && (
          <span className="mt-0.5 hidden text-[10px] font-medium t-faint sm:inline">
            +{more}
          </span>
        )}
      </div>

      {hasTasks && (
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1.5 sm:flex-col sm:items-start sm:gap-1">
          {shown.map((t) => {
            const status = statusOf(t);
            const done = status === "DONE";
            return (
              <span
                key={t.id}
                title={`${t.title} · ${STATUS_LABEL[status] || status}`}
                className="flex min-w-0 max-w-full items-center gap-1"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full sm:h-1.5 sm:w-1.5 ${STATUS_DOT[status] || STATUS_DOT.TODO}`}
                />
                <span
                  className={`hidden truncate rounded px-1.5 py-0.5 text-[10px] font-medium sm:inline ${
                    done ? "tone-emerald line-through" : "t-soft"
                  }`}
                >
                  {t.title}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CalendarView() {
  const { user } = useAuth();
  const { data: tasks = [], isLoading } = useTeamTasks({ enabled: !!user?.id });

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [filter, setFilter] = useState<CalendarFilter>("all");

  const visibleTasks = useMemo<Task[]>(() => {
    return tasks.filter((t) => {
      if (filter === "assigned") return t.assignee?.id === user?.id;
      if (filter === "created") return t.createdBy?.id === user?.id;
      return true;
    });
  }, [tasks, filter, user?.id]);

  // Tasks are placed on their due date; tasks without one are summarised below.
  const dated = visibleTasks.filter((t): t is DatedTask => Boolean(t.dueAt));
  const undated = visibleTasks.length - dated.length;

  const byDay = useMemo<Map<string, Task[]>>(() => {
    const map = new Map<string, Task[]>();
    for (const t of dated) {
      const d = new Date(t.dueAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      const bucket = map.get(key);
      if (bucket) bucket.push(t);
    }
    return map;
  }, [dated]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const dueThisMonth = dated.filter((t) => {
    const d = new Date(t.dueAt);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const doneThisMonth = dueThisMonth.filter((t) => statusOf(t) === "DONE").length;

  function shiftMonth(delta: number): void {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  return (
    <div>
      <ViewHeader title="Calendar" subtitle="Your schedule and task deadlines at a glance." />
      <Panel className="mt-6">
        <header className="flex flex-wrap items-center justify-between gap-y-2">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold t-ink">
            <CalendarIcon width={16} height={16} className="t-faint" />
            {monthLabel}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
              className="ring-accent rounded-full p-2 transition-colors text-[var(--ink-faint)] hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
            >
              <ChevronLeftIcon width={16} height={16} />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
              className="ring-accent rounded-full p-2 transition-colors text-[var(--ink-faint)] hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
            >
              <ChevronRightIcon width={16} height={16} />
            </button>
          </div>
        </header>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="seg">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className="seg-btn"
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-xs t-soft">
            {dueThisMonth.length} due · {doneThisMonth} completed
          </span>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {weekdays.map((d) => (
            <p
              key={d}
              className="truncate pb-1 text-center text-[11px] font-semibold t-faint"
            >
              {d}
            </p>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1.5">
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <DayCell key={`blank-${i}`} day={null} tasks={[]} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const cellDate = new Date(year, month, day);
            const key = `${year}-${month}-${day}`;
            return (
              <DayCell
                key={day}
                day={day}
                tasks={byDay.get(key) || []}
                isToday={sameDay(cellDate, today)}
              />
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs t-soft">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-400/80" /> In progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-zinc-400/80" /> To do
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400/80" /> Review
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400/80" /> Completed
          </span>
          {undated > 0 && (
            <span className="t-faint">
              {undated} task{undated === 1 ? "" : "s"} without a due date
            </span>
          )}
        </div>

        {user?.id && !isLoading && visibleTasks.length === 0 && (
          <p className="mt-3 text-center text-sm t-soft">
            {filter === "assigned"
              ? "No tasks are assigned to you."
              : filter === "created"
                ? "You haven't created any tasks yet."
                : "No tasks yet. Add one from the Board."}
          </p>
        )}
      </Panel>
    </div>
  );
}

export default CalendarView;
