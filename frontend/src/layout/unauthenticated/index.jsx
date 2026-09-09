import { Outlet } from "react-router-dom";
import useTheme from "../../hooks/useTheme";

export default function UnauthenticatedLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gray-100 p-4 dark:bg-zinc-950">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {theme === "dark" ? "Light" : "Dark"} mode
      </button>
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow dark:bg-zinc-900">
        <Outlet />
      </div>
    </div>
  );
}