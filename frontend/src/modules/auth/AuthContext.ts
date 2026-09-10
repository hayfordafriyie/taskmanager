/**
 * The auth context and its accessor hook.
 *
 * The provider component lives in `./AuthProvider`; splitting them keeps each
 * file exporting either components or plain functions, which is what React Fast
 * Refresh needs — and lets tests mock `useAuth` without rendering a provider.
 */
import { createContext, useContext } from "react";
import type { AuthContextValue } from "../../types/auth";

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Read the signed-in user and the login/logout actions. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
