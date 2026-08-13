import type { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';

export async function requestContext(request: FastifyRequest, _reply: FastifyReply) {
  request.requestId = crypto.randomUUID();
}

export function notFoundHandler(_request: FastifyRequest, reply: FastifyReply) {
  reply.status(404).send({
    error: { code: 'NOT_FOUND', message: 'Resource not found' },
  });
}

export function errorHandler(
  error: Error & { statusCode?: number },
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const statusCode = error.statusCode ?? 500;
  reply.status(statusCode).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: statusCode >= 500 ? 'Internal server error' : error.message,
      requestId: request.requestId,
    },
  });
}
