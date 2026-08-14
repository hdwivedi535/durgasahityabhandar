import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Each MongoMemoryServer file needs a mongod; cap parallelism to avoid port clashes.
    maxWorkers: 4,
  },
});
