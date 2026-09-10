/**
 * The workspace context and its accessor hook.
 *
 * The provider component lives in `./WorkspaceProvider`, so this file exports
 * only plain values and the shell file only exports a component.
 */
import { createContext, useContext } from "react";
import type { WorkspaceContextValue } from "../../types/workspace";

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);

/** Read (and change) the active workspace view. */
export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
