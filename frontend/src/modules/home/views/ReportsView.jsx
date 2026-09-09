import { BarChartIcon, PieChartIcon } from "@radix-ui/react-icons";
import { Panel, ViewHeader, SectionTitle } from "../ui";

const days = [
  { day: "Mon", value: 10 },
  { day: "Tue", value: 14 },
  { day: "Wed", value: 8 },
  { day: "Thu", value: 18 },
  { day: "Fri", value: 12 },
  { day: "Sat", value: 4 },
  { day: "Sun", value: 3 },
];

const maxValue = Math.max(...days.map((d) => d.value));

const byStatus = [
  { label: "Done", value: 27, color: "#10b981" },
  { label: "In progress", value: 15, color: "#6366f1" },
  { label: "To do", value: 9, color: "#a1a1aa" },
  { label: "Overdue", value: 4, color: "#ef4444" },
];

const team = [
  { name: "Kojo", value: "82%", color: "#6366f1", width: 82 },
  { name: "Ama", value: "64%", color: "#10b981", width: 64 },
  { name: "Hayford", value: "58%", color: "#f59e0b", width: 58 },
  { name: "Katherine", value: "41%", color: "#f87171", width: 41 },
];

const statusTotal = byStatus.reduce((a, b) => a + b.value, 0);

function donutStops() {
  let acc = 0;
  return byStatus
    .map((s) => {
      const from = acc;
      acc += (s.value / statusTotal) * 100;
      return `${s.color} ${from}% ${acc}%`;
    })
    .join(", ");
}

export function ReportsView() {
  return (
    <div>
      <ViewHeader title="Reports" subtitle="Progress and workload across your workspace." />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel>
          <SectionTitle title="Tasks completed per day" icon={BarChartIcon} />
          <div className="mt-4 flex h-40 items-end gap-3">
            {days.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {d.value}
                </span>
                <div
                  className="w-full max-w-10 rounded-t bg-indigo-500/90"
                  style={{ height: `${(d.value / maxValue) * 100}%` }}
                />
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {d.day}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionTitle title="Tasks by status" icon={PieChartIcon} />
          <div className="mt-4 flex items-center gap-6">
            <div
              className="h-32 w-32 shrink-0 rounded-full"
              style={{ background: `conic-gradient(${donutStops()})` }}
            />
            <ul className="space-y-2">
              {byStatus.map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-zinc-600 dark:text-zinc-300">{s.label}</span>
                  <span className="ml-auto pl-4 font-medium text-zinc-900 dark:text-zinc-100">
                    {s.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <SectionTitle title="Team workload" icon={BarChartIcon} />
          <ul className="mt-4 space-y-3">
            {team.map((m) => (
              <li key={m.name} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {m.name}
                </span>
                <div className="h-2.5 w-full max-w-sm rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${m.width}%`, backgroundColor: m.color }}
                  />
                </div>
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {m.value}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}