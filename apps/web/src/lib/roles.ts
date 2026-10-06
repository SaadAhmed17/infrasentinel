// Display names for the six organization roles (the API uses the enum values).
export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  SECURITY_ANALYST: 'Security analyst',
  DEVOPS_ENGINEER: 'DevOps engineer',
  DEVELOPER: 'Developer',
  VIEWER: 'Viewer',
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '';
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ').toLowerCase();
}
