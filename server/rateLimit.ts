import type { Request, Response, NextFunction } from 'express';

/**
 * Small in-memory fixed-window rate limiter, keyed by client IP.
 * Protects the Gemini quota from a runaway client; state resets when the server restarts.
 */
export function createRateLimiter(maxRequests: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { count: number; windowStart: number }>();

  const isAllowed = (key: string): boolean => {
    const t = now();
    const entry = hits.get(key);
    if (!entry || t - entry.windowStart >= windowMs) {
      hits.set(key, { count: 1, windowStart: t });
      return true;
    }
    entry.count++;
    return entry.count <= maxRequests;
  };

  const middleware = (req: Request, res: Response, next: NextFunction) => {
    // Drop expired entries so the map cannot grow without bound
    if (hits.size > 5000) {
      const t = now();
      for (const [key, entry] of hits) {
        if (t - entry.windowStart >= windowMs) hits.delete(key);
      }
    }

    if (isAllowed(req.ip || 'unknown')) return next();

    res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait a minute and try again.',
    });
  };

  return { middleware, isAllowed };
}

/**
 * A cap on total requests per calendar day (UTC), across all clients.
 * It protects the API key's budget even if the per-client limit is bypassed.
 */
export function createDailyLimit(maxPerDay: number, now: () => number = Date.now) {
  let day = '';
  let count = 0;

  const isAllowed = (): boolean => {
    const today = new Date(now()).toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      count = 0;
    }
    count++;
    return count <= maxPerDay;
  };

  const middleware = (_req: Request, res: Response, next: NextFunction) => {
    if (isAllowed()) return next();
    return res.status(429).json({
      success: false,
      error: 'The daily limit for AI reading has been reached. Please try again tomorrow.',
    });
  };

  return { middleware, isAllowed };
}
