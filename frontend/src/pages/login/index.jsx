import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/Button";
import PhoneInput from "../../components/PhoneInput";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const notice = location.state?.notice || null;

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const result = await login(phone, password);
      if (result?.success) {
        navigate("/", { replace: true });
      } else {
        setStatus({
          kind: "error",
          text: result?.message ?? "Login failed",
        });
      }
    } catch (err) {
      setStatus({ kind: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Login
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Sign in to your account.
      </p>

      {notice && (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {notice}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <PhoneInput value={phone} onChange={setPhone} />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <Button
          type="submit"
          disabled={busy || !phone || !password}
          className="w-full"
        >
          {busy ? "Signing in…" : "Login"}
        </Button>
      </form>

      <div className="mt-4 space-y-1 text-sm">
        <p className="text-zinc-600 dark:text-zinc-400">
          No account?{" "}
          <Link
            to="/signup"
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Sign up
          </Link>
        </p>
        <p className="text-zinc-600 dark:text-zinc-400">
          Don&apos;t remember your password?{" "}
          <Link
            to="/reset-password"
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Reset it
          </Link>
        </p>
      </div>

      {status && (
        <p
          className={`mt-4 text-sm ${
            status.kind === "ok"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}