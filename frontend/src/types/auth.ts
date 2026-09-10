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

/** Result of the `verifyOTP` mutation (mirrors the GraphQL `VerifyOTPResult`). */
export interface VerifyOtpResult {
  success: boolean;
  message: string;
}

/** Variables shared by the phone-only mutations (`requestOTP`, `requestPasswordReset`). */
export interface PhoneVariables extends GqlVariables {
  phone: string;
}

/** Variables of the `verifyOTP` mutation. */
export interface VerifyOtpVariables extends GqlVariables {
  phone: string;
  code: string;
}

/** Variables of the `requestPasswordReset`/`resetPassword` pair. */
export interface ResetPasswordVariables extends GqlVariables {
  phone: string;
  code: string;
  password: string;
  confirmPassword: string;
}

/** Input object of the `createAccount` mutation (GraphQL `CreateAccountInput`). */
export interface CreateAccountInput {
  phone: string;
  firstName: string;
  surname: string;
  otherNames?: string | null;
  password: string;
  confirmPassword: string;
}

/** Variables of the `createAccount` mutation. */
export interface CreateAccountVariables extends GqlVariables {
  input: CreateAccountInput;
}

/** Response data of the `requestOTP` mutation. */
export interface RequestOtpData {
  requestOTP: OtpResult;
}

/** Response data of the `verifyOTP` mutation. */
export interface VerifyOtpData {
  verifyOTP: VerifyOtpResult;
}

/** Response data of the `createAccount` mutation. */
export interface CreateAccountData {
  createAccount: CreateAccountResult;
}

/** Response data of the `requestPasswordReset` mutation. */
export interface RequestPasswordResetData {
  requestPasswordReset: OtpResult;
}

/** Response data of the `resetPassword` mutation. */
export interface ResetPasswordData {
  resetPassword: PasswordResetResult;
}

/** The step machine of the signup page. */
export type SignupStage = "phone" | "otp" | "account";

/** The step machine of the reset-password page. */
export type ResetPasswordStage = "phone" | "code";

/** Router state handed to `/login` after signup or a password reset. */
export interface AuthLocationState {
  notice?: string;
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
