import type { FastifyInstance, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';

/** Default public enquiry limit (per client IP). */
export const PUBLIC_ENQUIRY_RATE_MAX = 10;
export const PUBLIC_ENQUIRY_RATE_WINDOW_MS = 60_000;

/**
 * Uses Fastify `request.ip`, which honors `trustProxy`.
 * On Vercel the platform sets X-Forwarded-For; do not use socket.remoteAddress.
 */
export function publicEnquiryRateLimitConfig(overrides?: { max?: number; timeWindow?: number }) {
  return {
    max: overrides?.max ?? PUBLIC_ENQUIRY_RATE_MAX,
    timeWindow: overrides?.timeWindow ?? PUBLIC_ENQUIRY_RATE_WINDOW_MS,
    keyGenerator: (request: FastifyRequest) => request.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many enquiry submissions. Try again shortly.',
      },
    }),
  };
}

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    global: false,
    keyGenerator: (request) => request.ip,
  });
}
