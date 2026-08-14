import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import {
  CustomerError,
  archiveCustomer,
  createCustomer,
  getCustomer,
  listCustomers,
  matchCustomers,
  mergeCustomers,
  updateCustomer,
} from '../services/customer.service';
import { PhoneError } from '../utils/phone';
import {
  adminCustomerCreateSchema,
  adminCustomerUpdateSchema,
  customerListQuerySchema,
  matchQuerySchema,
  mergeSchema,
} from '../validators/crm.validator';

function handleCrmError(err: unknown, reply: FastifyReply) {
  if (err instanceof PhoneError || err instanceof CustomerError) {
    const status =
      err.code === 'NOT_FOUND'
        ? 404
        : err.code === 'AMBIGUOUS_MATCH' ||
            err.code === 'DUPLICATE_CUSTOMER' ||
            err.code === 'IDENTITY_CONFLICT'
          ? 409
          : 400;
    return reply.status(status).send({
      error: {
        code: err.code,
        message: err.message,
        details: err instanceof CustomerError ? err.details : undefined,
      },
    });
  }
  throw err;
}

function actor(request: FastifyRequest) {
  return { id: request.user?.id, name: request.user?.name };
}

export async function adminCustomerRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { preHandler: [authenticate, requirePermission('customers.view')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = customerListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: parsed.error.flatten() },
        });
      }
      const data = await listCustomers({
        q: parsed.data.q,
        needsReview: parsed.data.needsReview === 'true',
        page: parsed.data.page,
        limit: parsed.data.limit,
      });
      return reply.send({ data });
    },
  );

  app.get(
    '/match',
    { preHandler: [authenticate, requirePermission('customers.view')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = matchQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: parsed.error.flatten() },
        });
      }
      try {
        const data = await matchCustomers({
          phone: parsed.data.phone,
          country: parsed.data.country,
          email: parsed.data.email || undefined,
        });
        return reply.send({ data: { decision: data.decision.kind, matches: data.matches } });
      } catch (err) {
        return handleCrmError(err, reply);
      }
    },
  );

  app.post(
    '/',
    { preHandler: [authenticate, requirePermission('customers.create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = adminCustomerCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const data = await createCustomer(
          {
            ...parsed.data,
            email: parsed.data.email || undefined,
          },
          actor(request),
        );
        return reply.status(201).send({ data });
      } catch (err) {
        return handleCrmError(err, reply);
      }
    },
  );

  app.get(
    '/:id',
    { preHandler: [authenticate, requirePermission('customers.view')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const data = await getCustomer(id);
        return reply.send({ data });
      } catch (err) {
        return handleCrmError(err, reply);
      }
    },
  );

  app.patch(
    '/:id',
    { preHandler: [authenticate, requirePermission('customers.edit')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = adminCustomerUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const { id } = request.params as { id: string };
        const data = await updateCustomer(
          id,
          { ...parsed.data, email: parsed.data.email || undefined },
          actor(request),
        );
        return reply.send({ data });
      } catch (err) {
        return handleCrmError(err, reply);
      }
    },
  );

  app.post(
    '/:id/archive',
    { preHandler: [authenticate, requirePermission('customers.archive')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const data = await archiveCustomer(id, actor(request));
        return reply.send({ data });
      } catch (err) {
        return handleCrmError(err, reply);
      }
    },
  );

  app.post(
    '/:id/merge',
    { preHandler: [authenticate, requirePermission('customers.merge')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = mergeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const { id } = request.params as { id: string };
        const data = await mergeCustomers(id, parsed.data.sourceCustomerId, actor(request));
        return reply.send({ data });
      } catch (err) {
        return handleCrmError(err, reply);
      }
    },
  );
}
