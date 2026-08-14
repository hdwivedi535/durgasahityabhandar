import type { AuthUser, PermissionKey } from '@dsb/shared';

export function userHasPermission(user: AuthUser | null | undefined, permission: PermissionKey): boolean {
  if (!user) return false;
  if (user.roleSlugs.includes('super-admin')) return true;
  return user.permissions.includes(permission);
}
