import { describe, expect, it } from 'vitest';
import { passwordSchema } from '@/shared/api';
import { TEMP_PASSWORD_ALPHABET, TEMP_PASSWORD_LENGTH, generateTempPassword } from './tempPassword';

describe('generateTempPassword', () => {
  it('has the fixed length, uses only the alphabet and passes the password rules', () => {
    for (let i = 0; i < 200; i += 1) {
      const password = generateTempPassword();
      expect(password).toHaveLength(TEMP_PASSWORD_LENGTH);
      for (const char of password) expect(TEMP_PASSWORD_ALPHABET).toContain(char);
      expect(passwordSchema.safeParse(password).success).toBe(true);
    }
  });

  it('leaves out look-alike characters', () => {
    expect(TEMP_PASSWORD_ALPHABET).not.toMatch(/[01OlI]/);
    expect(new Set(TEMP_PASSWORD_ALPHABET).size).toBe(TEMP_PASSWORD_ALPHABET.length);
  });

  it('does not repeat across calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) seen.add(generateTempPassword());
    expect(seen.size).toBe(1000);
  });
});
