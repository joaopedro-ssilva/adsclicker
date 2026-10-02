import type { CargoId, HackathonContent, SlotId, StageDef } from '../content/types';
import { computeBuild } from '../engine/build';
import { indexOf } from '../engine/contentIndex';
import { itemScore, recycleValue, rollDrops } from '../engine/loot';
import { applyXp, mentorCost } from '../engine/progression';
import { mix32, mulberry32 } from '../engine/rng';
import { resolveStage } from '../engine/stage';
import type { Build, ItemInstance } from '../engine/types';
import { allocateSkills, chooseActive } from './builds';
import { playRun } from './fights';
import type { PolicyId } from './policies';

export interface ProgressionOptions {
  students: number;
  policy: PolicyId;
  /** Cafés a student may spend before giving up. */
  maxAttempts: number;
  seed: number;
}

export interface StudentResult {
  /** Fights fought in each stage (farming included). */
  attemptsByStage: Record<string, number>;
  /** Cafés spent, level and total mentor levels when each stage was first cleared. */
  firstClear: Record<string, { cafes: number; level: number; mentorLevels: number }>;
  /** Cafés spent when each level was reached. */
  levelAt: Record<number, number>;
  finalLevel: number;
  cafes: number;
}

export interface StageProgress {
  stage: StageDef;
  /** Students (of `students`) who cleared it. */
  cleared: number;
  /** Averages over the students who cleared it. */
  avgCafesToClear: number;
  avgAttemptsInStage: number;
  avgLevelAtClear: number;
  avgMentorLevels: number;
}

export interface ProgressionReport {
  options: ProgressionOptions;
  stages: StageProgress[];
  avgFinalLevel: number;
  /** Average Cafés to reach each milestone level (students who got there). */
  levelMilestones: { level: number; reached: number; avgCafes: number }[];
}

const LOSSES_BEFORE_FARMING = 2;
const FARM_FIGHTS = 5;
/** One Café in this many goes to the daily stage, once the student can handle it. */
const DAILY_EVERY = 12;
const DAILY_MIN_LEVEL = 5;

/** One fresh student farming the campaign in order, with luck drawn from a seeded stream. */
export function simulateStudent(content: HackathonContent, policy: PolicyId, seed: number, maxAttempts: number): StudentResult {
  const index = indexOf(content);
  const rng = mulberry32(seed);
  const stages = [...content.stages].sort((a, b) => a.chapter - b.chapter || a.order - b.order);
  const cargosByOrder = [...content.cargos].sort((a, b) => a.order - b.order);
  const won = new Set<string>();
  const result: StudentResult = { attemptsByStage: {}, firstClear: {}, levelAt: {}, finalLevel: 1, cafes: 0 };

  let cargo: CargoId = cargosByOrder[0]?.id ?? 'estudante';
  let level = 1;
  let xp = 0;
  let commits = 0;
  let pity = 0;
  let itemCount = 0;
  const mentors: Partial<Record<string, number>> = {};
  const equipped: Partial<Record<SlotId, ItemInstance>> = {};
  let lossStreak = 0;
  let farmLeft = 0;

  const buildNow = (facingBoss: boolean): Build => {
    const { skillNodes, activeSkills: owned } = allocateSkills(level, content);
    const activeSkills = chooseActive(owned, facingBoss, index.cargos.get(cargo)?.skillSlots ?? 0, content);
    return computeBuild({ cargo, level, skillNodes, mentors, equipped, activeSkills }, content);
  };
  const buyMentors = (): void => {
    for (;;) {
      const options = content.mentors
        .map((m) => ({ id: m.professor, cost: mentorCost(m.professor, mentors[m.professor] ?? 0, content) }))
        .filter((o): o is { id: typeof o.id; cost: number } => o.cost !== null && o.cost <= commits)
        .sort((a, b) => a.cost - b.cost);
      const next = options[0];
      if (!next) return;
      commits -= next.cost;
      mentors[next.id] = (mentors[next.id] ?? 0) + 1;
    }
  };
  const keepBest = (item: ItemInstance): void => {
    const slot = index.items.get(item.base)?.slot;
    if (!slot) return;
    const current = equipped[slot];
    if (!current || itemScore(item) > itemScore(current)) {
      if (current) commits += recycleValue(current, content);
      equipped[slot] = item;
    } else {
      commits += recycleValue(item, content);
    }
  };

  const finalCap = Math.max(...content.cargos.map((c) => c.maxLevel));
  while (result.cafes < maxAttempts && level < finalCap) {
    const open = stages.filter((s) => (s.requires === null || won.has(s.requires)) && s.requiredLevel <= level);
    const target = open.find((s) => !won.has(s.id));
    const beaten = open.filter((s) => won.has(s.id));
    const farm = beaten[beaten.length - 1];
    const farming = farmLeft > 0 || !target;
    const stageDef = farming ? (farm ?? target) : target;
    if (!stageDef) break;
    const dailyToday = result.cafes % DAILY_EVERY === DAILY_EVERY - 1 && level >= DAILY_MIN_LEVEL;
    const dateKey = `2026-03-${Math.floor(result.cafes / DAILY_EVERY)}`;
    const stage = resolveStage(dailyToday ? 'daily' : stageDef.id, dateKey, content);
    if (!stage) break;
    const regular = stage.id !== 'daily';

    result.cafes += 1;
    result.attemptsByStage[stage.id] = (result.attemptsByStage[stage.id] ?? 0) + 1;
    const build = buildNow(stage.boss);
    const { outcome } = playRun(build, stage, mix32(Math.floor(rng() * 4294967296)), policy, content);
    const firstClear = outcome.won && regular && !won.has(stage.id);

    if (outcome.won) {
      const dropped = rollDrops({ stage, build, firstClear, pity, rng, now: 0, newId: () => `s${(itemCount += 1)}` }, content);
      pity = dropped.pity;
      for (const item of dropped.items) keepBest(item);
      const gain = (value: number, percent: number) => Math.round((value * (100 + percent)) / 100);
      xp += gain(stage.xp, build.meta.xpGain);
      commits += gain(stage.commits, build.meta.commitsGain) * (firstClear ? content.config.firstClear.commitsMultiplier : 1);
      if (firstClear) {
        won.add(stage.id);
        const promoted = cargosByOrder.find((c) => c.promotionStage === stage.id);
        const next = promoted ? cargosByOrder.find((c) => c.order > promoted.order) : undefined;
        if (next) cargo = next.id;
      }
      if (!farming && regular) lossStreak = 0;
    } else {
      xp += Math.floor(stage.xp * content.config.defeatXpShare);
      if (!farming && regular) lossStreak += 1;
    }
    if (farmLeft > 0) farmLeft -= 1;
    else if (lossStreak >= LOSSES_BEFORE_FARMING && farm) {
      farmLeft = FARM_FIGHTS;
      lossStreak = 0;
    }

    const before = level;
    const progress = applyXp({ cargo, level, xp }, 0, content);
    level = progress.level;
    xp = progress.xp;
    buyMentors();
    if (firstClear) {
      // The promotion may raise the cap, so level up again with the XP that was waiting.
      const raised = applyXp({ cargo, level, xp }, 0, content);
      level = raised.level;
      xp = raised.xp;
      const mentorLevels = Object.values(mentors).reduce<number>((sum, n) => sum + (n ?? 0), 0);
      result.firstClear[stage.id] = { cafes: result.cafes, level, mentorLevels };
    }
    for (let l = before + 1; l <= level; l += 1) result.levelAt[l] = result.cafes;
  }
  result.finalLevel = level;
  return result;
}

export function simulateProgression(content: HackathonContent, options: ProgressionOptions): ProgressionReport {
  const students: StudentResult[] = [];
  for (let i = 0; i < options.students; i += 1) {
    students.push(simulateStudent(content, options.policy, mix32(options.seed + i * 7919), options.maxAttempts));
  }
  const avg = (values: number[]) => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);
  const stages = [...content.stages]
    .sort((a, b) => a.chapter - b.chapter || a.order - b.order)
    .map((stage): StageProgress => {
      const who = students.filter((s) => s.firstClear[stage.id]);
      const clears = who.map((s) => s.firstClear[stage.id]!);
      return {
        stage,
        cleared: clears.length,
        avgCafesToClear: avg(clears.map((c) => c.cafes)),
        avgAttemptsInStage: avg(who.map((s) => s.attemptsByStage[stage.id] ?? 0)),
        avgLevelAtClear: avg(clears.map((c) => c.level)),
        avgMentorLevels: avg(clears.map((c) => c.mentorLevels)),
      };
    });
  const cap = Math.max(...content.cargos.map((c) => c.maxLevel));
  const levelMilestones = [5, 8, 10, 15, cap].map((level) => {
    const reached = students.filter((s) => s.levelAt[level] !== undefined);
    return { level, reached: reached.length, avgCafes: avg(reached.map((s) => s.levelAt[level] ?? 0)) };
  });
  return {
    options,
    stages,
    avgFinalLevel: avg(students.map((s) => s.finalLevel)),
    levelMilestones,
  };
}
