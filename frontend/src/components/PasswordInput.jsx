import { useState } from "react";
import { EyeOpenIcon, EyeClosedIcon } from "@radix-ui/react-icons";

const fieldClass =
  "control w-full rounded-[0.85rem] px-3.5 py-2.5 pr-10 text-sm";

export default function PasswordInput({ value, onChange, placeholder, disabled }) {
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
        className={fieldClass}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:text-zinc-300"
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