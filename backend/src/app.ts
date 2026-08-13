import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import mongoose from 'mongoose';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { authRoutes } from './routes/auth.routes';
import { adminRoutes, healthRoutes, publicRoutes } from './routes/index.routes';
import { adminCategoryRoutes, publicCategoryRoutes } from './routes/category.routes';
import { errorHandler, notFoundHandler, requestContext } from './middleware/error.middleware';

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

  const app = Fastify({ logger: env.NODE_ENV === 'development' });

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
    origin: env.FRONTEND_URL,
    credentials: true,
  });
  await app.register(cookie);

  app.addHook('onRequest', requestContext);
  app.setNotFoundHandler(notFoundHandler);
  app.setErrorHandler(errorHandler);

  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminCategoryRoutes, { prefix: '/api/v1/admin/categories' });
  await app.register(publicRoutes, { prefix: '/api/v1/public' });
  await app.register(publicCategoryRoutes, { prefix: '/api/v1/public/categories' });

  return app;
}
