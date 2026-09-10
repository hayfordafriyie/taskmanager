/**
 * Small formatting helpers for people-shaped objects.
 *
 * These live apart from `ui.tsx` so that module only exports components —
 * a file that mixes components and plain functions breaks React Fast Refresh.
 */
import type { PersonNameFields } from "../../types/home";

/** Full display name for a person-like object ("Ama Osei"). */
export function personName(
  person?: PersonNameFields | null,
  fallback = "",
): string {
  if (!person) return fallback;
  return `${person.firstName ?? ""} ${person.surname ?? ""}`.trim() || fallback;
}

/** Rounded initials for a person-like object ("Ama Osei" -> "AO"). */
export function initialsOf(
  person?: PersonNameFields | null,
  fallback = "?",
): string {
  if (!person) return fallback;
  const initials =
    `${person.firstName?.[0] ?? ""}${person.surname?.[0] ?? ""}`.toUpperCase();
  return initials || fallback;
}
