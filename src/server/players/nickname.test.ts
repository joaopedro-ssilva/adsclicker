import { describe, expect, it } from 'vitest';
import { checkNickname, nicknameKey } from './nickname';

describe('nicknameKey', () => {
  it('ignores case and accents', () => {
    expect(nicknameKey('Édécio')).toBe('edecio');
    expect(nicknameKey('EDECIO')).toBe(nicknameKey('edecio'));
    expect(nicknameKey('João Pedro')).toBe('joao pedro');
    expect(nicknameKey('Ângelo')).toBe(nicknameKey('angelo'));
  });

  it('keeps different names apart', () => {
    expect(nicknameKey('ana_1')).not.toBe(nicknameKey('ana-1'));
    expect(nicknameKey('maria silva')).not.toBe(nicknameKey('mariasilva'));
  });

  it('collapses runs of spaces', () => {
    expect(nicknameKey('Maria   Silva')).toBe('maria silva');
  });
});

describe('checkNickname', () => {
  it('accepts ordinary names, the professors and words that merely contain a blocked one', () => {
    for (const name of ['Maria Silva', 'Édécio', 'Gladimir', 'Wagner', 'Pablo', 'Ângelo', 'Computador', 'torpedo', 'João_10', 'Cuca Legal', 'Bichano']) {
      expect(checkNickname(name), name).toEqual({ ok: true });
    }
  });

  it('refuses offensive terms, also disguised', () => {
    for (const name of ['Filho da Puta', 'p.u.t.a', 'PUT4', 'Merda_10', 'm3rd4', 'fuuuuck', 'Hitler', 'f-d-p', 'KKK', 'Nazi', 'carálho']) {
      expect(checkNickname(name), name).toMatchObject({ ok: false, reason: 'offensive' });
    }
  });

  it('refuses names that pass for staff or the game', () => {
    for (const name of ['admin', 'Admin', 'ADMlN'.replace('l', 'i'), 'Administrador', 'Moderador', 'mod', 'AdsClicker', 'Suporte Oficial', 'sistema', 'Ádmin']) {
      expect(checkNickname(name), name).toMatchObject({ ok: false, reason: 'reserved' });
    }
  });
});
