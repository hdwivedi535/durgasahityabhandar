import type { AuthUser, PermissionKey } from '@dsb/shared';
import { Permission, Role, User, type IUser } from '../models/user.model';
import { comparePassword, hashPassword } from '../utils/password';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  toAuthUser,
  verifyRefreshToken,
} from '../utils/jwt';
import { resolveRolePermissions, resolveModuleAccess } from './rbac.service';

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function loadUserWithRoles(userId: string) {
  const user = await User.findById(userId);
  if (!user) return null;

  const roles = await Role.find({ _id: { $in: user.roleIds }, isActive: true });
  const permissions = await Permission.find({});
  const permissionKeys = resolveRolePermissions(roles, permissions);

  return {
    user,
    roles,
    permissionKeys,
    moduleAccess: resolveModuleAccess(roles),
  };
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');

  if (user.status !== 'active') {
    throw new AuthError('ACCOUNT_INACTIVE', 'Account is not active');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');

  const loaded = await loadUserWithRoles(user._id.toString());
  if (!loaded) throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');

  const accessToken = signAccessToken(user._id.toString());
  const refreshToken = signRefreshToken(user._id.toString());

  user.refreshTokenHash = hashToken(refreshToken);
  user.lastLoginAt = new Date();
  await user.save();

  const authUser = toAuthUser({
    _id: user._id,
    email: user.email,
    name: user.name,
    status: user.status,
    accessScope: user.accessScope,
    preferredLanguage: user.preferredLanguage,
    timezone: user.timezone,
    roles: loaded.roles.map((role) => ({
      slug: role.slug,
      moduleAccess: role.moduleAccess,
      permissions: loaded.permissionKeys,
    })),
  });

  return { user: authUser, accessToken, refreshToken };
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') {
    throw new AuthError('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }

  if (!user.refreshTokenHash || user.refreshTokenHash !== hashToken(refreshToken)) {
    throw new AuthError('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }

  const accessToken = signAccessToken(user._id.toString());
  const newRefreshToken = signRefreshToken(user._id.toString());
  user.refreshTokenHash = hashToken(newRefreshToken);
  await user.save();

  const loaded = await loadUserWithRoles(user._id.toString());
  if (!loaded) throw new AuthError('INVALID_REFRESH_TOKEN', 'Invalid refresh token');

  const authUser = toAuthUser({
    _id: user._id,
    email: user.email,
    name: user.name,
    status: user.status,
    accessScope: user.accessScope,
    preferredLanguage: user.preferredLanguage,
    timezone: user.timezone,
    roles: loaded.roles.map((role) => ({
      slug: role.slug,
      moduleAccess: role.moduleAccess,
      permissions: loaded.permissionKeys,
    })),
  });

  return { user: authUser, accessToken, refreshToken: newRefreshToken };
}

export async function logout(userId: string) {
  await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
}

export async function getCurrentUser(userId: string): Promise<AuthUser | null> {
  const loaded = await loadUserWithRoles(userId);
  if (!loaded) return null;

  const { user, roles, permissionKeys } = loaded;
  if (user.status !== 'active') return null;

  return toAuthUser({
    _id: user._id,
    email: user.email,
    name: user.name,
    status: user.status,
    accessScope: user.accessScope,
    preferredLanguage: user.preferredLanguage,
    timezone: user.timezone,
    roles: roles.map((role) => ({
      slug: role.slug,
      moduleAccess: role.moduleAccess,
      permissions: permissionKeys,
    })),
  });
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  roleIds: string[];
  createdBy?: string;
}): Promise<IUser> {
  const passwordHash = await hashPassword(input.password);
  return User.create({
    email: input.email.toLowerCase().trim(),
    passwordHash,
    name: input.name,
    roleIds: input.roleIds,
    status: 'active',
    createdBy: input.createdBy,
  });
}

export function userHasPermission(user: AuthUser, permission: PermissionKey): boolean {
  if (user.roleSlugs.includes('super-admin')) return true;
  return user.permissions.includes(permission);
}
