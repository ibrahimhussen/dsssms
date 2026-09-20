import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET:  z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN:  z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  BCRYPT_SALT_ROUNDS:       z.coerce.number().int().min(10).max(15).default(12),
  LOGIN_MAX_ATTEMPTS:       z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_MINUTES:    z.coerce.number().int().positive().default(15),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX_REQUESTS:   z.coerce.number().int().positive().default(300),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Security hardening (optional; defaults safe for development)
  FORCE_HTTPS:   z.string().transform((v) => v === 'true').default(() => false),
  HSTS_MAX_AGE:  z.coerce.number().int().positive().default(31536000), // 1 year
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('❌ Invalid environment configuration:');
    // eslint-disable-next-line no-console
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  // Production-only validations
  if (parsed.data.NODE_ENV === 'production') {
    const errors: string[] = [];
    if (parsed.data.JWT_ACCESS_SECRET.length < 48) {
      errors.push('JWT_ACCESS_SECRET must be at least 48 characters in production');
    }
    if (parsed.data.JWT_REFRESH_SECRET.length < 48) {
      errors.push('JWT_REFRESH_SECRET must be at least 48 characters in production');
    }
    if (parsed.data.CORS_ORIGIN.includes('localhost')) {
      errors.push('CORS_ORIGIN must not contain localhost in production');
    }
    if (errors.length > 0) {
      // eslint-disable-next-line no-console
      console.error('❌ Production environment validation failed:');
      errors.forEach((e) => console.error(`  • ${e}`));
      process.exit(1);
    }
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProduction  = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest        = env.NODE_ENV === 'test';
