import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import {
  archiveCategorySchema,
  categoryQuerySchema,
  createCategorySchema,
  moveCategorySchema,
  reorderCategoriesSchema,
  updateCategorySchema,
} from '../validators/category.validator';
import {
  CategoryError,
  archiveCategory,
  createCategory,
  getCategoryById,
  getCategoryTree,
  listCategories,
  moveCategory,
  reorderCategories,
  updateCategory,
} from '../services/category.service';
import {
  buildCategoryTemplate,
  confirmCategoryImport,
  exportCategories,
  previewCategoryImport,
} from '../services/category-import.service';
import type { CategoryImportPayload } from '@dsb/shared';

function handleError(err: unknown, reply: FastifyReply) {
  if (err instanceof CategoryError) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'SLUG_EXISTS' ? 409 : 400;
    return reply.status(status).send({ error: { code: err.code, message: err.message } });
  }
  throw err;
}

const confirmSchema = z.object({
  rows: z.array(z.record(z.any())).min(1),
});

async function readUpload(request: FastifyRequest): Promise<{
  buffer: Buffer;
  filename: string;
  mimetype?: string;
}> {
  const file = await request.file();
  if (!file) throw new Error('No file uploaded');
  const buffer = await file.toBuffer();
  return { buffer, filename: file.filename, mimetype: file.mimetype };
}

export async function adminCategoryRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  app.get(
    '/',
    { preHandler: [authenticate, requirePermission('categories.view')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = categoryQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: parsed.error.flatten() },
        });
      }
      const { search, status, parentId } = parsed.data;
      const tree = request.query && (request.query as { tree?: string }).tree === 'true';
      if (tree) {
        const data = await getCategoryTree(false);
        return reply.send({ data });
      }
      const data = await listCategories({
        search,
        status,
        parentId: parentId === 'null' ? null : parentId,
      });
      return reply.send({ data });
    },
  );

  app.get(
    '/import/template',
    { preHandler: [authenticate, requirePermission('categories.create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const format = (request.query as { format?: string }).format === 'xlsx' ? 'xlsx' : 'csv';
      const file = buildCategoryTemplate(format);
      return reply
        .header('Content-Type', file.contentType)
        .header('Content-Disposition', `attachment; filename="${file.filename}"`)
        .send(file.buffer);
    },
  );

  app.get(
    '/export',
    { preHandler: [authenticate, requirePermission('categories.view')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const q = request.query as { format?: string; search?: string };
      const format = q.format === 'xlsx' ? 'xlsx' : 'csv';
      const file = await exportCategories({ format, search: q.search });
      return reply
        .header('Content-Type', file.contentType)
        .header('Content-Disposition', `attachment; filename="${file.filename}"`)
        .send(file.buffer);
    },
  );

  app.post(
    '/import/preview',
    { preHandler: [authenticate, requirePermission('categories.create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const upload = await readUpload(request);
        const data = await previewCategoryImport(upload.buffer, upload.filename, upload.mimetype);
        return reply.send({ data });
      } catch (err) {
        return reply.status(400).send({
          error: {
            code: 'IMPORT_PARSE_ERROR',
            message: err instanceof Error ? err.message : 'Failed to parse import file',
          },
        });
      }
    },
  );

  app.post(
    '/import/confirm',
    { preHandler: [authenticate, requirePermission('categories.create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = confirmSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid import payload' },
        });
      }
      const payloads = parsed.data.rows as CategoryImportPayload[];
      const hasUpdates = payloads.some((p) => Boolean(p.existingCategoryId));
      if (hasUpdates) {
        const user = request.user;
        const canEdit =
          user?.roleSlugs.includes('super-admin') ||
          user?.permissions.includes('categories.edit');
        if (!canEdit) {
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'categories.edit required to update existing categories',
            },
          });
        }
      }
      const data = await confirmCategoryImport(payloads, request.userId);
      return reply.send({ data });
    },
  );

  app.get(
    '/:id',
    { preHandler: [authenticate, requirePermission('categories.view')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = await getCategoryById(id);
      if (!data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Category not found' } });
      return reply.send({ data });
    },
  );

  app.post(
    '/',
    { preHandler: [authenticate, requirePermission('categories.create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = createCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const data = await createCategory(
          {
            ...parsed.data,
            seo: parsed.data.seo
              ? { indexable: true, ...parsed.data.seo }
              : { indexable: true },
          },
          request.userId,
        );
        return reply.status(201).send({ data });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.patch(
    '/:id',
    { preHandler: [authenticate, requirePermission('categories.edit')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const parsed = updateCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const { seo, ...rest } = parsed.data;
        const data = await updateCategory(id, {
          ...rest,
          ...(seo ? { seo: { indexable: true, ...seo } } : {}),
        });
        return reply.send({ data });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.post(
    '/reorder',
    { preHandler: [authenticate, requirePermission('categories.reorder')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = reorderCategoriesSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      await reorderCategories(parsed.data.items);
      return reply.send({ data: { success: true } });
    },
  );

  app.post(
    '/:id/move',
    { preHandler: [authenticate, requirePermission('categories.edit')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const parsed = moveCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const data = await moveCategory(id, parsed.data.parentId, parsed.data.displayOrder);
        return reply.send({ data });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.post(
    '/:id/publish',
    { preHandler: [authenticate, requirePermission('categories.publish')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      try {
        const data = await updateCategory(id, { status: 'published', isVisible: true });
        return reply.send({ data });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.post(
    '/:id/hide',
    { preHandler: [authenticate, requirePermission('categories.hide')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      try {
        const data = await updateCategory(id, { status: 'hidden', isVisible: false });
        return reply.send({ data });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.post(
    '/:id/archive',
    { preHandler: [authenticate, requirePermission('categories.archive')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const parsed = archiveCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const data = await archiveCategory(id, parsed.data);
        return reply.send({ data });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );
}

export async function publicCategoryRoutes(app: FastifyInstance) {
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tree = (request.query as { tree?: string }).tree !== 'false';
    if (tree) {
      const data = await getCategoryTree(true);
      return reply.send({ data });
    }
    const data = await listCategories({ publicOnly: true });
    return reply.send({ data });
  });

  app.get('/featured', async (_request, reply) => {
    const data = await listCategories({ publicOnly: true });
    return reply.send({ data: data.filter((c) => c.isFeatured) });
  });

  app.get('/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    const { getCategoryBySlug, listCategories } = await import('../services/category.service');
    const category = await getCategoryBySlug(slug, true);
    if (!category) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Category not found' } });
    }
    const children = await listCategories({ publicOnly: true, parentId: category.id });
    return reply.send({ data: { ...category, children } });
  });
}
