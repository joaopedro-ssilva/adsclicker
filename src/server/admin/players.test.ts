import { describe, expect, it } from 'vitest';
import { ADMIN_FLAG_REASON, patchToColumns } from './players';

describe('patchToColumns', () => {
  it('a multiplier other than 1 makes a test account', () => {
    expect(patchToColumns({ multiplier: 10 })).toEqual({ multiplier: 10, testAccount: true });
    expect(patchToColumns({ multiplier: 0.5 })).toEqual({ multiplier: 0.5, testAccount: true });
  });

  it('a multiplier of 1 alone leaves the test mark as it is', () => {
    expect(patchToColumns({ multiplier: 1 })).toEqual({ multiplier: 1 });
  });

  it('an explicit testAccount wins over the implied one', () => {
    expect(patchToColumns({ multiplier: 10, testAccount: false })).toEqual({ multiplier: 10, testAccount: false });
    expect(patchToColumns({ testAccount: false })).toEqual({ testAccount: false });
  });

  it('flagging stores the admin reason and unflagging clears it', () => {
    expect(patchToColumns({ flagged: true })).toEqual({ flagged: true, flagReason: ADMIN_FLAG_REASON });
    expect(patchToColumns({ flagged: false })).toEqual({ flagged: false, flagReason: null });
    expect(ADMIN_FLAG_REASON).toBe('Marcado pelo admin');
  });

  it('bans, and removes a nickname with its uniqueness key', () => {
    expect(patchToColumns({ banned: true })).toEqual({ banned: true });
    expect(patchToColumns({ clearNickname: true })).toEqual({ nickname: null, nicknameKey: null });
  });

  it('an empty patch changes nothing', () => {
    expect(patchToColumns({})).toEqual({});
  });
});
