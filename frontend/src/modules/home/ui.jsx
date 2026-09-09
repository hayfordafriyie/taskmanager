const priorityTint = {
  High: "tone-red",
  Medium: "tone-amber",
  Low: "tone-neutral",
};

const statusTint = {
  zinc: "tone-neutral",
  indigo: "tone-indigo",
  amber: "tone-amber",
  emerald: "tone-emerald",
  red: "tone-red",
  "To do": "tone-neutral",
  "In progress": "tone-indigo",
  Review: "tone-amber",
  Done: "tone-emerald",
  "On track": "tone-emerald",
  "At risk": "tone-red",
  Behind: "tone-amber",
  Member: "tone-neutral",
  Guest: "tone-neutral",
  Admin: "tone-indigo",
};

export function PolicyBadge({ children, tone = "zinc" }) {
  return (
    <span
      className={`badge rounded-full px-2.5 py-0.5 text-xs ${statusTint[tone] || statusTint.Low}`}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({ children }) {
  return (
    <span
      className={`badge rounded-full px-2.5 py-0.5 text-xs ${priorityTint[children]}`}
    >
      {children}
    </span>
  );
}

export function Panel({ children, className = "" }) {
  return (
    <section
      className={`glass-card p-4 ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionTitle({ title, icon: Icon }) {
  return (
    <header className="flex items-center gap-2">
      {Icon && (
        <Icon width={16} height={16} className="t-faint" />
      )}
      <h2 className="t-ink font-display text-sm font-semibold uppercase tracking-wide">
        {title}
      </h2>
    </header>
  );
}

export function ViewHeader({ title, subtitle = "Task Manager workspace" }) {
  return (
    <div>
      <h1 className="t-ink font-display text-2xl font-bold tracking-tight">
        {title}
      </h1>
      <p className="t-soft mt-2 text-sm">{subtitle}</p>
    </div>
  );
}

export function Avatar({ initial, className = "" }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-semibold text-white shadow-sm ring-1 ring-white/40 dark:ring-white/10 ${className}`}
    >
      {initial}
    </span>
  );
}