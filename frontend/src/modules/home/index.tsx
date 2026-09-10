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
import type { ComponentType } from "react";
import type { WorkspaceView } from "../../types/workspace";

const views: Record<WorkspaceView, ComponentType> = {
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
      <View />
    </div>
  );
}
