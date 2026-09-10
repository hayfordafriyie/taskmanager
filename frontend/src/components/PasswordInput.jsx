import { useState } from "react";
import { EyeOpenIcon, EyeClosedIcon } from "@radix-ui/react-icons";

const fieldClass =
  "control w-full rounded-[0.85rem] px-3.5 py-2.5 pr-10 text-sm";

export default function PasswordInput({ value, onChange, placeholder, disabled, invalid }) {
  const [visible, setVisible] = useState(false);
  const type = visible ? "text" : "password";

  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={`${fieldClass}${invalid ? " ring-1 ring-red-500" : ""}`}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((v) => !v)}
        className="ring-accent absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 t-faint transition-colors hover:text-[var(--ink)]"
      >
        {visible ? (
          <EyeClosedIcon width={16} height={16} />
        ) : (
          <EyeOpenIcon width={16} height={16} />
        )}
      </button>
    </div>
  );
}