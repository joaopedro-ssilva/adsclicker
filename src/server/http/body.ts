import type { z } from 'zod';
import { ApiFailure } from './errors';

/** Largest body any route but the sync takes. */
export const SMALL_BODY_BYTES = 4_096;
/** The sync carries up to 64k characters of save; JSON escaping can double that. */
export const SYNC_BODY_BYTES = 160_000;

/** Reads the body as text, stopping as soon as it passes the limit (a lying Content-Length included). */
async function readLimited(request: Request, maxBytes: number): Promise<string> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new ApiFailure('invalid', 'Requisição grande demais.');
  if (!request.body) return '';

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      void reader.cancel().catch(() => undefined);
      throw new ApiFailure('invalid', 'Requisição grande demais.');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/** Size-limited JSON body validated against a Zod schema. Anything off is a 400 `invalid`. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  maxBytes: number = SMALL_BODY_BYTES,
): Promise<z.infer<S>> {
  const text = await readLimited(request, maxBytes);
  let json: unknown;
  try {
    json = text === '' ? {} : JSON.parse(text);
  } catch {
    throw new ApiFailure('invalid', 'O corpo da requisição não é um JSON válido.');
  }
  return validate(schema, json);
}

/** Validates already-parsed input (a query string, a path parameter). */
export function validate<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  // Zod's default messages are English and technical. The schemas of the contract carry pt-BR
  // messages where the player can fix the input (nickname, password); those are passed through.
  const message = parsed.error.issues[0]?.message;
  const isZodDefault = message === undefined || /^(Invalid|Too (small|big)|Expected|Unrecognized|Required|Input)/.test(message);
  throw new ApiFailure('invalid', isZodDefault ? undefined : message);
}
