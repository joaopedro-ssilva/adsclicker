import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * scrypt with a per-account salt. Stored as `scrypt$N$r$p$salt$hash` (base64), so the cost can
 * be raised later while old hashes keep verifying with the parameters they were made with.
 */
const COST = 16_384; // N: ~16 MB and ~50 ms per hash, enough to slow a guesser, cheap for a login
const BLOCK = 8;
const PARALLEL = 1;
const KEY_BYTES = 64;
const SALT_BYTES = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, cost: number, block: number, parallel: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_BYTES,
      { N: cost, r: block, p: parallel, maxmem: MAX_MEMORY },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, COST, BLOCK, PARALLEL);
  return ['scrypt', COST, BLOCK, PARALLEL, salt.toString('base64'), key.toString('base64')].join('$');
}

/** Constant-time comparison. A malformed stored hash simply does not verify. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
  const cost = Number(n);
  const block = Number(r);
  const parallel = Number(p);
  if (![cost, block, parallel].every((value) => Number.isInteger(value) && value > 0)) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'), cost, block, parallel);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

let decoy: Promise<string> | undefined;

/**
 * Spends the time of a real verification. A login for a nickname that does not exist (or has no
 * password) calls this so the answer takes as long as a wrong password would.
 */
export async function burnVerification(password: string): Promise<void> {
  decoy ??= hashPassword(randomBytes(16).toString('hex'));
  await verifyPassword(password, await decoy);
}
