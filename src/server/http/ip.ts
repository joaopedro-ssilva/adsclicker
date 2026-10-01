import { createHash } from 'node:crypto';

/**
 * The caller's address. Vercel sets `x-vercel-forwarded-for` itself (it cannot be spoofed from
 * outside); elsewhere the first `x-forwarded-for` entry is the best available, and `unknown`
 * puts every unidentifiable caller in one bucket.
 */
export function clientIp(headers: Headers): string {
  const vercel = headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  if (vercel) return vercel;
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Addresses are only ever stored as a salted hash, used as a rate-limit key. */
export function hashIp(ip: string, salt: string | undefined = process.env.IP_HASH_SALT): string {
  return createHash('sha256')
    .update(`${salt ?? 'adsclicker-dev-salt'}:${ip}`)
    .digest('hex')
    .slice(0, 32);
}
