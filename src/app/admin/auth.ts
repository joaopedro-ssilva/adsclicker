import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * A basic gate for /admin: one static login taken from the environment (ADMIN_USER, ADMIN_PASSWORD).
 * Nothing is hard-coded so the credentials never reach the repository or the browser bundle.
 * Server-only: import this from server components and server actions, never from client code.
 */

const SESSION_COOKIE = 'adsclicker_admin';
const SESSION_SECONDS = 60 * 60 * 8;

interface Credentials {
  user: string;
  password: string;
}

function credentials(): Credentials | null {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;
  return user && password ? { user, password } : null;
}

/** False when the environment variables are missing: the admin page then refuses every login. */
export function adminConfigured(): boolean {
  return credentials() !== null;
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Derived from the password, so changing the password signs everyone out. */
function sessionToken({ user, password }: Credentials): string {
  return createHmac('sha256', password).update(`adsclicker-admin:${user}`).digest('hex');
}

export function checkLogin(user: string, password: string): boolean {
  const expected = credentials();
  if (!expected) return false;
  // Both comparisons always run, so the timing does not tell which field was wrong.
  const userOk = sameText(user, expected.user);
  const passwordOk = sameText(password, expected.password);
  return userOk && passwordOk;
}

export async function isAdmin(): Promise<boolean> {
  const expected = credentials();
  if (!expected) return false;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token !== undefined && sameText(token, sessionToken(expected));
}

export async function startSession(): Promise<void> {
  const expected = credentials();
  if (!expected) return;
  (await cookies()).set(SESSION_COOKIE, sessionToken(expected), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
    maxAge: SESSION_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, '', { path: '/admin', maxAge: 0 });
}
