import { isDatabaseDown } from '../db/client';
import { ApiFailure } from './errors';
import { errorResponse } from './respond';

/**
 * One log line for an error. Drizzle puts the whole query and its parameters in the message
 * (a save can be 64 KB, a hash is a secret), so only the first line and the driver's cause
 * (code and message) are kept.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const head = error.message.split('\n')[0] ?? error.name;
  const cause = error.cause;
  if (cause instanceof Error) {
    const code = (cause as { code?: unknown }).code;
    return `${error.name}: ${head.slice(0, 120)} | cause: ${typeof code === 'string' ? `${code} ` : ''}${cause.message.split('\n')[0] ?? ''}`;
  }
  return `${error.name}: ${head}`;
}

/**
 * Wraps a route handler: whatever it throws becomes the error body of the contract. Known
 * failures keep their message; "database down" is a 503; anything else is logged on the
 * server and answered with a generic 500, so internals never reach the client.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiFailure) return errorResponse(error);
      if (isDatabaseDown(error)) {
        console.error(`[api] database unavailable: ${describeError(error)}`);
        return errorResponse(new ApiFailure('unavailable'));
      }
      console.error(`[api] unexpected error: ${describeError(error)}`, error instanceof Error ? error.stack?.split('\n').slice(1, 4).join('\n') : '');
      return errorResponse(new ApiFailure('internal'));
    }
  };
}
