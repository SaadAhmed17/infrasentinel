// The page to return to after signing in (?next=/servers/abc). Only paths on
// this site are accepted, so the parameter can't send people elsewhere.
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  if (value.startsWith('/login') || value.startsWith('/signup')) return null;
  return value;
}

/** /login?next=<the current page>, for a session that has run out. */
export function loginUrlWithNext() {
  const here = `${window.location.pathname}${window.location.search}`;
  return here === '/' || here.startsWith('/login') ? '/login' : `/login?next=${encodeURIComponent(here)}`;
}
