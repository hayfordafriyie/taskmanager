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
    <div className="app-shell">
      <div className="ambient-bg" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="relative z-10">
        <WorkspaceProvider>
          <header className="glass-nav fixed inset-x-0 top-3 z-50 mx-auto flex w-[calc(100%-1rem)] max-w-6xl items-center justify-between gap-2 rounded-2xl px-3 py-2 sm:top-4 sm:w-[calc(100%-1.5rem)] sm:gap-3 sm:px-5 sm:py-2.5">
            <h1 className="min-w-0 shrink font-display text-base font-bold tracking-tight sm:text-lg">
              <span className="accent-text">Task</span>
              <span className="t-ink"> Manager</span>
            </h1>
            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
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
                >
                  {theme === "dark" ? (
                    <SunIcon width={15} height={15} />
                  ) : (
                    <MoonIcon width={15} height={15} />
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
                >
                  <ExitIcon width={15} height={15} />
                </Button>
              </Tooltip>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl px-3 pt-[5.5rem] pb-28 sm:px-6 sm:pt-24">
            <Outlet />
          </main>
          <Dock />
        </WorkspaceProvider>
      </div>
    </div>
  );
}
