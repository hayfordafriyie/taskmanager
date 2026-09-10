import { createContext, useContext, useState } from "react";
import type {
  WorkspaceContextValue,
  WorkspaceProviderProps,
  WorkspaceView,
} from "../../types/workspace";

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [activeView, setActiveView] = useState<WorkspaceView>("Dashboard");

  return (
    <WorkspaceContext.Provider value={{ activeView, setActiveView }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
