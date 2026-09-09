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
        className="control w-full rounded-[0.85rem] px-3.5 py-2.5 text-sm"
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
        <p className="mt-2 text-xs t-soft">
          A verification code was sent to your phone.
        </p>
      )}
    </div>
  );
}