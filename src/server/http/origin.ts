import { ApiFailure } from './errors';

/**
 * Requests that change state must come from this site's own pages. Browsers always send
 * `Sec-Fetch-Site`, and `Origin` on every POST; at least one of them has to say "same site".
 * (A non-browser client can forge both; this is a defence against cross-site requests that
 * ride on the player's cookies, not against someone calling the API directly.)
 */
export function isSameOrigin(headers: Headers): boolean {
  const fetchSite = headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin';

  const origin = headers.get('origin');
  if (!origin) return false;
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  try {
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function assertSameOrigin(request: Request): void {
  if (!isSameOrigin(request.headers)) throw new ApiFailure('forbidden', 'Origem da requisição não permitida.');
}
