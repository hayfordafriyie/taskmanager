import type {
  AvatarProps,
  PolicyBadgeProps,
  PriorityBadgeProps,
  SectionTitleProps,
  ViewHeaderProps,
} from "../../types/home";
import type { PanelProps } from "../../types/ui";

const priorityTint: Record<string, string> = {
  High: "tone-red",
  Medium: "tone-amber",
  Low: "tone-neutral",
};

const statusTint: Record<string, string> = {
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

export function PolicyBadge({
  children,
  tone = "zinc",
  className = "",
}: PolicyBadgeProps) {
  return (
    <span
      className={`badge rounded-full px-2.5 py-0.5 text-xs ${statusTint[tone] || statusTint.Low} ${className}`}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({ children, className = "" }: PriorityBadgeProps) {
  return (
    <span
      className={`badge rounded-full px-2.5 py-0.5 text-xs ${priorityTint[String(children)]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Panel({ children, className = "" }: PanelProps) {
  return <section className={`glass-card p-4 ${className}`}>{children}</section>;
}

export function SectionTitle({ title, icon: Icon }: SectionTitleProps) {
  return (
    <header className="flex items-center gap-2">
      {Icon && <Icon width={16} height={16} className="t-faint" />}
      <h2 className="t-ink font-display text-sm font-semibold uppercase tracking-wide">
        {title}
      </h2>
    </header>
  );
}

export function ViewHeader({
  title,
  subtitle = "Task Manager workspace",
}: ViewHeaderProps) {
  return (
    <div>
      <h1 className="t-ink font-display text-2xl font-bold tracking-tight">
        {title}
      </h1>
      <p className="t-soft mt-2 text-sm">{subtitle}</p>
    </div>
  );
}

export function Avatar({ initial, className = "" }: AvatarProps) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-400 to-zinc-700 text-xs font-semibold text-white shadow-sm ring-1 ring-white/30 ${className}`}
    >
      {initial}
    </span>
  );
}

/**
 * Compact assignee/team-member display: a rounded initials badge plus an
 * optional truncated name.
 *
 * Team members can have long names ("Kwabena Nkrumah-Agyeman Mensah"), which
 * used to blow out select triggers on task cards. In select triggers we show
 * the initials only (compact) with the full name in `title` and in the visually
 * hidden Select.Value; inside dropdown rows we show initials + a truncated name.
 *
 * The name/initials helpers themselves live in `./people`.
 */
