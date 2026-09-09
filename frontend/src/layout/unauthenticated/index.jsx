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
      <div className="relative z-10 flex min-h-[calc(100vh-3rem)] w-full items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="absolute top-0 right-0 flex items-center gap-2"
        >
          {theme === "dark" ? <SunIcon width={14} height={14} /> : <MoonIcon width={14} height={14} />}
          {theme === "dark" ? "Light" : "Dark"} mode
        </Button>
        <div className="glass-card w-full max-w-md px-8 py-10 sm:px-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
