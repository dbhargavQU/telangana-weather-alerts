import IORedis from 'ioredis';

const url = process.env.REDIS_URL || 'redis://localhost:6379/0';
// BullMQ requires maxRetriesPerRequest to be null for blocking connections
export const redis = new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds?: number) {
  const payload = JSON.stringify(value);
  if (ttlSeconds) {
    await redis.set(key, payload, 'EX', ttlSeconds);
  } else {
    await redis.set(key, payload);
  }
}


