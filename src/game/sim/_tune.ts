/* Scratch tool for the balance pass. Not part of the deliverable. */
import { content as base } from '@/game/content';
import { PROFESSOR_IDS } from '../content/types';
import type { GameContent, ProfessorId } from '../content/types';
import { formatDuration, formatNumber } from '../engine/format';
import { parseDecimal } from '../engine/decimal';
import { simulate } from './simulate';
import type { SimOptions } from './simulate';
import { PROFILES } from './profiles';

export function fmtDec(x: number): string {
  if (x < 1e6) return String(Number(x.toPrecision(3)));
  const exp = Math.floor(Math.log10(x));
  const mant = x / 10 ** exp;
  return `${Number(mant.toPrecision(3))}e${exp}`;
}

export interface Params {
  c: number;
  p: number;
  /** Hire cost of professors 2..8 (Gladimir..Pablo). */
  hire: number[];
  clickScale?: number;
  /** baseClick / baseCost of Muito Legal. */
  ml?: [number, number];
}

export function build(params: Params): GameContent {
  const content = structuredClone(base) as GameContent;
  const oldCost = new Map<string, number>();
  const oldProd = new Map<string, number>();
  const ratioCost = new Map<string, number>();
  const ratioProd = new Map<string, number>();
  content.disciplines.forEach((d, i) => {
    const nc = 15 * params.c ** i;
    const np = 0.2 * params.p ** i;
    oldCost.set(d.id, parseDecimal(d.baseCost).toNumber());
    oldProd.set(d.id, parseDecimal(d.baseProduction).toNumber());
    ratioCost.set(d.id, nc / parseDecimal(d.baseCost).toNumber());
    ratioProd.set(d.id, np / parseDecimal(d.baseProduction).toNumber());
    d.baseCost = fmtDec(nc);
    d.baseProduction = fmtDec(np);
  });
  const tier0 = (prof: ProfessorId) => content.disciplines.find((d) => d.professor === prof && d.tier === 0)!;
  PROFESSOR_IDS.slice(1).forEach((id, i) => {
    content.professors[id].hireCost = fmtDec(params.hire[i]!);
  });
  for (const cu of content.clickUpgrades) {
    const t0 = tier0(cu.professor);
    cu.baseCost = fmtDec(parseDecimal(cu.baseCost).toNumber() * ratioCost.get(t0.id)!);
    cu.baseClick = fmtDec(parseDecimal(cu.baseClick).toNumber() * ratioProd.get(t0.id)! * (params.clickScale ?? 1));
    if (cu.id === 'muito-legal' && params.ml) {
      cu.baseClick = fmtDec(params.ml[0]);
      cu.baseCost = fmtDec(params.ml[1]);
    }
  }
  for (const r of content.research) {
    const gate = r.requires.find((q) => q.kind === 'disciplineLevel');
    const ref = gate && gate.kind === 'disciplineLevel' ? gate.discipline : tier0(r.requires.find((q) => q.kind === 'professorHired')?.kind === 'professorHired' ? ((r.requires.find((q) => q.kind === 'professorHired') as { professor: ProfessorId }).professor) : r.professor).id;
    r.cost = fmtDec(parseDecimal(r.cost).toNumber() * ratioCost.get(ref)!);
  }
  void oldCost;
  void oldProd;
  return content;
}

export function timeTo(content: GameContent, prof: ProfessorId, options: SimOptions = {}): number {
  const r = simulate(content, {
    ...PROFILES.active.options,
    maxSeconds: 6 * 3600,
    stopWhenDone: false,
    graduate: false,
    until: (s) => s.hired[prof],
    ...options,
  });
  return r.finalState.hired[prof] ? r.seconds : Infinity;
}

export function fit(params: Params, targets: number[], options: SimOptions = {}, verbose = true, wide = false): Params {
  const out: Params = { ...params, hire: [...params.hire] };
  const ids = PROFESSOR_IDS.slice(1);
  for (let j = 0; j < targets.length; j += 1) {
    const prof = ids[j]!;
    const lastPrev = 15 * out.c ** (3 * (j + 1) - 1);
    const first = 15 * out.c ** (3 * (j + 1));
    let lo = Math.log(wide ? first * 0.05 : lastPrev * 1.0001);
    let hi = Math.log(wide ? first * 3 : first * 0.9999);
    for (let it = 0; it < 9; it += 1) {
      const mid = (lo + hi) / 2;
      out.hire[j] = Math.exp(mid);
      const t = timeTo(build(out), prof, { ...options, maxSeconds: targets[j]! * 3 });
      if (t > targets[j]!) hi = mid;
      else lo = mid;
    }
    out.hire[j] = Math.exp((lo + hi) / 2);
    const t = timeTo(build(out), prof, options);
    if (verbose) {
      const frac = out.hire[j]! / first * 100 / 100;
      console.log(`${prof}: hire ${formatNumber(out.hire[j]!)} (x${frac.toFixed(2)} of its first tier) -> ${formatDuration(t * 1000)} (target ${formatDuration(targets[j]! * 1000)})`);
    }
  }
  return out;
}
