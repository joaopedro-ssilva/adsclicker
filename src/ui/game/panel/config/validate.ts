import type { z } from 'zod';

/** The first message of a failed schema check, or null when the value is fine. */
export function firstIssue(schema: z.ZodType, value: string): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? 'Valor inválido.');
}
