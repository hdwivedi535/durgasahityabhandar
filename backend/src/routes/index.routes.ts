import type { FastifyInstance } from 'fastify';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { getPublicSiteSettings } from '../services/feature.service';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    data: { status: 'ok', timestamp: new Date().toISOString() },
  }));
}

export async function adminRoutes(app: FastifyInstance) {
  app.get(
    '/dashboard',
    { preHandler: [authenticate, requirePermission('enquiries.view')] },
    async (request) => ({
      data: {
        message: 'Admin dashboard shell ready',
        user: request.user?.name,
        modules: request.user?.moduleAccess,
      },
    }),
  );
}

export async function publicRoutes(app: FastifyInstance) {
  app.get('/settings', async () => ({
    data: await getPublicSiteSettings(),
  }));
}
