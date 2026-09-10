import { Outlet } from "react-router-dom";
import useTheme from "../../hooks/useTheme";

export default function UnauthenticatedLayout() {
  // Applies the stored/system theme. Public pages intentionally show no
  // light/dark toggle — that control lives in the authenticated app bar.
  useTheme();

  return (
    <div className="app-shell min-h-screen p-4 sm:p-6">
      <div className="ambient-bg" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="relative z-10 flex min-h-[calc(100vh-2rem)] w-full items-center justify-center sm:min-h-[calc(100vh-3rem)]">
        <div className="glass-card w-full max-w-md px-6 py-8 sm:px-10 sm:py-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
