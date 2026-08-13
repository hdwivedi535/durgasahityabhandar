import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthError, getCurrentUser, login, logout, refresh } from '../services/auth.service';
import { loginSchema } from '../validators/auth.validator';
import { env } from '../config/env';
import { authenticate } from '../middleware/auth.middleware';

const REFRESH_COOKIE = 'refreshToken';
const ACCESS_COOKIE = 'accessToken';

function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
  reply.setCookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60,
  });
  reply.setCookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60,
  });
}

function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie(ACCESS_COOKIE, { path: '/' });
  reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: parsed.error.flatten(),
        },
      });
    }

    try {
      const result = await login(parsed.data.email, parsed.data.password);
      setAuthCookies(reply, result.accessToken, result.refreshToken);
      return reply.send({
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(401).send({
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies?.[REFRESH_COOKIE];
    if (!token) {
      return reply.status(401).send({
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token missing' },
      });
    }

    try {
      const result = await refresh(token);
      setAuthCookies(reply, result.accessToken, result.refreshToken);
      return reply.send({
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      clearAuthCookies(reply);
      if (err instanceof AuthError) {
        return reply.status(401).send({
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  app.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    if (request.userId) await logout(request.userId);
    clearAuthCookies(reply);
    return reply.send({ data: { success: true } });
  });

  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    return reply.send({ data: { user: request.user } });
  });
}
