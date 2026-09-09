export const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-offset-zinc-950";

export const buttonVariants = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 dark:bg-indigo-500 dark:text-white dark:hover:bg-indigo-400 dark:active:bg-indigo-600",
  secondary:
    "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700",
  ghost:
    "text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700",
  danger:
    "bg-red-600 text-white hover:bg-red-500 active:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400 dark:active:bg-red-600",
};

export const buttonSizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}