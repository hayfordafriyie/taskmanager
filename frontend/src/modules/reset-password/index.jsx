import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import PhoneInput from "../../components/PhoneInput";
import PasswordInput from "../../components/PasswordInput";
import OtpEntry from "../../components/OtpEntry";
import { useToast } from "../../components/Toast";
import { useRequestPasswordReset } from "./hooks/useRequestPasswordReset";
import { useResetPassword } from "./hooks/useResetPassword";

export default function ResetPassword() {
  const navigate = useNavigate();
  const toast = useToast();
  const requestCode = useRequestPasswordReset();
  const reset = useResetPassword();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [stage, setStage] = useState("phone");

  async function requestResetCode() {
    if (!phone) {
      return false;
    }
    try {
      const res = await requestCode.mutateAsync(phone);
      const result = res?.data?.requestPasswordReset;
      if (result?.success) {
        toast.success(result?.message ?? "A reset code was sent to your phone.");
        return true;
      }
      toast.error(result?.message ?? "Unexpected response");
      return false;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }

  async function handleRequest(e) {
    e.preventDefault();
    if (!phone) {
      toast.error("Enter your phone number first.");
      return;
    }
    const ok = await requestResetCode();
    if (ok) {
      setStage("code");
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    try {
      const res = await reset.mutateAsync({
        phone,
        code,
        password,
        confirmPassword: confirm,
      });
      const result = res?.data?.resetPassword;
      if (result?.success) {
        navigate("/login", {
          replace: true,
          state: { notice: "Password updated. Please log in again." },
        });
      } else {
        toast.error(result?.message ?? "Reset failed");
      }
    } catch (err) {
      toast.error(err.message);
    }
  }

  const requesting = requestCode.isPending;
  const resetting = reset.isPending;

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
        onSubmit={stage === "phone" ? handleRequest : handleReset}
        className="mt-6 space-y-4"
      >
        <PhoneInput
          value={phone}
          onChange={setPhone}
          disabled={stage === "code"}
        />
        {stage === "code" && (
          <>
            <OtpEntry
              value={code}
              onChange={setCode}
              onResend={requestResetCode}
            />
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="New password"
            />
            <PasswordInput
              value={confirm}
              onChange={setConfirm}
              placeholder="Confirm new password"
            />
          </>
        )}
        <Button
          type="submit"
          disabled={
            requesting ||
            resetting ||
            !phone ||
            (stage === "code" && (!code || !password || !confirm))
          }
          className="w-full"
        >
          {requesting || resetting
            ? "Working…"
            : stage === "phone"
              ? "Send reset code"
              : "Reset password"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        <Link
          to="/login"
          className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}