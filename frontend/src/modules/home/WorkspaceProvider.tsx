import { useState } from "react";
import { WorkspaceContext } from "./WorkspaceContext";
import type {
  WorkspaceProviderProps,
  WorkspaceView,
} from "../../types/workspace";

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [activeView, setActiveView] = useState<WorkspaceView>("Dashboard");

  return (
    <WorkspaceContext.Provider value={{ activeView, setActiveView }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export default WorkspaceProvider;
