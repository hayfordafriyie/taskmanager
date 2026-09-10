/** Types for the authenticated workspace shell (`modules/home`). */

import type { IconComponent } from "./ui";

/** The label of a workspace view (matches a `Dock` entry and a `views` key). */
export type WorkspaceView =
  | "Dashboard"
  | "My tasks"
  | "Board"
  | "Calendar"
  | "Inbox"
  | "Goals"
  | "Docs"
  | "Time"
  | "Reports"
  | "Invite";

/** Shared state exposed by `WorkspaceProvider`. */
export interface WorkspaceContextValue {
  /** Currently selected workspace view. */
  activeView: WorkspaceView;
  /** Select another workspace view. */
  setActiveView: (view: WorkspaceView) => void;
}

/** One entry in the workspace dock. */
export interface DockItem {
  label: WorkspaceView;
  Icon: IconComponent;
}
