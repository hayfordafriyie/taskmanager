import { Outlet } from "react-router-dom";
import useTheme from "../../hooks/useTheme";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/Button";

export default function AuthenticatedLayout() {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-950">
      <nav className="flex items-center justify-between bg-white shadow p-4 dark:bg-zinc-900">
        <h1 className="font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Task Manager
        </h1>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={toggleTheme}>
            {theme === "dark" ? "Light" : "Dark"} mode
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}>
            Logout
          </Button>
        </div>
      </nav>
      <main className="p-8">
        <Outlet />
      </main>
    </div>
  );
}