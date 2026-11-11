import type { Request, RequestHandler, Response } from 'express';
import { runtime } from './runtime';

/**
 * Small per-instance rate limits. (The SDK's own limiter needs `trust proxy` behind Hosting, and keys on the
 * proxy's address without it, which would share one allowance between everybody.) Tokens are 256 random bits, so
 * these only guard cost, not guessing; they're per instance and best-effort.
 */

interface Window {
  count: number;
  resets: number;
}

/** Counts hits per key in fixed windows; `hit` says how many seconds to wait, or 0 if there's room */
function counter(max: number, windowMs: number) {
  const seen = new Map<string, Window>();
  const live = (key: string, now: number) => {
    const entry = seen.get(key);
    return entry && entry.resets > now ? entry : undefined;
  };
  return {
    hit(key: string): number {
      const now = runtime.now();
      if (seen.size > 5000) for (const [k, entry] of seen) if (entry.resets <= now) seen.delete(k);
      // Invented keys can't grow it without end: the oldest go first
      while (seen.size >= 20000) seen.delete(seen.keys().next().value as string);
      const entry = live(key, now);
      if (!entry) seen.set(key, { count: 1, resets: now + windowMs });
      else if (++entry.count > max) return Math.ceil((entry.resets - now) / 1000);
      return 0;
    },
    /** Whether the key has used up its allowance, without counting */
    full(key: string): number {
      const now = runtime.now();
      const entry = live(key, now);
      return entry && entry.count >= max ? Math.ceil((entry.resets - now) / 1000) : 0;
    },
  };
}

export const tooMany = (res: Response, wait: number) => {
  res.set('Retry-After', String(wait));
  res.status(429).json({ error: 'too_many_requests', error_description: 'Too many requests. Try again later.' });
};

/**
 * At most `max` requests per caller per window, and at most `global` for everybody together. The global cap is
 * what holds when `who` can be spoofed (see there): however many addresses a caller invents, only `global` get in.
 */
export function limit(max: number, windowMs = 15 * 60_000, global?: number): RequestHandler {
  const each = counter(max, windowMs);
  const all = global === undefined ? undefined : counter(global, windowMs);
  return (req, res, next) => {
    const wait = Math.max(each.hit(who(req)), all?.hit('all') ?? 0);
    if (wait) return tooMany(res, wait);
    next();
  };
}

/**
 * Bearer tokens that don't check out: after `max` of them from one caller in a window, further requests with a
 * bearer token are refused before anything is looked up, so made-up tokens can't cost unlimited database reads.
 * Callers behind one shared address share the allowance, hence the generous default.
 */
export function bearerMisses(max = 30, windowMs = 60_000) {
  const misses = counter(max, windowMs);
  return {
    /** Seconds to wait if this caller has used up its misses, else 0 */
    blocked: (req: Request) => misses.full(who(req)),
    miss: (req: Request) => void misses.hit(who(req)),
  };
}

/**
 * The caller, as a key. Behind Firebase Hosting and Cloud Run every proxy hop appends to X-Forwarded-For, and
 * the part before the last hops is whatever the client chose to send. How many hops Hosting adds before the
 * function sees it isn't documented firmly enough to count from the end, so rather than trust any one entry the
 * key is the whole header: someone who sends their own prefix only gets a key of their own, which a spoofer can
 * make up freely, and that is why `limit` also has a global cap. Without the header, the socket's address.
 */
export function who(req: Request): string {
  // The end of a long header is the part the proxies wrote
  return req.get('X-Forwarded-For')?.trim().slice(-200) || req.socket.remoteAddress || 'unknown';
}
