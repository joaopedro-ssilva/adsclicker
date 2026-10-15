import { describe, expect, it } from 'vitest';
import { nicknameRequestSchema, syncRequestSchema } from './api';

describe('syncRequestSchema clock report', () => {
  const base = { save: '{}', baseRev: 0 };

  it('is optional, so older clients keep syncing', () => {
    expect(syncRequestSchema.safeParse(base).success).toBe(true);
  });

  it('takes the patched flag and the skew', () => {
    expect(syncRequestSchema.safeParse({ ...base, clock: { patched: true, skewMs: 4_000 } }).success).toBe(true);
    expect(syncRequestSchema.safeParse({ ...base, clock: { patched: false, skewMs: -1_500 } }).success).toBe(true);
  });

  it('refuses a malformed report', () => {
    expect(syncRequestSchema.safeParse({ ...base, clock: { patched: 'yes', skewMs: 0 } }).success).toBe(false);
    expect(syncRequestSchema.safeParse({ ...base, clock: { patched: true, skewMs: 1.5 } }).success).toBe(false);
    expect(syncRequestSchema.safeParse({ ...base, clock: { patched: true, skewMs: 1e15 } }).success).toBe(false);
    expect(syncRequestSchema.safeParse({ ...base, clock: { patched: true } }).success).toBe(false);
  });
});

describe('nicknameRequestSchema', () => {
  it('requires a password together with the nickname', () => {
    expect(nicknameRequestSchema.safeParse({ nickname: 'Ana' }).success).toBe(false);
    expect(nicknameRequestSchema.safeParse({ nickname: 'Ana', password: '' }).success).toBe(false);
    expect(nicknameRequestSchema.safeParse({ nickname: 'Ana', password: '12345' }).success).toBe(false);
  });

  it('accepts a nickname with a password of 6 to 72 characters', () => {
    expect(nicknameRequestSchema.safeParse({ nickname: 'Ana', password: '123456' }).success).toBe(true);
    expect(nicknameRequestSchema.safeParse({ nickname: 'Ana', password: 'x'.repeat(72) }).success).toBe(true);
    expect(nicknameRequestSchema.safeParse({ nickname: 'Ana', password: 'x'.repeat(73) }).success).toBe(false);
  });
});
