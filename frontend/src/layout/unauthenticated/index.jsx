import { Outlet } from "react-router-dom";
import useTheme from "../../hooks/useTheme";
import Button from "../../components/Button";

export default function UnauthenticatedLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gray-100 p-4 dark:bg-zinc-950">
      <Button
        variant="secondary"
        size="sm"
        onClick={toggleTheme}
        className="absolute top-4 right-4"
      >
        {theme === "dark" ? "Light" : "Dark"} mode
      </Button>
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow dark:bg-zinc-900">
        <Outlet />
      </div>
    </div>
  );
}