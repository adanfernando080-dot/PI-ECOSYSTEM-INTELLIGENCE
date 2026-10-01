import { z } from 'zod/v4';

/**
 * Server configuration, validated at startup. Secrets (JWT_SECRET, PI_API_KEY)
 * are read here only and never serialized into responses or logs.
 */
const DEV_DEFAULT_CORS_ORIGIN = 'http://localhost:5173';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

function splitOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Why an origin is unacceptable in production, or null when it is fine. */
function productionOriginProblem(origin: string): string | null {
  if (origin === '*') return 'wildcard "*" is not allowed in production';
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return `"${origin}" is not a valid origin`;
  }
  if (url.protocol !== 'https:') return `"${origin}" must use https in production`;
  if (LOCAL_HOSTS.has(url.hostname)) return `"${origin}" points to a local host`;
  if (url.origin !== origin) return `"${origin}" must be a bare origin (scheme + host[:port], no path, no trailing slash)`;
  return null;
}

const EnvSchema = z
  .object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional().transform((v) => (v ? v : undefined)),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ISSUER: z.string().default('pi-ecosystem-intelligence'),
  // Raw comma-separated list; validated and split below (see superRefine / transform).
  CORS_ORIGINS: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WRITE_MAX: z.coerce.number().int().positive().default(20),
  PI_API_KEY: z.string().optional(),
  PI_API_BASE_URL: z.string().optional(),
})
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    // The .env.example placeholder is long enough to pass the length check: never accept it in production.
    if (/change[-_ ]?me/i.test(env.JWT_SECRET)) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'JWT_SECRET still contains the example placeholder; generate a real secret' });
    }
    const origins = splitOrigins(env.CORS_ORIGINS ?? '');
    if (origins.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'CORS_ORIGINS is required in production (comma-separated https frontend origins)' });
      return;
    }
    for (const origin of origins) {
      const problem = productionOriginProblem(origin);
      if (problem) ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: problem });
    }
  })
  .transform((env) => ({
    ...env,
    // Development/test keep the convenient local Vite default; production never gets one.
    CORS_ORIGINS: splitOrigins(env.CORS_ORIGINS ?? DEV_DEFAULT_CORS_ORIGIN),
  }));

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}
