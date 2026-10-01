/**
 * Nickname rules beyond the format in src/shared/api.ts: the uniqueness key (case and accent
 * insensitive) and a short blocklist. Pure functions, no database.
 */

/** "Édécio" and "edecio" are the same nickname: lower case, accents and diacritics removed. */
export function nicknameKey(nickname: string): string {
  return nickname
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Look-alike digits and symbols people use to dodge filters. */
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

/** Undoes look-alikes and repeated letters: "p4rr4" becomes "parra". Separators are kept out of the way by the caller. */
function unleet(text: string): string {
  let out = '';
  for (const char of text) out += LEET[char] ?? char;
  return out.replace(/(.)\1{2,}/g, '$1'); // "puuuta" -> "puta"
}

/** The key with separators removed: "P.u_t4" becomes "puta". */
function squash(key: string): string {
  return unleet(key.replace(/[\s._-]/g, ''));
}

/**
 * Terms refused anywhere inside the nickname. Only terms that do not occur inside innocent
 * words ("computador" holds "puta", "torpedo" holds "pedo"), so the "Scunthorpe" problem stays
 * rare. Portuguese (pt-BR) and English.
 */
const OFFENSIVE_ANYWHERE = [
  'caralho', 'porra', 'buceta', 'boceta', 'viado', 'merda', 'bosta', 'cuzao', 'arrombad', 'filhadaputa',
  'filhodaputa', 'foder', 'fodase', 'fodido', 'punheta', 'xereca', 'piroca', 'retardad', 'crioulo', 'estupr',
  'pedofil', 'hitler', 'fuck', 'shit', 'bitch', 'nigger', 'nigga', 'faggot', 'whore', 'rapist',
].map(unleet);

/** Terms that would hit innocent names as substrings: refused only as a whole word (or the whole nickname). */
const OFFENSIVE_WORDS = [
  'puta', 'puto', 'fdp', 'pqp', 'vsf', 'tnc', 'cu', 'pau', 'nazi', 'nazista', 'kkk', 'sex', 'sexo', 'porn',
  'porno', 'cunt', 'slut', 'pedo', 'bicha',
].map(unleet);

/** Names that would pass for the staff or the game itself, refused anywhere inside. */
const RESERVED_ANYWHERE = [
  'admin', 'administrador', 'administrator', 'moderador', 'moderator', 'suporte', 'support', 'adsclicker',
  'staff', 'sysop', 'webmaster',
].map(unleet);

const RESERVED_WORDS = [
  'mod', 'adm', 'gm', 'root', 'system', 'sistema', 'oficial', 'official', 'null', 'undefined', 'convidado',
  'guest', 'anonimo', 'anonymous',
].map(unleet);

export type NicknameVerdict = { ok: true } | { ok: false; reason: 'offensive' | 'reserved' };

export function checkNickname(nickname: string): NicknameVerdict {
  const key = nicknameKey(nickname);
  const squashed = squash(key);
  const words = [squashed, ...key.split(/[\s._-]+/).map(unleet)];
  if (RESERVED_ANYWHERE.some((term) => squashed.includes(term)) || words.some((w) => RESERVED_WORDS.includes(w))) {
    return { ok: false, reason: 'reserved' };
  }
  if (OFFENSIVE_ANYWHERE.some((term) => squashed.includes(term)) || words.some((w) => OFFENSIVE_WORDS.includes(w))) {
    return { ok: false, reason: 'offensive' };
  }
  return { ok: true };
}

export const NICKNAME_REFUSED_MESSAGE = 'Esse apelido não está disponível. Escolha outro.';
