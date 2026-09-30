import { rateLimit, type Store } from 'express-rate-limit';
import { Redis } from 'ioredis';
import { RedisStore, type RedisReply } from 'rate-limit-redis';

/**
 * Rate limiting. Uses Redis when REDIS_URL is configured (required as soon as
 * the API runs on more than one instance), in-memory otherwise.
 */
export interface RateLimitOptions {
  windowMs: number;
  max: number;
  writeMax: number;
  redisUrl?: string;
}

function store(prefix: string, redis: Redis | undefined): Store | undefined {
  if (!redis) return undefined;
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<RedisReply>,
  });
}

const limitedResponse = {
  error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down' },
};

export function createRateLimiters(options: RateLimitOptions) {
  const redis = options.redisUrl ? new Redis(options.redisUrl, { lazyConnect: false, maxRetriesPerRequest: 2 }) : undefined;
  const common = {
    windowMs: options.windowMs,
    standardHeaders: 'draft-8' as const,
    legacyHeaders: false,
    message: limitedResponse,
  };
  return {
    /** Applied to every /api request. */
    global: rateLimit({ ...common, limit: options.max, store: store('global', redis) }),
    /** Stricter limit for state-changing requests (POST/PATCH/DELETE). */
    writes: rateLimit({
      ...common,
      limit: options.writeMax,
      skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
      store: store('writes', redis),
    }),
    close: async () => {
      if (redis) await redis.quit();
    },
  };
}
