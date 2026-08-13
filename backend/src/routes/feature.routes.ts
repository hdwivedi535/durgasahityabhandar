import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { FEATURE_TOGGLE_KEYS } from '@dsb/shared';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { listFeatureToggles, updateFeatureToggle } from '../services/feature.service';

export async function adminFeatureRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { preHandler: [authenticate, requirePermission('settings.view')] },
    async (_request, reply) => {
      const data = await listFeatureToggles();
      return reply.send({ data });
    },
  );

  app.patch(
    '/:key',
    { preHandler: [authenticate, requirePermission('settings.edit')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { key } = request.params as { key: string };
      if (!FEATURE_TOGGLE_KEYS.includes(key as (typeof FEATURE_TOGGLE_KEYS)[number])) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Unknown toggle' } });
      }
      const parsed = z.object({ enabled: z.boolean() }).safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
      }
      const data = await updateFeatureToggle(
        key as (typeof FEATURE_TOGGLE_KEYS)[number],
        parsed.data.enabled,
      );
      return reply.send({ data });
    },
  );
}
