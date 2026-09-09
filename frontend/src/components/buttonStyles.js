export const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold leading-none ring-accent disabled:opacity-50 disabled:pointer-events-none select-none";

export const buttonVariants = {
  primary: "btn-gloss-primary text-sm",
  secondary: "btn-gloss-secondary text-sm",
  ghost: "btn-gloss-ghost text-sm",
  danger: "btn-gloss-danger text-sm",
};

export const buttonSizes = {
  sm: "px-3 py-2",
  md: "px-4 py-2.5",
  lg: "px-6 py-3 text-base",
};

export function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}
