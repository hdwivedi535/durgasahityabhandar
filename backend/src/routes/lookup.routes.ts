import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import {
  LookupError,
  createLookup,
  deleteLookup,
  ensureDefaultLookups,
  listLookups,
  updateLookup,
} from '../services/lookup.service';
import type { LookupKind } from '@dsb/shared';
import { LOOKUP_KINDS } from '@dsb/shared';

function handleError(err: unknown, reply: FastifyReply) {
  if (err instanceof LookupError) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'SLUG_EXISTS' ? 409 : 400;
    return reply.status(status).send({ error: { code: err.code, message: err.message } });
  }
  throw err;
}

const createSchema = z.object({
  kind: z.enum(['pageType', 'bindingType', 'subject', 'tag', 'availability']),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(120),
  displayOrder: z.number().int().optional(),
});

const updateSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  name: z.string().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export async function adminLookupRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { preHandler: [authenticate, requirePermission('books.view')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      await ensureDefaultLookups();
      const kind = (request.query as { kind?: string }).kind as LookupKind | undefined;
      if (kind && !LOOKUP_KINDS.includes(kind)) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid kind' } });
      }
      const data = await listLookups(kind);
      return reply.send({ data });
    },
  );

  app.post(
    '/',
    { preHandler: [authenticate, requirePermission('books.edit')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const data = await createLookup(parsed.data);
        return reply.status(201).send({ data });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.patch(
    '/:id',
    { preHandler: [authenticate, requirePermission('books.edit')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
      }
      try {
        const data = await updateLookup(id, parsed.data);
        return reply.send({ data });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.delete(
    '/:id',
    { preHandler: [authenticate, requirePermission('books.edit')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      try {
        await deleteLookup(id);
        return reply.send({ data: { success: true } });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );
}
