import { BarChartIcon, PieChartIcon, PersonIcon } from "@radix-ui/react-icons";
import { Panel, ViewHeader } from "../ui";
import { useAuth } from "../../auth/AuthContext";
import { useReports } from "../../reports/hooks";
import DonutChart from "../../../components/DonutChart";

const WORKLOAD_BAR = ["bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-zinc-400"];

const SLICE_COLOR = {
  TODO: "#a1a1aa",
  IN_PROGRESS: "#0ea5e9",
  REVIEW: "#f59e0b",
  DONE: "#10b981",
};

export function ReportsView() {
  const { user } = useAuth();
  const { data, isLoading } = useReports({ enabled: !!user?.id });

  const days = data?.completedPerDay ?? [];
  const byStatus = data?.byStatus ?? [];
  const workload = data?.workload ?? [];

  const maxValue = Math.max(1, ...days.map((d) => d.value));

  const stats = [
    { label: "Total tasks", value: data?.totalTasks ?? 0 },
    { label: "Completed", value: data?.completedTasks ?? 0 },
    { label: "Overdue", value: data?.overdueTasks ?? 0 },
    { label: "Completion rate", value: `${data?.completionRate ?? 0}%` },
  ];

  return (
    <div>
      <ViewHeader title="Reports" subtitle="Progress and workload across your workspace." />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass-card p-4">
            <p className="text-sm t-soft">{s.label}</p>
            <p className="mt-2 font-display text-3xl font-bold t-ink">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <header className="flex items-center gap-2">
            <BarChartIcon width={16} height={16} className="t-faint" />
            <h2 className="font-display text-sm font-semibold t-ink">Completed per day</h2>
          </header>
          <div className="mt-4 flex h-40 items-end gap-3">
            {days.map((d, i) => (
              <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-medium t-soft">{d.value}</span>
                <div
                  className="w-full max-w-10 rounded-t bg-sky-500/90"
                  style={{
                    height: `${(d.value / maxValue) * 100}%`,
                    minHeight: d.value ? "2px" : "0",
                  }}
                />
                <span className="text-xs t-faint">{d.label}</span>
              </div>
            ))}
            {!isLoading && days.length === 0 && (
              <p className="w-full text-center text-sm t-soft">No completion data yet.</p>
            )}
          </div>
        </Panel>

        <Panel>
          <header className="flex items-center gap-2">
            <PieChartIcon width={16} height={16} className="t-faint" />
            <h2 className="font-display text-sm font-semibold t-ink">Tasks by status</h2>
          </header>
          <div className="mt-4">
            <DonutChart
              ariaLabel="Tasks by status"
              centerCaption="tasks"
              data={byStatus.map((s) => ({
                key: s.key,
                label: s.label,
                count: s.count,
                color: SLICE_COLOR[s.key] || "#a1a1aa",
              }))}
            />
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <header className="flex items-center gap-2">
            <PersonIcon width={16} height={16} className="t-faint" />
            <h2 className="font-display text-sm font-semibold t-ink">Team workload</h2>
            <span className="ml-auto text-xs t-faint">open tasks · share of team work</span>
          </header>
          <ul className="mt-4 space-y-3">
            {workload.map((m, i) => (
              <li key={m.userId} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-sm font-medium t-ink">{m.name}</span>
                <div className="track h-2.5 w-full max-w-sm">
                  <div
                    className={`h-full rounded-full ${WORKLOAD_BAR[i % WORKLOAD_BAR.length]}`}
                    style={{ width: `${m.percent}%`, minWidth: m.open ? "4px" : "0" }}
                  />
                </div>
                <span className="shrink-0 text-xs font-medium t-soft">
                  {m.open} open · {m.done} done
                </span>
              </li>
            ))}
            {!isLoading && workload.length === 0 && (
              <li className="text-sm t-soft">
                No assigned tasks yet — assign work from the Board to see workload.
              </li>
            )}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

export default ReportsView;
