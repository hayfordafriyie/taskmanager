import { TargetIcon } from "@radix-ui/react-icons";
import { Panel, ViewHeader, PolicyBadge } from "../ui";

const goals = [
  {
    id: 1,
    name: "Ship Task Manager v2",
    owner: "Hayford",
    status: "On track",
    progress: 72,
    results: [
      { id: 1, name: "Release mobile app", progress: 80 },
      { id: 2, name: "Reach 1,000 weekly users", progress: 60 },
      { id: 3, name: "Publish public API", progress: 75 },
    ],
  },
  {
    id: 2,
    name: "User onboarding sprint",
    owner: "Kojo",
    status: "At risk",
    progress: 40,
    results: [
      { id: 1, name: "Cut signup time to under 60s", progress: 55 },
      { id: 2, name: "Deliver interactive tour", progress: 25 },
    ],
  },
  {
    id: 3,
    name: "Design system adoption",
    owner: "Ama",
    status: "Behind",
    progress: 30,
    results: [
      { id: 1, name: "Migrate 10 core screens", progress: 45 },
      { id: 2, name: "Publish component docs", progress: 15 },
    ],
  },
];

function ProgressRing({ value }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r={radius} className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth="6" fill="none" />
      <circle
        cx="32"
        cy="32"
        r={radius}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="stroke-indigo-500"
        transform="rotate(-90 32 32)"
      />
      <text
        x="32"
        y="37"
        textAnchor="middle"
        className="fill-zinc-900 font-display text-sm font-bold dark:fill-zinc-100"
      >
        {value}%
      </text>
    </svg>
  );
}

export function GoalsView() {
  return (
    <div>
      <ViewHeader title="Goals" subtitle="Objectives and key results for the quarter." />
      <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {goals.map((g) => (
          <Panel key={g.id}>
            <header className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <TargetIcon width={16} height={16} className="t-faint shrink-0" />
                <h2 className="truncate font-display text-sm font-semibold t-ink">
                  {g.name}
                </h2>
              </div>
              <PolicyBadge tone={g.status} className="shrink-0">{g.status}</PolicyBadge>
            </header>
            <div className="mt-4 flex items-center gap-4">
              <ProgressRing value={g.progress} />
              <div className="min-w-0 flex-1">
                <p className="text-xs t-soft">Owner</p>
                <p className="text-sm font-medium t-ink">
                  {g.owner}
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-3 border-t border-[var(--border-subtle)] pt-4">
              {g.results.map((r) => (
                <li key={r.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="min-w-0 flex-1 truncate t-ink">
                      {r.name}
                    </span>
                    <span className="ml-3 text-xs t-faint">
                      {r.progress}%
                    </span>
                  </div>
                  <div className="track mt-1.5 h-1.5 w-full">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${r.progress}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </div>
  );
}