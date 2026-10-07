// Shared helpers for incidents: display titles and ordering.

export const SEVERITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/**
 * The API titles grouped incidents like "Disk almost full + 1 more alert(s)".
 * The alert count is shown separately, so the suffix is dropped here.
 */
export function incidentTitle(title: string) {
  return title.replace(/\s*\+\s*\d+\s+more alert(\(s\)|s)?\s*$/i, '').trim();
}

/** Most severe first, then newest first. */
export function bySeverityThenRecent<T extends { severity: string; createdAt: string }>(a: T, b: T) {
  return (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) || b.createdAt.localeCompare(a.createdAt);
}

export const isOpenIncident = (status: string) => status === 'OPEN' || status === 'INVESTIGATING';
