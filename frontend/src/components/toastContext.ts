/**
 * The toast context object on its own.
 *
 * It lives in a dependency-free module so the provider component
 * (`ToastProvider`) and the accessor hook (`Toast`) can both reach it, and so
 * tests that mock the hook module don't also blank out the context the provider
 * renders.
 */
import { createContext } from "react";
import type { ToastApi } from "../types/ui";

export const ToastContext = createContext<ToastApi | null>(null);
