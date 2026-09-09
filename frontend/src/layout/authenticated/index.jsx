import { Outlet } from "react-router-dom";
import { MoonIcon, SunIcon, ExitIcon } from "@radix-ui/react-icons";
import useTheme from "../../hooks/useTheme";
import { useAuth } from "../../modules/auth/AuthContext";
import { WorkspaceProvider } from "../../modules/home/WorkspaceContext";
import Button from "../../components/Button";
import Dock from "../../components/Dock";
import NotificationBell from "../../components/NotificationBell";
import Tooltip from "../../components/Tooltip";

export default function AuthenticatedLayout() {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-950">
      <WorkspaceProvider>
      <nav className="sticky top-0 z-40 flex items-center justify-between bg-white shadow p-4 dark:bg-zinc-900">
        <h1 className="font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Task Manager
        </h1>
        <div className="flex items-center gap-3">
          <Tooltip
            content={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              className="flex items-center gap-2"
            >
              {theme === "dark" ? (
                <SunIcon width={16} height={16} />
              ) : (
                <MoonIcon width={16} height={16} />
              )}
            </Button>
          </Tooltip>
          <NotificationBell />
          <Tooltip content="Logout">
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              aria-label="Logout"
              className="flex items-center gap-2"
            >
              <ExitIcon width={16} height={16} />
            </Button>
          </Tooltip>
        </div>
      </nav>
      <main className="p-8">
        <Outlet />
      </main>
      <Dock />
      </WorkspaceProvider>
    </div>
  );
}