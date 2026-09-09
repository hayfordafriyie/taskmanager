import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/Button";
import PhoneInput from "../../components/PhoneInput";
import { useToast } from "../../components/Toast";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const notice = location.state?.notice || null;

  useEffect(() => {
    if (notice) {
      toast.info(notice);
    }
  }, [notice, toast]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!phone || !password) {
      toast.error("Phone and password are required.");
      return;
    }
    setBusy(true);
    try {
      const result = await login(phone, password);
      if (result?.success) {
        navigate("/", { replace: true });
      } else {
        toast.error(result?.message ?? "Login failed");
      }
    } catch (err) {
      toast.error(err.message);
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
    </div>
  );
}