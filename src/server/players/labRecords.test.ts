import { describe, expect, it } from 'vitest';
import { content } from '@/game/content';
import { Decimal } from '@/game/engine';
import type { GameState } from '@/game/engine/state';
import { simulate } from '@/game/sim/simulate';
import { LAB_MIN_PHASE_SECONDS, LAB_PHASE_GRACE } from './labRecords';
import { TIME_GRACE_SECONDS, judgeSave } from './plausibility';
import { projectState } from './projection';
import { roundTrip } from '../testing/play';

/** Two honest saves 45 s apart from the simulator, with the lab unlocked and a run record that fits the time. */
function pair(): { previous: GameState; next: GameState } {
  const a = roundTrip(simulate(content, { maxSeconds: 60, stopWhenDone: false, clicksPerSecond: 4, graduate: false }).finalState);
  const b = roundTrip(simulate(content, { maxSeconds: 105, from: a, stopWhenDone: false, clicksPerSecond: 4, graduate: false }).finalState);
  for (const state of [a, b]) {
    state.lab.unlocked = true;
  }
  return { previous: a, next: b };
}

const judge = (previous: GameState | null, next: GameState, elapsedMs = 45_000) => judgeSave({ previous, next, elapsedMs });

describe('judgeSave: the Laboratório records', () => {
  it('lets an honest record grow with the phases cleared in the time that passed', () => {
    const { previous, next } = pair();
    previous.lab.bestPhase = 4;
    previous.lab.counters.phasesCleared = 3;
    next.lab.bestPhase = 12;
    next.lab.counters.phasesCleared = 11;
    expect(judge(previous, next)).toMatchObject({ ok: true });
  });

  it('rejects a phase that appears without the lab unlocked', () => {
    const { previous, next } = pair();
    previous.lab.unlocked = false;
    next.lab.unlocked = false;
    next.lab.bestPhase = 3;
    next.lab.counters.phasesCleared = 2;
    expect(judge(previous, next)).toMatchObject({ ok: false, reason: expect.stringContaining('lab unlocked') });
  });

  it('rejects an impossible jump of the highest phase (a forged record far above the window after a record of 5)', () => {
    const { previous, next } = pair();
    previous.lab.bestPhase = 5;
    previous.lab.counters.phasesCleared = 4;
    // Far beyond what the window (45 s plus the time grace) allows at the fastest honest pace.
    const forged = 5 + Math.ceil((45 + TIME_GRACE_SECONDS) / LAB_MIN_PHASE_SECONDS) + LAB_PHASE_GRACE + 50;
    next.lab.bestPhase = forged;
    next.lab.counters.phasesCleared = forged - 1; // even with the counter forged to match
    const verdict = judge(previous, next);
    expect(verdict.ok).toBe(false);
    expect(verdict).toMatchObject({ reason: expect.stringContaining('lab phase') });
  });

  it('rejects a jump the counter does not back, even inside the time', () => {
    const { previous, next } = pair();
    previous.lab.bestPhase = 5;
    next.lab.bestPhase = 20;
    next.lab.counters.phasesCleared = previous.lab.counters.phasesCleared + 2;
    expect(judge(previous, next)).toMatchObject({ ok: false, reason: expect.stringContaining('phases cleared') });
  });

  it('rejects a first save that claims more phases than its play time allows', () => {
    const { next } = pair();
    const seconds = next.counters.playSeconds;
    next.lab.bestPhase = Math.ceil((seconds + TIME_GRACE_SECONDS) / LAB_MIN_PHASE_SECONDS) + LAB_PHASE_GRACE + 10;
    next.lab.counters.phasesCleared = next.lab.bestPhase;
    expect(judge(null, next)).toMatchObject({ ok: false, reason: expect.stringContaining('lab phase') });
  });

  it('rejects a record that goes down', () => {
    const { previous, next } = pair();
    previous.lab.bestPhase = 8;
    previous.lab.counters.phasesCleared = 7;
    next.lab.bestPhase = 6;
    next.lab.counters.phasesCleared = 7;
    expect(judge(previous, next)).toMatchObject({ ok: false, reason: expect.stringContaining('backwards') });
  });

  it('rejects a best run above the lifetime coins', () => {
    const { previous, next } = pair();
    next.records.mostCoins = next.lifetimeCoins.mul(10);
    expect(judge(previous, next)).toMatchObject({ ok: false, reason: expect.stringContaining('lifetime coins') });
  });

  it('rejects a best run that grows more than the coins gained', () => {
    const { previous, next } = pair();
    previous.lifetimeCoins = new Decimal(1000);
    next.lifetimeCoins = new Decimal(1500);
    previous.runCoins = new Decimal(0);
    next.runCoins = new Decimal(0);
    previous.records.mostCoins = new Decimal(0);
    // below the lifetime coins (so the first rule passes) but past the 500 this window made
    next.records.mostCoins = new Decimal(1200);
    expect(judge(previous, next)).toMatchObject({ ok: false, reason: expect.stringContaining('best run grew') });
  });

  it('accepts a best run that follows the live run', () => {
    const { previous, next } = pair();
    previous.records.mostCoins = new Decimal(0);
    next.records.mostCoins = next.runCoins;
    expect(judge(previous, next)).toMatchObject({ ok: true });
  });
});

describe('projectState: the lab board columns', () => {
  it('projects the record and the build of an unlocked lab, and nothing of a locked one', () => {
    const { next } = pair();
    next.lab.bestPhase = 9;
    next.lab.bestPhaseBuild = [{ slot: 'ferramenta', base: content.lab.starter, rarity: 'comum', level: 1 }];
    next.records.mostCoins = new Decimal('1e30');
    next.lifetimeCoins = new Decimal('1e31');
    const projected = projectState(next);
    expect(projected.labBestPhase).toBe(9);
    expect(projected.labBestPhaseBuild).toHaveLength(1);
    expect(projected.bestRunCoinsLog).toBeGreaterThan(29.9);
    expect(projected.bestRunCoinsText).toBe(next.records.mostCoins.gt(next.runCoins) ? '1e+30' : next.runCoins.toString());

    next.lab.unlocked = false;
    const locked = projectState(next);
    expect(locked.labBestPhase).toBe(0);
    expect(locked.labBestPhaseBuild).toBeNull();
  });
});
