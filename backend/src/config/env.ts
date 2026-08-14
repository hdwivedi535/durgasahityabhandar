import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/dsb'),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  API_PATH_PREFIX: z.string().default(''),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => {
      if (v !== undefined) return v === 'true';
      return process.env.NODE_ENV === 'production';
    }),
  // Real provider calls stay off until explicitly configured and approved.
  AI_PROVIDER: z.enum(['none', 'openai_compatible']).default('none'),
  AI_API_KEY: z.string().optional().default(''),
  AI_BASE_URL: z.string().optional().default(''),
  AI_MODEL: z.string().optional().default(''),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  AI_DAILY_TOKEN_BUDGET: z.coerce.number().int().nonnegative().default(0),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(800),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
