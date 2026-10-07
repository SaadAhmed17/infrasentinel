// Turns errors from fetch and the API into sentences people can act on.
// API messages that are already written for people pass through unchanged.

const NETWORK_ERRORS = ['Failed to fetch', 'NetworkError', 'Load failed', 'fetch failed'];

export const NETWORK_ERROR_MESSAGE = "Can't reach InfraSentinel. Check your connection and try again.";

export function isNetworkError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return NETWORK_ERRORS.some((text) => message.includes(text));
}

export function friendlyError(err: unknown, fallback = 'Something went wrong. Try again.') {
  if (isNetworkError(err)) return NETWORK_ERROR_MESSAGE;
  const message = err instanceof Error ? err.message.trim() : '';
  if (!message) return fallback;
  if (message === 'Forbidden resource') return "Your role can't do this. Ask an owner or admin.";
  if (message === 'Invalid credentials') return 'Email or password is incorrect.';
  if (message === 'Internal server error' || /^Request failed \(5\d\d/.test(message)) {
    return 'Something went wrong on our side. Try again in a moment.';
  }
  return message.charAt(0).toUpperCase() + message.slice(1);
}

/** The API answered 404 (the thing doesn't exist, or isn't in this organization). */
export function isNotFound(err: unknown) {
  return (err as { status?: number } | null)?.status === 404;
}
