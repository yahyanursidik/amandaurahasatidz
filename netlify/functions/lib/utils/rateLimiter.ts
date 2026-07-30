interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

export function checkRateLimit(
  key: string,
  maxLimit = 3,
  windowMs = 600000 // 10 minutes in ms
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || record.resetTime < now) {
    memoryStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxLimit - 1,
      retryAfterSeconds: 0,
    };
  }

  if (record.count >= maxLimit) {
    const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  record.count += 1;
  memoryStore.set(key, record);

  return {
    allowed: true,
    remaining: maxLimit - record.count,
    retryAfterSeconds: 0,
  };
}

export function resetRateLimit(key: string): void {
  memoryStore.delete(key);
}
