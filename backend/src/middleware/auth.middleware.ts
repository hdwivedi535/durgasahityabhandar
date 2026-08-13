import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PermissionKey } from '@dsb/shared';
import { verifyAccessToken } from '../utils/jwt';
import { getCurrentUser, userHasPermission } from '../services/auth.service';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    user?: Awaited<ReturnType<typeof getCurrentUser>>;
    requestId?: string;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  const cookieToken = request.cookies?.accessToken;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : cookieToken;

  if (!token) {
    return reply.status(401).send({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await getCurrentUser(payload.sub);
    if (!user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }
    request.userId = payload.sub;
    request.user = user;
  } catch {
    return reply.status(401).send({
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    });
  }
}

export async function optionalAuthenticate(request: FastifyRequest, _reply: FastifyReply) {
  const header = request.headers.authorization;
  const cookieToken = request.cookies?.accessToken;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : cookieToken;
  if (!token) return;

  try {
    const payload = verifyAccessToken(token);
    const user = await getCurrentUser(payload.sub);
    if (!user) return;
    request.userId = payload.sub;
    request.user = user;
  } catch {
    // public request continues unauthenticated
  }
}

export function requirePermission(permission: PermissionKey) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }

    if (!userHasPermission(request.user, permission)) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }
  };
}

export function requireModule(module: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }

    if (
      !request.user.roleSlugs.includes('super-admin') &&
      !request.user.moduleAccess.includes(module as (typeof request.user.moduleAccess)[number])
    ) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Module access denied' },
      });
    }
  };
}
