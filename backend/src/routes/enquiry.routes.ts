import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { userHasPermission } from '../services/auth.service';
import { CustomerError } from '../services/customer.service';
import {
  EnquiryError,
  addEnquiryMessage,
  assignEnquiry,
  changeEnquiryPriority,
  changeEnquiryStatus,
  createEnquiry,
  getEnquiry,
  listAssignOptions,
  listEnquiries,
  setFollowUp,
  updateEnquiry,
} from '../services/enquiry.service';
import { listCrmConfig } from '../services/crm-config.service';
import { PhoneError } from '../utils/phone';
import { getFeatureMap } from '../services/feature.service';
import { publicEnquiryRateLimitConfig } from '../plugins/rate-limit';
import {
  adminEnquiryCreateSchema,
  assignSchema,
  enquiryListQuerySchema,
  enquiryUpdateSchema,
  followUpSchema,
  messageSchema,
  prioritySchema,
  publicEnquirySchema,
  statusSchema,
} from '../validators/crm.validator';

function handleCrmError(err: unknown, reply: FastifyReply) {
  if (err instanceof PhoneError || err instanceof CustomerError || err instanceof EnquiryError) {
    const details = err instanceof CustomerError || err instanceof EnquiryError ? err.details : undefined;
    const status =
      err.code === 'NOT_FOUND'
        ? 404
        : err.code === 'AMBIGUOUS_MATCH' ||
            err.code === 'DUPLICATE_CUSTOMER' ||
            err.code === 'IDENTITY_CONFLICT'
          ? 409
          : 400;
    return reply.status(status).send({
      error: { code: err.code, message: err.message, details },
    });
  }
  throw err;
}

function actor(request: FastifyRequest) {
  return { id: request.user?.id, name: request.user?.name };
}

export async function adminCrmConfigRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { preHandler: [authenticate, requirePermission('enquiries.view')] },
    async (_request, reply) => {
      const data = await listCrmConfig();
      return reply.send({ data });
    },
  );
}

export async function adminUserOptionRoutes(app: FastifyInstance) {
  app.get(
    '/options',
    { preHandler: [authenticate, requirePermission('enquiries.assign')] },
    async (_request, reply) => {
      const data = await listAssignOptions();
      return reply.send({ data });
    },
  );
}

export async function adminEnquiryRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { preHandler: [authenticate, requirePermission('enquiries.view')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = enquiryListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: parsed.error.flatten() },
        });
      }
      const data = await listEnquiries({
        q: parsed.data.q,
        statusId: parsed.data.statusId,
        source: parsed.data.source,
        customerId: parsed.data.customerId,
        assignedUserId: parsed.data.assignedUserId,
        needsReview: parsed.data.needsReview === 'true',
        followUpDue: parsed.data.followUpDue === 'true',
        page: parsed.data.page,
        limit: parsed.data.limit,
      });
      return reply.send({ data });
    },
  );

  app.post(
    '/',
    { preHandler: [authenticate, requirePermission('enquiries.create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = adminEnquiryCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const data = await createEnquiry(
          {
            ...parsed.data,
            source: 'manual',
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
    { preHandler: [authenticate, requirePermission('enquiries.view')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const data = await getEnquiry(id);
        return reply.send({ data });
      } catch (err) {
        return handleCrmError(err, reply);
      }
    },
  );

  app.patch(
    '/:id',
    { preHandler: [authenticate, requirePermission('enquiries.edit')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = enquiryUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const { id } = request.params as { id: string };
        const data = await updateEnquiry(id, parsed.data, actor(request));
        return reply.send({ data });
      } catch (err) {
        return handleCrmError(err, reply);
      }
    },
  );

  app.post(
    '/:id/status',
    { preHandler: [authenticate, requirePermission('enquiries.change_status')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = statusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const { id } = request.params as { id: string };
        const data = await changeEnquiryStatus(id, parsed.data.statusId, actor(request));
        return reply.send({ data });
      } catch (err) {
        return handleCrmError(err, reply);
      }
    },
  );

  app.post(
    '/:id/priority',
    { preHandler: [authenticate, requirePermission('enquiries.change_priority')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = prioritySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const { id } = request.params as { id: string };
        const data = await changeEnquiryPriority(id, parsed.data.priorityId, actor(request));
        return reply.send({ data });
      } catch (err) {
        return handleCrmError(err, reply);
      }
    },
  );

  app.post(
    '/:id/assign',
    { preHandler: [authenticate, requirePermission('enquiries.assign')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = assignSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const { id } = request.params as { id: string };
        const data = await assignEnquiry(id, parsed.data.userId, actor(request));
        return reply.send({ data });
      } catch (err) {
        return handleCrmError(err, reply);
      }
    },
  );

  app.post(
    '/:id/follow-up',
    { preHandler: [authenticate, requirePermission('enquiries.edit')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = followUpSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const { id } = request.params as { id: string };
        const data = await setFollowUp(id, parsed.data.nextFollowUpAt, actor(request));
        return reply.send({ data });
      } catch (err) {
        return handleCrmError(err, reply);
      }
    },
  );

  app.post(
    '/:id/messages',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = messageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      const permission =
        parsed.data.type === 'internal_note' ? 'enquiries.internal_note' : 'enquiries.reply';
      if (!request.user || !userHasPermission(request.user, permission)) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
        });
      }
      try {
        const { id } = request.params as { id: string };
        const data = await addEnquiryMessage(id, parsed.data, actor(request));
        return reply.status(201).send({ data });
      } catch (err) {
        return handleCrmError(err, reply);
      }
    },
  );
}

export async function publicEnquiryRoutes(app: FastifyInstance) {
  app.post(
    '/enquiries',
    { config: { rateLimit: publicEnquiryRateLimitConfig() } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const features = await getFeatureMap();
      if (!features.enquiries) {
        return reply.status(403).send({
          error: { code: 'FEATURE_DISABLED', message: 'Enquiry submissions are currently disabled.' },
        });
      }
      const parsed = publicEnquirySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
        });
      }
      try {
        const enquiry = await createEnquiry({
          source: 'website',
          publicSubmit: true,
          contactName: parsed.data.contactName,
          company: parsed.data.company,
          country: parsed.data.country,
          phone: parsed.data.phone,
          email: parsed.data.email || undefined,
          message: parsed.data.message,
          interestedBookIds: parsed.data.interestedBookIds,
          interestedCategoryIds: parsed.data.interestedCategoryIds,
          requirementText: parsed.data.requirementText,
        });
        return reply.status(201).send({
          data: { enquiryNumber: enquiry.enquiryNumber, needsReview: enquiry.needsReview },
        });
      } catch (err) {
        return handleCrmError(err, reply);
      }
    },
  );
}
