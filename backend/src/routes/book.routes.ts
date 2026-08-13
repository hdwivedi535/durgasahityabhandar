import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { authenticate, optionalAuthenticate, requirePermission } from '../middleware/auth.middleware';
import { userHasPermission } from '../services/auth.service';
import {
  bookQuerySchema,
  createBookSchema,
  publicBookQuerySchema,
  updateBookSchema,
} from '../validators/book.validator';
import {
  BookError,
  archiveBook,
  createBook,
  deleteBook,
  getBookById,
  getBookBySlug,
  listBooks,
  listPublicBooks,
  publishBook,
  unpublishBook,
  updateBook,
} from '../services/book.service';
import {
  buildBookTemplate,
  confirmBookImport,
  exportBooks,
  previewBookImport,
} from '../services/book-import.service';
import type { BookImportPayload } from '@dsb/shared';

function handleError(err: unknown, reply: FastifyReply) {
  if (err instanceof BookError) {
    const status =
      err.code === 'NOT_FOUND'
        ? 404
        : err.code === 'SLUG_EXISTS' || err.code === 'SKU_EXISTS' || err.code === 'IMAGE_REQUIRED'
          ? err.code === 'IMAGE_REQUIRED'
            ? 400
            : 409
          : 400;
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
  if (!file) {
    throw new Error('No file uploaded');
  }
  const buffer = await file.toBuffer();
  return { buffer, filename: file.filename, mimetype: file.mimetype };
}

export async function adminBookRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { fileSize: 15 * 1024 * 1024 },
  });

  app.get(
    '/',
    { preHandler: [authenticate, requirePermission('books.view')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = bookQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: parsed.error.flatten() },
        });
      }
      const { search, status, categoryId, featured, page, limit } = parsed.data;
      const data = await listBooks({
        search,
        status,
        categoryId,
        featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
        page,
        limit,
      });
      return reply.send({ data });
    },
  );

  app.get(
    '/import/template',
    { preHandler: [authenticate, requirePermission('books.create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const format = (request.query as { format?: string }).format === 'xlsx' ? 'xlsx' : 'csv';
      const file = buildBookTemplate(format);
      return reply
        .header('Content-Type', file.contentType)
        .header('Content-Disposition', `attachment; filename="${file.filename}"`)
        .send(file.buffer);
    },
  );

  app.get(
    '/export',
    { preHandler: [authenticate, requirePermission('books.view')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const q = request.query as {
        format?: string;
        search?: string;
        status?: string;
        categoryId?: string;
      };
      const format = q.format === 'xlsx' ? 'xlsx' : 'csv';
      const file = await exportBooks({
        format,
        search: q.search,
        status: q.status as
          | 'draft'
          | 'preview'
          | 'published'
          | 'archived'
          | undefined,
        categoryId: q.categoryId,
      });
      return reply
        .header('Content-Type', file.contentType)
        .header('Content-Disposition', `attachment; filename="${file.filename}"`)
        .send(file.buffer);
    },
  );

  app.post(
    '/import/preview',
    { preHandler: [authenticate, requirePermission('books.create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const upload = await readUpload(request);
        const validateRemote =
          (request.query as { validateImages?: string }).validateImages !== 'false';
        const data = await previewBookImport(
          upload.buffer,
          upload.filename,
          upload.mimetype,
          { validateImagesRemote: validateRemote },
        );
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
    { preHandler: [authenticate, requirePermission('books.create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = confirmSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid import payload' },
        });
      }
      const payloads = parsed.data.rows as BookImportPayload[];
      // Require edit permission when any update is present
      const hasUpdates = payloads.some((p) => Boolean(p.existingBookId));
      if (hasUpdates) {
        // soft check via user permissions loaded on request
        const user = request.user;
        const canEdit =
          user?.roleSlugs.includes('super-admin') ||
          user?.permissions.includes('books.edit');
        if (!canEdit) {
          return reply.status(403).send({
            error: { code: 'FORBIDDEN', message: 'books.edit required to update existing books' },
          });
        }
      }
      const data = await confirmBookImport(payloads, request.userId);
      return reply.send({ data });
    },
  );

  app.get(
    '/:id',
    { preHandler: [authenticate, requirePermission('books.view')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = await getBookById(id);
      if (!data) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Book not found' } });
      return reply.send({ data });
    },
  );

  app.post(
    '/',
    { preHandler: [authenticate, requirePermission('books.create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = createBookSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const data = await createBook(parsed.data, request.userId);
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
      const parsed = updateBookSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const data = await updateBook(id, parsed.data);
        return reply.send({ data });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.post(
    '/:id/publish',
    { preHandler: [authenticate, requirePermission('books.publish')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      try {
        const data = await publishBook(id);
        return reply.send({ data });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.post(
    '/:id/unpublish',
    { preHandler: [authenticate, requirePermission('books.publish')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      try {
        const data = await unpublishBook(id);
        return reply.send({ data });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.post(
    '/:id/archive',
    { preHandler: [authenticate, requirePermission('books.archive')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      try {
        const data = await archiveBook(id);
        return reply.send({ data });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.delete(
    '/:id',
    { preHandler: [authenticate, requirePermission('books.delete')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      try {
        await deleteBook(id);
        return reply.send({ data: { success: true } });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );
}

export async function publicBookRoutes(app: FastifyInstance) {
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = publicBookQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: parsed.error.flatten() },
      });
    }
    const { search, categoryId, featured, page, limit, lang } = parsed.data;
    const data = await listPublicBooks({
      search,
      categoryId,
      featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      page,
      limit,
      lang,
    });
    return reply.send({ data });
  });

  app.get('/featured', async (request: FastifyRequest, reply: FastifyReply) => {
    const lang = (request.query as { lang?: string }).lang;
    const data = await listPublicBooks({ featured: true, limit: 12, lang });
    return reply.send({ data: data.items });
  });

  app.get(
    '/:slug',
    { preHandler: [optionalAuthenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { slug } = request.params as { slug: string };
      const lang = (request.query as { lang?: string }).lang ?? 'en';
      const preview = (request.query as { preview?: string }).preview === 'true';
      const allowUnpublished =
        preview && Boolean(request.user && userHasPermission(request.user, 'books.view'));
      const data = await getBookBySlug(slug, lang, true, allowUnpublished);
      if (!data) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Book not found' } });
      }
      return reply.send({ data });
    },
  );
}
