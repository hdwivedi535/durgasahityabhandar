import type { FastifyInstance } from 'fastify';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

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
    data: {
      publisher: { name: 'Durga Sahitya Bhandar' },
      features: {
        bookCatalogue: true,
        enquiries: true,
        whatsapp: true,
        publicTracking: true,
      },
      languages: [
        { code: 'en', name: 'English', isDefault: true },
        { code: 'hi', name: 'Hindi' },
        { code: 'sa', name: 'Sanskrit' },
        { code: 'ne', name: 'Nepali' },
      ],
    },
  }));
}
