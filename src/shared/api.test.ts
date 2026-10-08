import { describe, expect, it } from 'vitest';
import { nicknameRequestSchema } from './api';

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
