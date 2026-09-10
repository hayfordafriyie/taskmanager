import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { errorMessage } from "../../lib/errors";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Button from "../../components/Button";
import PhoneInput from "../../components/PhoneInput";
import PasswordInput from "../../components/PasswordInput";
import { useToast } from "../../components/Toast";
import type { AuthLocationState } from "../../types/auth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [phone, setPhone] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const notice =
    (location.state as AuthLocationState | null)?.notice || null;

  useEffect(() => {
    if (notice) {
      toast.info(notice);
    }
  }, [notice, toast]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
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
      toast.error(errorMessage(err, "Something went wrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="font-display text-2xl font-bold t-ink">
        Login
      </h1>
      <p className="mt-2 text-sm t-soft">
        Sign in to your account.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <PhoneInput value={phone} onChange={setPhone} />
        <PasswordInput
          value={password}
          onChange={setPassword}
          placeholder="Password"
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
        <p className="t-soft">
          No account?{" "}
          <Link
            to="/signup"
            className="accent-text font-medium hover:underline"
          >
            Sign up
          </Link>
        </p>
        <p className="t-soft">
          Don&apos;t remember your password?{" "}
          <Link
            to="/reset-password"
            className="accent-text font-medium hover:underline"
          >
            Reset it
          </Link>
        </p>
      </div>
    </div>
  );
}
