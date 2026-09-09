import { useEffect, useState } from "react";
import Button from "./Button";

export default function OtpEntry({
  value,
  onChange,
  onResend,
  disabled = false,
  cooldownSeconds = 60,
}) {
  const [secondsLeft, setSecondsLeft] = useState(cooldownSeconds);
  const [running, setRunning] = useState(true);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!running) {
      return;
    }
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const locked = secondsLeft > 0 || disabled;

  async function handleResend() {
    if (locked || resending) {
      return;
    }
    setResending(true);
    try {
      const ok = await onResend?.();
      if (ok) {
        setSecondsLeft(cooldownSeconds);
        setRunning(true);
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Verification code"
        disabled={disabled}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-indigo-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      <Button
        variant="secondary"
        size="sm"
        onClick={handleResend}
        disabled={locked || resending}
        className="mt-3"
      >
        {resending
          ? "Resending…"
          : locked
            ? `Resend code (${secondsLeft}s)`
            : "Resend code"}
      </Button>
      {disabled && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          A verification code was sent to your phone.
        </p>
      )}
    </div>
  );
}