import { Outlet } from "react-router-dom";
import useTheme from "../../hooks/useTheme";
import Button from "../../components/Button";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";

export default function UnauthenticatedLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app-shell min-h-screen p-4 sm:p-6">
      <div className="ambient-bg" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="relative z-10 flex min-h-[calc(100vh-2rem)] w-full items-center justify-center sm:min-h-[calc(100vh-3rem)]">
        <div className="w-full max-w-md">
          <div className="mb-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="flex items-center gap-2"
            >
              {theme === "dark" ? <SunIcon width={14} height={14} /> : <MoonIcon width={14} height={14} />}
              {theme === "dark" ? "Light" : "Dark"} mode
            </Button>
          </div>
          <div className="glass-card px-6 py-8 sm:px-10 sm:py-10">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
