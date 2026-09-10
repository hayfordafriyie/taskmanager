/**
 * UI primitive types (buttons, selects, shared visual props).
 *
 * Components import these instead of declaring props inline, so the primitives
 * stay consistent across every page.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** The button styles offered by `components/Button`. */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** The button sizes offered by `components/Button`. */
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render as a react-router `Link` to this path instead of a `<button>`. */
  to?: string;
  className?: string;
  children?: ReactNode;
}

/** One entry in a `Select` dropdown. */
export interface SelectOption<TValue extends string = string> {
  value: TValue;
  label: string;
  disabled?: boolean;
}

export type SelectSize = "sm" | "md";

export interface SelectProps<TValue extends string = string> {
  value: TValue;
  onValueChange: (value: TValue) => void;
  options: ReadonlyArray<SelectOption<TValue>>;
  placeholder?: string;
  /** Accessible name for the trigger (queried by tests). */
  ariaLabel?: string;
  size?: SelectSize;
  className?: string;
  disabled?: boolean;
}

/** Basic props for a presentational panel/section wrapper. */
export interface PanelProps {
  children?: ReactNode;
  className?: string;
}

/** Accessible-name + children pair used by tooltips and icon buttons. */
export interface IconActionProps {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
}
