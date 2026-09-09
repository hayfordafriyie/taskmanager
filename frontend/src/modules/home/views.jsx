function ViewPlaceholder({ title, description }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
      <p className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}

export function DashboardView() {
  return (
    <ViewPlaceholder
      title="Dashboard"
      description="An overview of your progress is coming soon."
    />
  );
}

export function MyTasksView() {
  return (
    <ViewPlaceholder
      title="My tasks"
      description="Your personal task list is coming soon."
    />
  );
}

export function BoardView() {
  return (
    <ViewPlaceholder
      title="Board"
      description="Kanban-style task columns are coming soon."
    />
  );
}

export function CalendarView() {
  return (
    <ViewPlaceholder
      title="Calendar"
      description="Schedule and deadlines are coming soon."
    />
  );
}

export function InboxView() {
  return (
    <ViewPlaceholder
      title="Inbox"
      description="Team activity and mentions are coming soon."
    />
  );
}

export function GoalsView() {
  return (
    <ViewPlaceholder
      title="Goals"
      description="Track your objectives and key results here."
    />
  );
}

export function DocsView() {
  return (
    <ViewPlaceholder
      title="Docs"
      description="Shared notes and documents are coming soon."
    />
  );
}

export function TimeView() {
  return (
    <ViewPlaceholder
      title="Time"
      description="Time tracking and estimates are coming soon."
    />
  );
}

export function ReportsView() {
  return (
    <ViewPlaceholder
      title="Reports"
      description="Workload and productivity reports are coming soon."
    />
  );
}

export function InviteView() {
  return (
    <ViewPlaceholder
      title="Invite"
      description="Invite teammates to collaborate here."
    />
  );
}