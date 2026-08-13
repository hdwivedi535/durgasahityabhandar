import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
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
  updateBook,
} from '../services/book.service';

function handleError(err: unknown, reply: FastifyReply) {
  if (err instanceof BookError) {
    const status =
      err.code === 'NOT_FOUND' ? 404 : err.code === 'SLUG_EXISTS' || err.code === 'SKU_EXISTS' ? 409 : 400;
    return reply.status(status).send({ error: { code: err.code, message: err.message } });
  }
  throw err;
}

export async function adminBookRoutes(app: FastifyInstance) {
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

  app.get('/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    const lang = (request.query as { lang?: string }).lang ?? 'en';
    const data = await getBookBySlug(slug, lang, true);
    if (!data) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Book not found' } });
    }
    return reply.send({ data });
  });
}
