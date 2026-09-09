import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { gql } from "../../lib/api";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [stage, setStage] = useState("phone");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  async function requestCode(e) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await gql(
        "mutation ($phone: String!) { requestPasswordReset(phone: $phone) { success message } }",
        { phone },
      );
      const result = res?.data?.requestPasswordReset;
      if (result?.success) {
        setStatus({
          kind: "ok",
          text: "A reset code was sent to your phone.",
        });
        setStage("code");
      } else {
        setStatus({
          kind: "error",
          text: result?.message ?? "Unexpected response",
        });
      }
    } catch (err) {
      setStatus({ kind: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function reset(e) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await gql(
        `mutation ($phone: String!, $code: String!, $password: String!, $confirmPassword: String!) {
          resetPassword(phone: $phone, code: $code, password: $password, confirmPassword: $confirmPassword) {
            success message
          }
        }`,
        { phone, code, password, confirmPassword: confirm },
      );
      const result = res?.data?.resetPassword;
      if (result?.success) {
        navigate("/login", {
          replace: true,
          state: { notice: "Password updated. Please log in again." },
        });
      } else {
        setStatus({
          kind: "error",
          text: result?.message ?? "Reset failed",
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
        Reset Password
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Verify your phone, then set a new password. Any other sessions on your
        account will be signed out.
      </p>

      <form
        onSubmit={stage === "phone" ? requestCode : reset}
        className="mt-6 space-y-4"
      >
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+233..."
          disabled={stage === "code"}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-indigo-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        {stage === "code" && (
          <>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Verification code"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </>
        )}
        <button
          type="submit"
          disabled={
            busy ||
            !phone ||
            (stage === "code" && (!code || !password || !confirm))
          }
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy
            ? "Working…"
            : stage === "phone"
              ? "Send reset code"
              : "Reset password"}
        </button>
      </form>

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