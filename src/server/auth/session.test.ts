import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE, clearedSessionCookie, hashToken, newToken, readSessionToken, sessionCookie } from './session';

describe('session tokens and cookies', () => {
  it('makes 256-bit url-safe tokens that differ every time', () => {
    const [a, b] = [newToken(), newToken()];
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('stores only a sha-256 of the token', () => {
    const token = newToken();
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('builds the cookie of the contract', () => {
    const cookie = sessionCookie('abc');
    expect(cookie).toContain(`${SESSION_COOKIE}=abc`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain(`Max-Age=${365 * 24 * 60 * 60}`);
  });

  it('is Secure in production only', () => {
    const original = process.env.NODE_ENV;
    try {
      Object.assign(process.env, { NODE_ENV: 'production' });
      expect(sessionCookie('abc')).toContain('; Secure');
      expect(clearedSessionCookie()).toContain('; Secure');
      Object.assign(process.env, { NODE_ENV: 'development' });
      expect(sessionCookie('abc')).not.toContain('Secure');
    } finally {
      Object.assign(process.env, { NODE_ENV: original });
    }
  });

  it('clears the cookie with Max-Age=0', () => {
    expect(clearedSessionCookie()).toContain('Max-Age=0');
  });

  it('reads the token out of a Cookie header', () => {
    const read = (cookie: string) => readSessionToken(new Headers({ cookie }));
    expect(read(`${SESSION_COOKIE}=tok123`)).toBe('tok123');
    expect(read(`a=1; ${SESSION_COOKIE}=tok123; b=2`)).toBe('tok123');
    expect(read('a=1; b=2')).toBeNull();
    expect(read(`x${SESSION_COOKIE}=nope`)).toBeNull();
    expect(read(`${SESSION_COOKIE}=`)).toBeNull();
    expect(read(`${SESSION_COOKIE}=${'a'.repeat(300)}`)).toBeNull();
    expect(readSessionToken(new Headers())).toBeNull();
  });
});
