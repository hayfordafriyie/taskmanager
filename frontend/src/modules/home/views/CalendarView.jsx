import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { Panel, ViewHeader } from "../ui";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const leadingBlank = 1;

const monthDays = Array.from({ length: 30 }, (_, i) => i + 1);

const events = {
  1: ["Backend deploy"],
  3: ["Q3 roadmap review"],
  7: ["Sprint planning"],
  10: ["Demo day", "Ship onboarding flow"],
  15: ["Mid-month sync"],
  22: ["Design review"],
  28: ["Team offsite"],
};

function DayCell({ day }) {
  if (day == null) {
    return <div />;
  }
  const evts = events[day] || [];
  return (
    <div className="glass-tile min-h-24 p-1.5">
      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        {day}
      </span>
      <div className="mt-1 space-y-1">
        {evts.slice(0, 2).map((e) => (
          <p
            key={e}
            className="truncate rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
          >
            {e}
          </p>
        ))}
        {evts.length > 2 && (
          <p className="px-1 text-[10px] text-zinc-400 dark:text-zinc-500">
            +{evts.length - 2} more
          </p>
        )}
      </div>
    </div>
  );
}

export function CalendarView() {
  return (
    <div>
      <ViewHeader title="Calendar" subtitle="Your schedule and task deadlines at a glance." />
      <Panel className="mt-6">
        <header className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold t-ink">
            <CalendarIcon width={16} height={16} className="text-zinc-400 dark:text-zinc-500" />
            September 2026
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              className="ring-accent rounded-lg p-1 transition-colors text-[var(--ink-faint)] hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
            >
              <ChevronLeftIcon width={16} height={16} />
            </button>
            <button
              type="button"
              aria-label="Next month"
              className="ring-accent rounded-lg p-1 transition-colors text-[var(--ink-faint)] hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
            >
              <ChevronRightIcon width={16} height={16} />
            </button>
          </div>
        </header>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {weekdays.map((d) => (
            <p
              key={d}
              className="pb-1 text-center text-xs font-semibold text-zinc-400 dark:text-zinc-500"
            >
              {d}
            </p>
          ))}
          {Array.from({ length: leadingBlank }, (_, i) => (
            <DayCell key={`blank-${i}`} day={null} />
          ))}
          {monthDays.map((d) => (
            <DayCell key={d} day={d} />
          ))}
        </div>
      </Panel>
    </div>
  );
}