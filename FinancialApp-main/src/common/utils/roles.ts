export const PRIVILEGED_ROLES = ['admin', 'compliance', 'system'] as const;

export function hasPrivilegedRole(roles?: string[]): boolean {
  return (roles ?? []).some((role) =>
    PRIVILEGED_ROLES.includes(role as (typeof PRIVILEGED_ROLES)[number]),
  );
}
