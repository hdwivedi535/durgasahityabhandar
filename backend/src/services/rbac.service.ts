import type { PermissionKey } from '@dsb/shared';
import type { IPermission, IRole } from '../models/user.model';

export function resolveRolePermissions(
  roles: Array<IRole & { populatedPermissions?: IPermission[] }>,
  permissionDocs: IPermission[],
): PermissionKey[] {
  const permissionMap = new Map(permissionDocs.map((p) => [p._id.toString(), p.key]));

  const keys = new Set<PermissionKey>();
  for (const role of roles) {
    if (!role.isActive) continue;
    for (const permId of role.permissionIds) {
      const key = permissionMap.get(permId.toString());
      if (key) keys.add(key);
    }
  }
  return [...keys];
}

export function hasPermission(
  userPermissions: PermissionKey[],
  required: PermissionKey,
): boolean {
  return userPermissions.includes(required);
}

export function hasAnyPermission(
  userPermissions: PermissionKey[],
  required: PermissionKey[],
): boolean {
  return required.some((p) => userPermissions.includes(p));
}

export function validatePermissionGrant(
  granterPermissions: PermissionKey[],
  targetPermissions: PermissionKey[],
): void {
  for (const perm of targetPermissions) {
    if (!granterPermissions.includes(perm)) {
      throw new Error(`PERMISSION_ESCALATION: cannot grant ${perm}`);
    }
  }
}

export function resolveModuleAccess(roles: IRole[]): string[] {
  const modules = new Set<string>();
  for (const role of roles) {
    if (!role.isActive) continue;
    for (const mod of role.moduleAccess) modules.add(mod);
  }
  return [...modules];
}
