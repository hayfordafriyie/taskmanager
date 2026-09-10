/**
 * UI primitive types (buttons, selects, shared visual props).
 *
 * Components import these instead of declaring props inline, so the primitives
 * stay consistent across every page.
 */
import type {
  ButtonHTMLAttributes,
  ComponentType,
  InputHTMLAttributes,
  ReactNode,
} from "react";

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
  /**
   * Node shown in the trigger instead of the raw label — pass a compact chip
   * (e.g. rounded initials) so long names don't stretch the layout. The real
   * label stays available to assistive tech.
   */
  renderValue?: ReactNode;
}

/** Sides a tooltip can be placed on. */
export type TooltipSide = "top" | "right" | "bottom" | "left";

export interface TooltipProps {
  content: ReactNode;
  side?: TooltipSide;
  children: ReactNode;
}

/** Shared props for text-like inputs that report their value on change. */
export interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className"> {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Marks the field as invalid (adds an error ring). */
  invalid?: boolean;
}

/** Props for the password field with the show/hide toggle. */
export interface PasswordInputProps extends FieldProps {
  placeholder?: string;
}

/** Props for the phone field (country picker + national number). */
export interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Props for the one-time-code field with its resend cooldown. */
export interface OtpEntryProps {
  value: string;
  onChange: (value: string) => void;
  /** Returns true when a new code was sent (restarts the cooldown). */
  onResend?: () => Promise<boolean | undefined> | boolean | undefined;
  disabled?: boolean;
  cooldownSeconds?: number;
}

/** An icon component as used in navigation items. */
export type IconComponent = ComponentType<{
  width?: number | string;
  height?: number | string;
  className?: string;
}>;

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

/** Tone of a toast notification. */
export type ToastType = "success" | "error" | "info";

/** The payload accepted by `useToast().show(...)`. */
export interface ToastOptions {
  type?: ToastType;
  /** Alias of `type` kept for older call sites. */
  kind?: ToastType;
  title?: string;
  description?: string;
  /** Alias of `description` kept for older call sites. */
  text?: string;
  /** Auto-dismiss delay in milliseconds. */
  duration?: number;
}

/** The toast API returned by `useToast()`. */
export interface ToastApi {
  show: (options?: ToastOptions) => void;
  success: (message?: string, title?: string) => void;
  error: (message?: string, title?: string) => void;
  info: (message?: string, title?: string) => void;
}

/** State of the currently visible toast. */
export interface ToastRecord {
  id: number;
  type: ToastType;
  title: string;
  description: string;
  duration: number;
}

/** Props for `components/Toast`'s provider. */
export interface ToastProviderProps {
  children?: ReactNode;
}

/** Props for the toast icon glyph. */
export interface ToastIconProps {
  type: ToastType;
}

/** Width presets for `components/Modal`. */
export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional trigger rendered as the dialog opener. */
  trigger?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  children?: ReactNode;
  /** Actions rendered in the footer row. */
  footer?: ReactNode;
}

/** Props for the auth gate that redirects anonymous visitors. */
export interface ProtectedRouteProps {
  children: ReactNode;
}
