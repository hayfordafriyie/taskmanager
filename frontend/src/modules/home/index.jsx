import { useWorkspace } from "./WorkspaceContext";
import {
  DashboardView,
  MyTasksView,
  BoardView,
  CalendarView,
  InboxView,
  GoalsView,
  DocsView,
  TimeView,
  ReportsView,
  InviteView,
} from "./views";

const views = {
  Dashboard: DashboardView,
  "My tasks": MyTasksView,
  Board: BoardView,
  Calendar: CalendarView,
  Inbox: InboxView,
  Goals: GoalsView,
  Docs: DocsView,
  Time: TimeView,
  Reports: ReportsView,
  Invite: InviteView,
};

export default function Home() {
  const { activeView } = useWorkspace();
  const View = views[activeView] ?? DashboardView;

  return (
    <div key={activeView} className="view-enter">
      <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        {activeView}
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Task Manager workspace
      </p>
      <div className="mt-6">
        <View />
      </div>
    </div>
  );
}