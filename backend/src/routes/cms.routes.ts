import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import {
  CmsError,
  getPublicCmsPage,
  getPublicHomepage,
  listCmsPages,
  listHomepageSections,
  reorderHomepageSections,
  updateCmsPage,
  updateHomepageSection,
} from '../services/cms.service';

function handleError(err: unknown, reply: FastifyReply) {
  if (err instanceof CmsError) {
    const status = err.code === 'NOT_FOUND' ? 404 : 400;
    return reply.status(status).send({ error: { code: err.code, message: err.message } });
  }
  throw err;
}

const pageUpdateSchema = z.object({
  status: z.enum(['draft', 'published', 'hidden']).optional(),
  isVisible: z.boolean().optional(),
  translations: z
    .array(
      z.object({
        languageCode: z.string().min(2).max(5),
        title: z.string().min(1).max(300),
        body: z.string().max(50000).optional().default(''),
      }),
    )
    .optional(),
});

const sectionUpdateSchema = z.object({
  isVisible: z.boolean().optional(),
  publishStatus: z.enum(['draft', 'published']).optional(),
  sortOrder: z.number().int().optional(),
  config: z.record(z.unknown()).optional(),
});

export async function adminCmsRoutes(app: FastifyInstance) {
  app.get(
    '/pages',
    { preHandler: [authenticate, requirePermission('website.view')] },
    async (_request, reply) => {
      const data = await listCmsPages();
      return reply.send({ data });
    },
  );

  app.patch(
    '/pages/:id',
    { preHandler: [authenticate, requirePermission('website.edit')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const parsed = pageUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
      }
      try {
        const data = await updateCmsPage(id, parsed.data);
        return reply.send({ data });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.get(
    '/homepage',
    { preHandler: [authenticate, requirePermission('website.view')] },
    async (_request, reply) => {
      const data = await listHomepageSections(false);
      return reply.send({ data });
    },
  );

  app.patch(
    '/homepage/:id',
    { preHandler: [authenticate, requirePermission('website.edit')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const parsed = sectionUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
      }
      try {
        const data = await updateHomepageSection(id, parsed.data);
        return reply.send({ data });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.post(
    '/homepage/reorder',
    { preHandler: [authenticate, requirePermission('website.edit')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = z
        .object({ items: z.array(z.object({ id: z.string(), sortOrder: z.number().int() })) })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
      }
      await reorderHomepageSections(parsed.data.items);
      return reply.send({ data: { success: true } });
    },
  );
}

export async function publicCmsRoutes(app: FastifyInstance) {
  app.get('/homepage', async (_request, reply) => {
    const data = await getPublicHomepage();
    return reply.send({ data });
  });

  app.get('/pages/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    const lang = (request.query as { lang?: string }).lang ?? 'en';
    const data = await getPublicCmsPage(slug, lang);
    if (!data) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Page not found' } });
    }
    return reply.send({ data });
  });
}
