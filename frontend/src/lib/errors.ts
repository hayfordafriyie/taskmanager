// The server's real reason must reach the user.
//
// GraphQL and fetch failures arrive in several shapes (Error, {errors:[{message}]},
// {message}, plain string), so pull the first usable message out of any of them.
import type { ErrorPayload } from '../types/errors';

function firstMessage(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstMessage(entry);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    const payload = value as ErrorPayload;
    return firstMessage(payload.message) ?? firstMessage(payload.error);
  }
  return null;
}

/** Human readable message for anything thrown or returned by the API. */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  const direct = firstMessage(error);
  if (direct) return direct;
  if (error && typeof error === 'object') {
    const payload = error as ErrorPayload;
    const nested =
      firstMessage(payload.graphQLErrors) ??
      firstMessage(payload.errors) ??
      firstMessage(payload.response?.errors);
    if (nested) return nested;
  }
  return fallback;
}

export default errorMessage;
