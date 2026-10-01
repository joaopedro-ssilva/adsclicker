import { describe, expect, it } from 'vitest';
import { burnVerification, hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the right password and refuses the wrong one', async () => {
    const hash = await hashPassword('segredo1');
    expect(await verifyPassword('segredo1', hash)).toBe(true);
    expect(await verifyPassword('segredo2', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('salts every hash and never stores the password', async () => {
    const [a, b] = await Promise.all([hashPassword('mesma senha'), hashPassword('mesma senha')]);
    expect(a).not.toBe(b);
    expect(a).not.toContain('mesma senha');
    expect(a.startsWith('scrypt$')).toBe(true);
  });

  it('treats equivalent unicode forms alike', async () => {
    const composed = 'senhão1';
    const decomposed = 'senhão1';
    expect(composed).not.toBe(decomposed);
    expect(await verifyPassword(decomposed, await hashPassword(composed))).toBe(true);
  });

  it('does not verify malformed hashes', async () => {
    for (const stored of ['', 'plain', 'scrypt$x$8$1$aa$bb', 'bcrypt$1$2$3$4$5', 'scrypt$16384$8$1$$']) {
      expect(await verifyPassword('segredo1', stored)).toBe(false);
    }
  });

  it('burnVerification completes without a stored hash', async () => {
    await expect(burnVerification('qualquer')).resolves.toBeUndefined();
  });
});
