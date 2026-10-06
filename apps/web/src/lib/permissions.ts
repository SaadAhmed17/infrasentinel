// Roles the API allows to change SIEM rules and incident status (the @Roles on
// RulesController and IncidentsController). Other roles only get read access,
// so the UI hides the buttons instead of letting them fail with 403.
const SECURITY_MANAGER_ROLES = ['OWNER', 'ADMIN', 'SECURITY_ANALYST'];

// Roles the API allows to register servers and regenerate agent keys (the
// @Roles on ServersController).
const SERVER_MANAGER_ROLES = ['OWNER', 'ADMIN', 'DEVOPS_ENGINEER'];

export function canManageSecurity(role: string | null | undefined): boolean {
  return !!role && SECURITY_MANAGER_ROLES.includes(role);
}

export function canManageServers(role: string | null | undefined): boolean {
  return !!role && SERVER_MANAGER_ROLES.includes(role);
}
