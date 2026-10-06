import type { NextFunction, Request, Response } from 'express';

/*
 * HARDENING FOR AN ONLINE SERVER
 *   securityHeaders  standard browser protections (production only, so the development server's live reload works)
 *   apiCors          only the web app itself and the CrewCircadian phone app may call /api from a browser context
 */

/** Origins the phone app uses (Capacitor on iOS and Android). */
export const APP_ORIGINS = ['capacitor://localhost', 'https://localhost', 'http://localhost'];

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}

/** Allowed origins: the phone app's, plus any listed in ALLOWED_ORIGINS (comma-separated, e.g. the hosted web address). */
export function allowedOrigins(env: string | undefined): Set<string> {
  return new Set([...APP_ORIGINS, ...(env ?? '').split(',').map((o) => o.trim()).filter(Boolean)]);
}

export function apiCors(allowed: Set<string>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (origin) {
      // Same-origin requests from the web app need no CORS headers; anything else must be on the list
      const sameOrigin = req.headers.host && (origin === `https://${req.headers.host}` || origin === `http://${req.headers.host}`);
      if (!sameOrigin && !allowed.has(origin)) {
        res.status(403).json({ success: false, error: 'This app is not allowed to use the roster reader.' });
        return;
      }
      if (!sameOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Max-Age', '600');
      }
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}
