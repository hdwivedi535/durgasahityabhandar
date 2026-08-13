import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import type { AuthUser } from '@dsb/shared';

interface TokenPayload {
  sub: string;
  type: 'access' | 'refresh';
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'access' } satisfies TokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' } satisfies TokenPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  if (payload.type !== 'access') throw new Error('Invalid token type');
  return payload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
  if (payload.type !== 'refresh') throw new Error('Invalid token type');
  return payload;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function toAuthUser(user: {
  _id: { toString(): string };
  email: string;
  name: string;
  status: AuthUser['status'];
  accessScope: AuthUser['accessScope'];
  preferredLanguage: string;
  timezone: string;
  roles: Array<{ slug: string; moduleAccess: AuthUser['moduleAccess'][number][]; permissions: AuthUser['permissions'] }>;
}): AuthUser {
  const permissions = [...new Set(user.roles.flatMap((r) => r.permissions))];
  const moduleAccess = [...new Set(user.roles.flatMap((r) => r.moduleAccess))];

  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    status: user.status,
    roleSlugs: user.roles.map((r) => r.slug),
    permissions,
    moduleAccess,
    accessScope: user.accessScope,
    preferredLanguage: user.preferredLanguage,
    timezone: user.timezone,
  };
}
