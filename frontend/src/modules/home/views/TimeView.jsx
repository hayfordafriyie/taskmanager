import { StopwatchIcon } from "@radix-ui/react-icons";
import { Panel, ViewHeader } from "../ui";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const rows = [
  { project: "Task Manager", initials: "TM", color: "bg-indigo-500", days: [3, 4.5, 2, 5, 3] },
  { project: "Mobile App", initials: "MA", color: "bg-emerald-500", days: [2, 1.5, 0, 4, 2] },
  { project: "Website Redesign", initials: "WR", color: "bg-amber-500", days: [1, 0, 1.5, 0, 0] },
  { project: "Internal tooling", initials: "IT", color: "bg-red-500", days: [0.5, 1, 0, 0, 1] },
];

const summaries = [
  { label: "Hours logged", value: "24.5h", hint: "this week" },
  { label: "Daily average", value: "4.9h", hint: "across 5 days" },
  { label: "Top project", value: "Task Manager", hint: "17.5h logged" },
];

export function TimeView() {
  return (
    <div>
      <ViewHeader title="Time" subtitle="Time tracking across the projects you contribute to." />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaries.map((s) => (
          <Panel key={s.label}>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{s.label}</p>
            <p className="mt-2 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {s.value}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{s.hint}</p>
          </Panel>
        ))}
      </div>

      <Panel className="mt-4">
        <header className="flex items-center gap-2">
          <StopwatchIcon width={16} height={16} className="text-zinc-400 dark:text-zinc-500" />
          <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            This week
          </h2>
          <span className="badge tone-indigo ml-auto px-2.5 py-1 text-xs">
            24.5h total
          </span>
        </header>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-112 text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                <th className="pb-2 font-medium">Project</th>
                {weekDays.map((d) => (
                  <th key={d} className="pb-2 text-right font-medium">
                    {d}
                  </th>
                ))}
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-soft">
              {rows.map((r) => {
                const total = r.days.reduce((a, b) => a + b, 0);
                return (
                  <tr key={r.project}>
                    <td className="py-3">
                      <span className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-semibold text-white ${r.color}`}>
                          {r.initials}
                        </span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {r.project}
                        </span>
                      </span>
                    </td>
                    {r.days.map((h, i) => (
                      <td key={i} className="py-3 text-right text-zinc-600 dark:text-zinc-400">
                        {h ? `${h}h` : "—"}
                      </td>
                    ))}
                    <td className="py-3 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                      {total}h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}