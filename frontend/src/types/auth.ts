/**
 * Authentication types — sign-in, the `/me` handshake and the auth context.
 */
import type { ReactNode } from "react";
import type { GqlVariables } from "./api";
import type { CurrentUser, ISODateString } from "./common";

/** The signed-in user as returned by `login` and `me`. */
export type AuthUser = CurrentUser;

/** Result of the `login` mutation. */
export interface LoginResult {
  success: boolean;
  message: string;
  user?: AuthUser | null;
  accessToken?: string | null;
  refreshToken?: string | null;
}

/** Result of the `refreshToken` mutation. */
export interface RefreshTokenResult {
  success: boolean;
  message: string;
  user?: AuthUser | null;
  accessToken?: string | null;
  refreshToken?: string | null;
}

/** Variables of the `login` mutation. */
export interface LoginVariables extends GqlVariables {
  phone: string;
  password: string;
}

/** Response data of the `login` mutation. */
export interface LoginData {
  login: LoginResult;
}

/** Response data of the `me` query. */
export interface MeData {
  me?: AuthUser | null;
}

/** Response data of the `logout` mutation. */
export interface LogoutData {
  logout: boolean;
}

/** Options accepted by `useMe` (only `enabled` is used today). */
export interface MeQueryOptions {
  enabled?: boolean;
}

/** Account created by the signup flow, as returned by `createAccount`. */
export interface CreateAccountResult {
  success: boolean;
  message: string;
  user?: AuthUser | null;
}

/** Result of the OTP request/verify pair used during signup. */
export interface OtpResult {
  success: boolean;
  message: string;
  expiresInSeconds?: number | null;
  retryAfterSeconds?: number | null;
}

/** Result of any password-reset mutation. */
export interface PasswordResetResult {
  success: boolean;
  message: string;
}

/** A stored session timestamp pair (kept for future "signed in at" labels). */
export interface SessionMeta {
  signedInAt?: ISODateString | null;
}

/** Everything the auth context exposes to the app. */
export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True while the stored session is still being validated on boot. */
  initializing: boolean;
  login: (phone: string, password: string) => Promise<LoginResult | undefined>;
  logout: () => Promise<void>;
}

/** Props of `AuthProvider`. */
export interface AuthProviderProps {
  children?: ReactNode;
}
