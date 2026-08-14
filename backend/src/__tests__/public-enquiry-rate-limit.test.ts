import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { publicEnquiryRateLimitConfig, registerRateLimit } from '../plugins/rate-limit';

describe('public enquiry rate limit (proxy-safe IP)', () => {
  it('returns 429 RATE_LIMITED per X-Forwarded-For when trustProxy is enabled', async () => {
    const app = Fastify({ trustProxy: true });
    await registerRateLimit(app);
    app.post(
      '/api/v1/public/enquiries',
      { config: { rateLimit: publicEnquiryRateLimitConfig({ max: 2, timeWindow: 60_000 }) } },
      async () => ({ data: { ok: true } }),
    );
    await app.ready();

    const ipA = { 'x-forwarded-for': '203.0.113.10' };
    const first = await app.inject({ method: 'POST', url: '/api/v1/public/enquiries', headers: ipA });
    const second = await app.inject({ method: 'POST', url: '/api/v1/public/enquiries', headers: ipA });
    const third = await app.inject({ method: 'POST', url: '/api/v1/public/enquiries', headers: ipA });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(third.statusCode).toBe(429);
    const body = third.json();
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.message).toMatch(/too many/i);

    const other = await app.inject({
      method: 'POST',
      url: '/api/v1/public/enquiries',
      headers: { 'x-forwarded-for': '203.0.113.11' },
    });
    expect(other.statusCode).toBe(200);

    await app.close();
  });
});
