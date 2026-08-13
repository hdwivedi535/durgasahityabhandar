import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { authRoutes } from './routes/auth.routes';
import { adminRoutes, healthRoutes, publicRoutes } from './routes/index.routes';
import { errorHandler, notFoundHandler, requestContext } from './middleware/error.middleware';

async function buildApp() {
  const app = Fastify({ logger: env.NODE_ENV === 'development' });

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
  await app.register(publicRoutes, { prefix: '/api/v1/public' });

  return app;
}

async function start() {
  await connectDatabase();
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`API running on http://localhost:${env.PORT}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
