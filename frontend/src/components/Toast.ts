/**
 * The toast accessor hook.
 *
 * The context object lives in `./toastContext` and the provider component in
 * `./ToastProvider`, so this file exports only a plain function.
 */
import { useContext } from "react";
import { ToastContext } from "./toastContext";
import type { ToastApi } from "../types/ui";

/** Show a toast from anywhere inside a `ToastProvider`. */
export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
