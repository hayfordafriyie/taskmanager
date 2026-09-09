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

const dotShades = [
  "bg-indigo-400/80",
  "bg-emerald-400/80",
  "bg-amber-400/80",
  "bg-violet-400/80",
];

function DayCell({ day }) {
  if (day == null) {
    return <div aria-hidden="true" />;
  }
  const evts = events[day] || [];
  const shown = evts.slice(0, 4);
  const more = evts.length - shown.length;
  const hasEvents = evts.length > 0;

  return (
    <div className="glass-tile flex min-h-[4.5rem] flex-col rounded-xl p-1.5 transition-transform hover:-translate-y-0.5 sm:min-h-[6rem]">
      <div className="flex items-start justify-between gap-1">
        <span
          className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-display text-sm font-semibold leading-none sm:h-7 sm:min-w-7 sm:text-[15px] ${
            hasEvents ? "accent-text bg-[var(--accent-tint)]" : "t-ink"
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

      {hasEvents && (
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1.5 sm:flex-col sm:items-start sm:gap-1">
          {shown.map((e, i) => (
            <span
              key={e}
              title={e}
              className="flex min-w-0 max-w-full items-center gap-1"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full sm:h-1.5 sm:w-1.5 ${
                  dotShades[i % dotShades.length]
                }`}
              />
              <span className="hidden truncate rounded px-1.5 py-0.5 text-[10px] font-medium t-soft sm:inline">
                {e}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function CalendarView() {
  return (
    <div>
      <ViewHeader title="Calendar" subtitle="Your schedule and task deadlines at a glance." />
      <Panel className="mt-6">
        <header className="flex flex-wrap items-center justify-between gap-y-2">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold t-ink">
            <CalendarIcon width={16} height={16} className="t-faint" />
            September 2026
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              className="ring-accent rounded-full p-2 transition-colors text-[var(--ink-faint)] hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
            >
              <ChevronLeftIcon width={16} height={16} />
            </button>
            <button
              type="button"
              aria-label="Next month"
              className="ring-accent rounded-full p-2 transition-colors text-[var(--ink-faint)] hover:bg-[var(--glass-b)] hover:text-[var(--ink)]"
            >
              <ChevronRightIcon width={16} height={16} />
            </button>
          </div>
        </header>

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

export default CalendarView;
