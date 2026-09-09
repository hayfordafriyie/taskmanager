import { useAuth } from "../../context/AuthContext";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Welcome, {user?.firstName ?? "there"}
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Home page (authenticated)
      </p>
      <div className="mt-4 max-w-lg rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        We send a text alert to your phone every time your account is accessed.
        If you just received a login alert you did not make, reset your
        password right away.
      </div>
    </div>
  );
}