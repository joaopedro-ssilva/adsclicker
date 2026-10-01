import type { ApiError } from '@/shared/api';
import type { ApiFailure } from './errors';

export interface ResponseOptions {
  status?: number;
  /** Full Set-Cookie header values. */
  cookies?: string[];
  headers?: Record<string, string>;
}

/** Private by default: nothing user-specific may ever sit in a shared cache. */
const NO_STORE = 'no-store';

export function jsonResponse(data: unknown, options: ResponseOptions = {}): Response {
  const headers = new Headers({ 'cache-control': NO_STORE, ...options.headers });
  for (const cookie of options.cookies ?? []) headers.append('set-cookie', cookie);
  return Response.json(data, { status: options.status ?? 200, headers });
}

export function errorResponse(failure: ApiFailure, cookies: string[] = []): Response {
  const body: ApiError = { error: { code: failure.code, message: failure.message } };
  const headers: Record<string, string> = {};
  if (failure.retryAfterSeconds !== undefined) headers['retry-after'] = String(failure.retryAfterSeconds);
  return jsonResponse(body, { status: failure.status, headers, cookies });
}
