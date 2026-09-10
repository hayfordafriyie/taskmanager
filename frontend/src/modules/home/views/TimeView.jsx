import { useMemo, useState } from "react";
import { errorMessage } from "../../../lib/errors";
import {
  StopwatchIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cross2Icon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { Panel, ViewHeader } from "../ui";
import Select from "../../../components/Select";
import { useAuth } from "../../auth/AuthContext";
import { useTeamTasks } from "../../tasks/hooks";
import {
  useTimeEntries,
  useTimeSummary,
  useLogTime,
  useDeleteTimeEntry,
  formatHours,
  toApiTime,
} from "../../time/hooks";
import { useToast } from "../../../components/Toast";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function startOfWeek(offsetWeeks = 0) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Monday = 0
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + offsetWeeks * 7);
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dayIndex(dateStr) {
  const d = new Date(dateStr);
  return (d.getDay() + 6) % 7; // Monday-based
}

export function TimeView() {
  const toast = useToast();
  const { user } = useAuth();
  const { data: tasks = [] } = useTeamTasks({ enabled: !!user?.id });

  const [weekOffset, setWeekOffset] = useState(0);
  const [showLog, setShowLog] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [label, setLabel] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [spentOn, setSpentOn] = useState(() => isoDate(new Date()));
  const [note, setNote] = useState("");

  const monday = useMemo(() => startOfWeek(weekOffset), [weekOffset]);
  const friday = useMemo(() => addDays(monday, 4), [monday]);
  const from = isoDate(monday);
  const to = isoDate(friday);

  const { data: entries = [], isLoading } = useTimeEntries(from, to, { enabled: !!user?.id });
  const { data: summary } = useTimeSummary(from, to, { enabled: !!user?.id });
  const logTime = useLogTime();
  const deleteEntry = useDeleteTimeEntry();

  const rows = useMemo(() => {
    const byLabel = new Map();
    for (const e of entries) {
      const key = e.label || e.taskTitle || "General";
      if (!byLabel.has(key)) byLabel.set(key, { label: key, days: [0, 0, 0, 0, 0], total: 0 });
      const row = byLabel.get(key);
      const idx = dayIndex(e.spentOn);
      if (idx >= 0 && idx < 5) row.days[idx] += e.minutes;
      row.total += e.minutes;
    }
    return Array.from(byLabel.values()).sort((a, b) => b.total - a.total);
  }, [entries]);

  const weekTotal = rows.reduce((sum, r) => sum + r.total, 0);

  const summaries = [
    {
      label: "Hours logged",
      value: formatHours(summary?.totalMinutes ?? weekTotal),
      hint: "this week",
    },
    {
      label: "Daily average",
      value: summary?.activeDays
        ? formatHours((summary.totalMinutes || 0) / summary.activeDays)
        : "0.0h",
      hint: summary?.activeDays
        ? `across ${summary.activeDays} day${summary.activeDays === 1 ? "" : "s"}`
        : "no time logged yet",
    },
    {
      label: "Top project",
      value: summary?.topLabel || "—",
      hint: summary?.topLabel ? `${formatHours(summary.topMinutes)} logged` : "log time to see this",
    },
  ];

  const taskOptions = [
    { value: "", label: "No task (free label)" },
    ...tasks.map((t) => ({ value: t.id, label: t.title })),
  ];

  function submitLog(e) {
    e.preventDefault();
    const totalMinutes = Number(hours || 0) * 60 + Number(minutes || 0);
    if (!totalMinutes || totalMinutes <= 0) {
      toast.error("Enter how long you worked.");
      return;
    }
    logTime.mutate(
      {
        input: {
          taskId: taskId || null,
          label: label.trim() || null,
          minutes: totalMinutes,
          spentOn: toApiTime(spentOn),
          note: note.trim() || null,
        },
      },
      {
        onSuccess: (res) => {
          const r = res?.data?.logTime;
          if (r?.success) {
            toast.success(r.message);
            setHours("");
            setMinutes("");
            setNote("");
            setLabel("");
            setTaskId("");
            setShowLog(false);
          } else {
            toast.error(r?.message || "Could not log time.");
          }
        },
        onError: (err) => toast.error(errorMessage(err, "Something went wrong")),
      },
    );
  }

  return (
    <div>
      <ViewHeader title="Time" subtitle="Time tracking across the projects you contribute to." />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="ring-accent rounded-full p-2 transition-colors text-[var(--ink-faint)] hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
          >
            <ChevronLeftIcon width={16} height={16} />
          </button>
          <span className="px-1 text-sm font-medium t-ink">
            {monday.toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
            {friday.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => setWeekOffset((w) => w + 1)}
            className="ring-accent rounded-full p-2 transition-colors text-[var(--ink-faint)] hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
          >
            <ChevronRightIcon width={16} height={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowLog(true)}
          className="btn-gloss-primary flex items-center gap-1.5 rounded-full px-4 py-2 text-sm"
        >
          <PlusIcon width={14} height={14} />
          Log time
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaries.map((s) => (
          <Panel key={s.label}>
            <p className="text-sm t-soft">{s.label}</p>
            <p className="mt-2 truncate font-display text-2xl font-bold t-ink">{s.value}</p>
            <p className="mt-0.5 text-xs t-faint">{s.hint}</p>
          </Panel>
        ))}
      </div>

      <Panel className="mt-4">
        <header className="flex items-center gap-2">
          <StopwatchIcon width={16} height={16} className="t-faint" />
          <h2 className="font-display text-sm font-semibold t-ink">This week</h2>
          <span className="badge tone-indigo ml-auto px-2.5 py-1 text-xs">
            {formatHours(weekTotal)} total
          </span>
        </header>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-112 text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs t-faint">
                <th className="pb-2 font-medium">Project</th>
                {WEEKDAYS.map((d, i) => (
                  <th key={d} className="pb-2 text-right font-medium">
                    <span className="block">{d}</span>
                    <span className="block font-normal">{addDays(monday, i).getDate()}</span>
                  </th>
                ))}
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-soft">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="py-3">
                    <span className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-zinc-400 to-zinc-700 text-[10px] font-semibold text-white">
                        {r.label.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="truncate font-medium t-ink">{r.label}</span>
                    </span>
                  </td>
                  {r.days.map((m, i) => (
                    <td key={i} className="py-3 text-right t-soft">
                      {m ? formatHours(m) : "—"}
                    </td>
                  ))}
                  <td className="py-3 text-right font-semibold t-ink">{formatHours(r.total)}</td>
                </tr>
              ))}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm t-soft">
                    No time logged this week — use “Log time” to add an entry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {entries.length > 0 && (
        <Panel className="mt-4">
          <h2 className="font-display text-sm font-semibold t-ink">Entries this week</h2>
          <ul className="divide-soft mt-3">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium t-ink">{e.taskTitle || e.label}</p>
                  <p className="truncate text-xs t-soft">
                    {new Date(e.spentOn).toLocaleDateString()} · {formatHours(e.minutes)}
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete time entry for ${e.taskTitle || e.label}`}
                  onClick={() =>
                    deleteEntry.mutate(
                      { entryId: e.id },
                      { onError: (err) => toast.error(errorMessage(err, "Something went wrong")) },
                    )
                  }
                  className="ring-accent shrink-0 rounded-lg p-1.5 t-faint transition-colors hover:bg-[var(--glass-b)] hover:text-red-500"
                >
                  <TrashIcon width={13} height={13} />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {showLog && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="glass-pop mt-16 w-full max-w-md rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold t-ink">Log time</h3>
              <button
                type="button"
                onClick={() => setShowLog(false)}
                aria-label="Close log time"
                className="ring-accent rounded-lg p-1.5 t-faint transition-colors hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
              >
                <Cross2Icon width={14} height={14} />
              </button>
            </div>

            <form onSubmit={submitLog} className="mt-3 space-y-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium t-soft">Task (optional)</span>
                <Select
                  ariaLabel="Task"
                  value={taskId || ""}
                  onValueChange={setTaskId}
                  options={taskOptions}
                  size="md"
                  className="w-full"
                />
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium t-soft">
                  Project label <span className="t-faint">(if not linked to a task)</span>
                </span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Internal tooling"
                  aria-label="Label"
                  className="control w-full rounded-[0.85rem] px-3.5 py-2.5 text-sm"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium t-soft">Hours</span>
                  <input
                    type="number"
                    min="0"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="0"
                    aria-label="Hours"
                    className="control w-full rounded-[0.85rem] px-3.5 py-2.5 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium t-soft">Minutes</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    placeholder="0"
                    aria-label="Minutes"
                    className="control w-full rounded-[0.85rem] px-3.5 py-2.5 text-sm"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium t-soft">Date</span>
                <input
                  type="date"
                  value={spentOn}
                  onChange={(e) => setSpentOn(e.target.value)}
                  aria-label="Date"
                  className="control w-full rounded-[0.85rem] px-3.5 py-2.5 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium t-soft">
                  Note <span className="t-faint">(optional)</span>
                </span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What did you work on?"
                  aria-label="Note"
                  className="control w-full rounded-[0.85rem] px-3.5 py-2.5 text-sm"
                />
              </label>

              <button
                type="submit"
                disabled={logTime.isPending}
                className="btn-gloss-primary w-full rounded-full px-3.5 py-2.5 text-sm"
              >
                {logTime.isPending ? "Saving…" : "Save entry"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TimeView;
