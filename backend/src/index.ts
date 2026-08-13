import { buildApp } from './app';
import { env } from './config/env';

async function start() {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`API running on http://localhost:${env.PORT}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
