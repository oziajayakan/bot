import { Redis } from '@upstash/redis';

// Lazy initialization — env vars dibutuhkan saat runtime, bukan saat build
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Missing Upstash Redis environment variables.\n' +
        'Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN\n' +
        'in your .env.local (development) or Vercel Dashboard (production).'
    );
  }

  _redis = new Redis({ url, token });
  return _redis;
}

export const KEYS = {
  links: 'safelink:links',
  logs: 'safelink:logs',
};
