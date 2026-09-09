import { Outlet } from "react-router-dom";
import useTheme from "../../hooks/useTheme";

export default function AuthenticatedLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-950">
      <nav className="flex items-center justify-between bg-white shadow p-4 dark:bg-zinc-900">
        <h1 className="font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Task Manager
        </h1>
        <button
          onClick={toggleTheme}
          className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {theme === "dark" ? "Light" : "Dark"} mode
        </button>
      </nav>
      <main className="p-8">
        <Outlet />
      </main>
    </div>
  );
}