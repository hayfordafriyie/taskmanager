// The server's real reason must reach the user.
//
// GraphQL and fetch failures arrive in several shapes (Error, {errors:[{message}]},
// {message}, plain string), so pull the first usable message out of any of them.

function firstMessage(value) {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstMessage(entry);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    return firstMessage(value.message) ?? firstMessage(value.error);
  }
  return null;
}

/** Human readable message for anything thrown or returned by the API. */
export function errorMessage(error, fallback = "Something went wrong") {
  const direct = firstMessage(error);
  if (direct) return direct;
  if (error && typeof error === "object") {
    const nested =
      firstMessage(error.graphQLErrors) ??
      firstMessage(error.errors) ??
      firstMessage(error.response?.errors);
    if (nested) return nested;
  }
  return fallback;
}

export default errorMessage;
