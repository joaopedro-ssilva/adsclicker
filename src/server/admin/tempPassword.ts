import { randomInt } from 'node:crypto';

/** No 0/O, 1/l/I: the owner reads or types this to the player, so look-alikes are left out. */
export const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
export const TEMP_PASSWORD_LENGTH = 12;

/** A random temporary password from a cryptographic source (`randomInt` is unbiased). */
export function generateTempPassword(): string {
  let out = '';
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i += 1) out += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  return out;
}
