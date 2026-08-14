import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import mongoose from 'mongoose';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { authRoutes } from './routes/auth.routes';
import { adminRoutes, healthRoutes, publicRoutes } from './routes/index.routes';
import { adminCategoryRoutes, publicCategoryRoutes } from './routes/category.routes';
import { adminBookRoutes, publicBookRoutes } from './routes/book.routes';
import { adminLookupRoutes } from './routes/lookup.routes';
import { adminCmsRoutes, publicCmsRoutes } from './routes/cms.routes';
import { adminFeatureRoutes } from './routes/feature.routes';
import { errorHandler, notFoundHandler, requestContext } from './middleware/error.middleware';
import { adminCustomerRoutes } from './routes/customer.routes';
import {
  adminCrmConfigRoutes,
  adminEnquiryRoutes,
  adminUserOptionRoutes,
  publicEnquiryRoutes,
} from './routes/enquiry.routes';
import { registerRateLimit } from './plugins/rate-limit';

let dbConnected = false;

async function ensureDatabase(): Promise<void> {
  if (dbConnected || mongoose.connection.readyState === 1) {
    dbConnected = true;
    return;
  }
  await connectDatabase();
  dbConnected = true;
}

function stripServicePrefix(url: string): string {
  if (url.startsWith('/api/backend')) {
    const stripped = url.slice('/api/backend'.length);
    return stripped.length > 0 ? stripped : '/';
  }
  return url;
}

export async function buildApp(): Promise<FastifyInstance> {
  await ensureDatabase();

  const app = Fastify({
    logger: env.NODE_ENV === 'development',
    // Vercel and other proxies set X-Forwarded-For. Required so rate-limit uses client IP.
    trustProxy: true,
  });

  app.addHook('onRequest', (request, _reply, done) => {
    const original = request.raw.url ?? request.url;
    const stripped = stripServicePrefix(original.split('?')[0] ?? original);
    if (stripped !== original.split('?')[0]) {
      const query = original.includes('?') ? original.slice(original.indexOf('?')) : '';
      request.raw.url = `${stripped}${query}`;
    }
    done();
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      // Same-origin requests (Vercel rewrites) may omit Origin header
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed = [env.FRONTEND_URL, env.FRONTEND_URL.replace(/\/$/, '')];
      if (allowed.includes(origin) || env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(null, env.FRONTEND_URL);
      }
    },
    credentials: true,
  });
  await app.register(cookie);
  await registerRateLimit(app);

  app.addHook('onRequest', requestContext);
  app.setNotFoundHandler(notFoundHandler);
  app.setErrorHandler(errorHandler);

  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminCategoryRoutes, { prefix: '/api/v1/admin/categories' });
  await app.register(adminBookRoutes, { prefix: '/api/v1/admin/books' });
  await app.register(adminLookupRoutes, { prefix: '/api/v1/admin/lookups' });
  await app.register(adminCmsRoutes, { prefix: '/api/v1/admin/website' });
  await app.register(adminFeatureRoutes, { prefix: '/api/v1/admin/features' });
  await app.register(adminCrmConfigRoutes, { prefix: '/api/v1/admin/crm-config' });
  await app.register(adminCustomerRoutes, { prefix: '/api/v1/admin/customers' });
  await app.register(adminEnquiryRoutes, { prefix: '/api/v1/admin/enquiries' });
  await app.register(adminUserOptionRoutes, { prefix: '/api/v1/admin/users' });
  await app.register(publicRoutes, { prefix: '/api/v1/public' });
  await app.register(publicCategoryRoutes, { prefix: '/api/v1/public/categories' });
  await app.register(publicBookRoutes, { prefix: '/api/v1/public/books' });
  await app.register(publicCmsRoutes, { prefix: '/api/v1/public' });
  await app.register(publicEnquiryRoutes, { prefix: '/api/v1/public' });

  return app;
}
