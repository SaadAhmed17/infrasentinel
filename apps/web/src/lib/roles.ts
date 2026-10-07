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

// What each role may do, matching the @Roles guards in the API
// (docs/sqa/RBAC_MATRIX.md). Shown in the role guide on the Settings page.
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  OWNER: 'Everything, including renaming the organization and giving others the owner role.',
  ADMIN: "Everything except giving the owner role or changing an owner's role.",
  SECURITY_ANALYST: 'Creates and edits rules and changes incident status. Sees servers and the team.',
  DEVOPS_ENGINEER: 'Adds, renames and deletes servers and replaces agent keys. Sees rules and incidents.',
  DEVELOPER: 'Sees servers, rules and incidents. The same access as a viewer for now.',
  VIEWER: "Sees servers, rules and incidents, but can't change anything.",
};

/** Roles that can be given through an invitation or the role menu (not owner). */
export const ASSIGNABLE_ROLES = Object.keys(ROLE_LABELS).filter((role) => role !== 'OWNER');

/** Owners and admins manage the team and the organization (PATCH /organizations/*). */
export function canManageTeam(role: string | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}
