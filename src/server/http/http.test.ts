import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { nicknameSchema } from '@/shared/api';
import { SMALL_BODY_BYTES, parseBody, validate } from './body';
import { ApiFailure } from './errors';
import { clientIp, hashIp } from './ip';
import { isSameOrigin } from './origin';
import { retryAfterSeconds, windowStartOf } from './rateLimit';

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/x', { method: 'POST', body, headers });

describe('isSameOrigin', () => {
  const headers = (record: Record<string, string>) => new Headers(record);

  it('trusts Sec-Fetch-Site when the browser sends it', () => {
    expect(isSameOrigin(headers({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isSameOrigin(headers({ 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(isSameOrigin(headers({ 'sec-fetch-site': 'same-site' }))).toBe(false);
    // A forged Origin cannot override what the browser says about the fetch.
    expect(isSameOrigin(headers({ 'sec-fetch-site': 'cross-site', origin: 'http://localhost:3000', host: 'localhost:3000' }))).toBe(false);
  });

  it('falls back to comparing Origin with Host', () => {
    expect(isSameOrigin(headers({ origin: 'http://localhost:3000', host: 'localhost:3000' }))).toBe(true);
    expect(isSameOrigin(headers({ origin: 'https://evil.example', host: 'localhost:3000' }))).toBe(false);
    expect(isSameOrigin(headers({ origin: 'https://jogo.example', host: 'internal:3000', 'x-forwarded-host': 'jogo.example' }))).toBe(true);
    expect(isSameOrigin(headers({ origin: 'not a url', host: 'localhost:3000' }))).toBe(false);
  });

  it('refuses a request that says nothing about where it came from', () => {
    expect(isSameOrigin(headers({ host: 'localhost:3000' }))).toBe(false);
  });
});

describe('clientIp and hashIp', () => {
  it('prefers the platform header, then the first forwarded address', () => {
    expect(clientIp(new Headers({ 'x-vercel-forwarded-for': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe('1.1.1.1');
    expect(clientIp(new Headers({ 'x-forwarded-for': '2.2.2.2, 3.3.3.3' }))).toBe('2.2.2.2');
    expect(clientIp(new Headers({ 'x-real-ip': '4.4.4.4' }))).toBe('4.4.4.4');
    expect(clientIp(new Headers())).toBe('unknown');
  });

  it('hashes with the salt and never returns the address', () => {
    const a = hashIp('1.2.3.4', 'salt-a');
    expect(a).not.toContain('1.2.3.4');
    expect(a).toBe(hashIp('1.2.3.4', 'salt-a'));
    expect(a).not.toBe(hashIp('1.2.3.4', 'salt-b'));
    expect(a).not.toBe(hashIp('1.2.3.5', 'salt-a'));
  });
});

describe('rate-limit window maths', () => {
  it('aligns to fixed windows', () => {
    expect(windowStartOf(125_000, 60_000)).toBe(120_000);
    expect(windowStartOf(120_000, 60_000)).toBe(120_000);
    expect(windowStartOf(179_999, 60_000)).toBe(120_000);
    expect(windowStartOf(180_000, 60_000)).toBe(180_000);
  });

  it('says how long until the window ends, never less than a second', () => {
    expect(retryAfterSeconds(125_000, 60_000)).toBe(55);
    expect(retryAfterSeconds(179_999, 60_000)).toBe(1);
    expect(retryAfterSeconds(120_000, 60_000)).toBe(60);
  });
});

describe('parseBody', () => {
  const schema = z.object({ nickname: nicknameSchema });

  it('parses and validates JSON', async () => {
    expect(await parseBody(post('{"nickname":"Maria"}'), schema)).toEqual({ nickname: 'Maria' });
  });

  it('answers invalid for bad JSON, wrong shape and rule violations, with the pt-BR message of the schema', async () => {
    await expect(parseBody(post('{nope'), schema)).rejects.toMatchObject({ code: 'invalid' });
    await expect(parseBody(post('{"nickname":5}'), schema)).rejects.toMatchObject({ code: 'invalid' });
    await expect(parseBody(post('{"nickname":"ab"}'), schema)).rejects.toMatchObject({
      code: 'invalid',
      message: expect.stringContaining('pelo menos 3'),
    });
  });

  it('stops reading past the size limit, whatever Content-Length says', async () => {
    const big = JSON.stringify({ nickname: 'a'.repeat(SMALL_BODY_BYTES) });
    await expect(parseBody(post(big), schema)).rejects.toBeInstanceOf(ApiFailure);
    await expect(parseBody(post(big, { 'content-length': '10' }), schema)).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('validate', () => {
  it('uses the generic message for Zod defaults', () => {
    try {
      validate(z.number(), 'x');
      throw new Error('should have failed');
    } catch (error) {
      expect(error).toMatchObject({ code: 'invalid', message: 'Os dados enviados são inválidos.' });
    }
  });
});
