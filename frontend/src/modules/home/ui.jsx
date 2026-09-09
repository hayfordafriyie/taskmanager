const priorityTint = {
  High: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

const statusTint = {
  "To do": "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  "In progress": "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  Review: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "On track": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "At risk": "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Behind: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Member: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  Guest: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  Admin: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
};

export function PolicyBadge({ children, tone = "zinc" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTint[tone] || statusTint.Low}`}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({ children }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityTint[children]}`}
    >
      {children}
    </span>
  );
}

export function Panel({ children, className = "" }) {
  return (
    <section
      className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionTitle({ title, icon: Icon }) {
  return (
    <header className="flex items-center gap-2">
      {Icon && (
        <Icon width={16} height={16} className="text-zinc-400 dark:text-zinc-500" />
      )}
      <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
    </header>
  );
}

export function ViewHeader({ title, subtitle = "Task Manager workspace" }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        {title}
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
    </div>
  );
}

export function Avatar({ initial, className = "" }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 ${className}`}
    >
      {initial}
    </span>
  );
}