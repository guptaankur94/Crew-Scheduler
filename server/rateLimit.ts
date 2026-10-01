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
