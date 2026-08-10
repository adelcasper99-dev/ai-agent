/**
 * lib/rate-limit.ts
 * In-memory sliding window rate limiter.
 * Safe for single-process PM2 deployment (HQ VPS fork mode).
 * Key = IP address. Stores timestamps of recent requests per key.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Auto-prune stale keys every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.timestamps.length === 0 || now - entry.timestamps[entry.timestamps.length - 1] > 60_000 * 10) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  /** Max requests allowed within windowMs */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number; // unix ms timestamp
}

export function rateLimit(ip: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  let entry = store.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(ip, entry);
  }

  // Slide window: drop timestamps older than windowStart
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  const remaining = options.limit - entry.timestamps.length;
  const resetAt = entry.timestamps.length > 0
    ? entry.timestamps[0] + options.windowMs
    : now + options.windowMs;

  if (entry.timestamps.length >= options.limit) {
    return { success: false, remaining: 0, resetAt };
  }

  entry.timestamps.push(now);
  return { success: true, remaining: remaining - 1, resetAt };
}

/**
 * Extract real client IP from Next.js request headers.
 * Respects X-Forwarded-For set by reverse proxy (nginx on VPS).
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? '127.0.0.1';
}
