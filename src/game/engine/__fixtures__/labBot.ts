/**
 * A simulated Laboratório player, for the pacing tests and the balance sheets (docs/LABORATORIO.md): greedy but sensible
 * reward choices, five clicks every second, no ADScoins unless a budget is given. Deterministic for a seed.
 */
import { LAB_RARITIES } from '../../content/labTypes';
import type { LabRarity, LabSlot } from '../../content/labTypes';
import type { GameContent } from '../../content/types';
import { Decimal } from '../decimal';
import { chooseLabReward, equipLabPending, labClick, levelUpLabItem, recycleLabPending, rerollLabOffers, startLabRun, unlockLab } from '../lab/actions';
import { labTotals } from '../lab/effects';
import { levelUpCost } from '../lab/costs';
import { itemPower } from '../lab/items';
import { advanceLab } from '../lab/run';
import { labIndex } from '../lab/state';
import { labTreeSpent } from '../lab/tree';
import { hire, newCleanGame, T0 } from './helpers';
import type { TestGame } from './helpers';

export interface BotOptions {
  /** Levels of the tree the player starts the run with. */
  tree?: Record<string, number>;
  /** ADScoins to spend on item level ups (a decimal string), e.g. '1e25'. */
  coins?: string;
  /** Draws the options again when the best one is poor and the tree allows it. Default true. */
  reroll?: boolean;
  /** A starting item (shop cosmetic) the run begins with instead of the Mouse quebrado. */
  startItem?: string;
}

export interface BotResult {
  /** Phase the monitor broke in. */
  phase: number;
  seconds: number;
  bosses: number;
  /** Commits the run put in the wallet (break payout, recycling, Commits rewards, boss Commits). */
  commits: number;
  /** Best rarity rank among the items equipped when the run ended, and when the 2nd boss (phase 10) was beaten. */
  bestRank: number;
  rankAtBoss2: number | null;
  rankAtBoss1: number | null;
  brokenBy: 'timer' | 'integrity' | null;
}

const rank = (r: LabRarity) => LAB_RARITIES.indexOf(r);

function newGame(options: BotOptions): TestGame {
  const g = newCleanGame();
  hire(g.state, 'pablo');
  g.state.diplomas = 150;
  g.state.diplomasEarned = 150;
  unlockLab(g.state, g.content, T0, g.emit);
  for (const def of g.content.disciplines) g.state.levels[def.id] = 1;
  g.state.lab.tree = { ...(options.tree ?? {}) };
  g.state.coins = new Decimal(options.coins ?? '0');
  if (options.startItem) {
    g.state.lab.cosmetics.owned[options.startItem] = true;
    g.state.lab.cosmetics.startItem = options.startItem;
  }
  return g;
}

/** Plays one run to the end. */
export function playBot(seed: number, options: BotOptions = {}): BotResult {
  const g = newGame(options);
  startLabRun(g.state, g.content, seed, T0, g.emit);
  const index = labIndex(g.content);
  const slotOf = (id: string) => index.bases.get(id)!.slot;
  const run = () => g.state.lab.turma.run!;
  const bestEquipped = () => Math.max(0, ...Object.values(g.state.lab.turma.equipped).map((item) => rank(item.rarity)));
  let rankAtBoss1: number | null = null;
  let rankAtBoss2: number | null = null;
  let now = T0;
  let bosses = 0;

  const spendCoins = () => {
    for (let guard = 0; guard < 60; guard += 1) {
      let best: { slot: LabSlot; ratio: number } | null = null;
      for (const [slot, item] of Object.entries(g.state.lab.turma.equipped)) {
        const cost = levelUpCost(g.content, item, labTotals(g.state, g.content).lab.levelCost);
        if (!cost || g.state.coins.lt(cost)) continue;
        const gain = itemPower(g.content, { ...item, level: item.level + 1 }) - itemPower(g.content, item);
        const ratio = gain / Math.max(1e-300, cost.toNumber());
        if (!best || ratio > best.ratio) best = { slot: slot as LabSlot, ratio };
      }
      if (!best || !levelUpLabItem(g.state, g.content, best.slot, T0, g.emit)) return;
    }
  };

  const score = (offer: ReturnType<typeof run>['offers'][number]): number => {
    const current = run();
    if (offer.kind === 'item') {
      const held = g.state.lab.turma.equipped[slotOf(offer.item.base)];
      return held ? 10 * (itemPower(g.content, offer.item) / itemPower(g.content, held)) : 50;
    }
    if (offer.kind === 'buff') {
      const lab = index.buffs.get(offer.buff)?.lab;
      return 8 + (lab?.damage ?? 0) * 20 + (lab?.drain ? -lab.drain * 20 : 0) + (lab?.integrityPct ?? 0) * 8;
    }
    if (offer.kind === 'repair') return current.integrity < current.maxIntegrity / 2 ? 40 : 2;
    return 3;
  };

  for (let guard = 0; guard < 40_000 && run().status !== 'broken'; guard += 1) {
    const current = run();
    if (current.status === 'fighting') {
      if (g.state.coins.gt(0)) spendCoins();
      for (let c = 0; c < 5; c += 1) labClick(g.state, g.content, (now += 200), g.emit);
      advanceLab(g.state, g.content, 1, g.emit);
      if (run().bosses > bosses) {
        bosses = run().bosses;
        if (bosses === 1) rankAtBoss1 = bestEquipped();
        if (bosses === 2) rankAtBoss2 = bestEquipped();
      }
    } else if (current.status === 'reward') {
      let best = 0;
      let bestScore = -1;
      current.offers.forEach((offer, i) => {
        const s = score(offer);
        if (s > bestScore) [best, bestScore] = [i, s];
      });
      if ((options.reroll ?? true) && bestScore < 18 && rerollLabOffers(g.state, g.content, T0, g.emit)) continue;
      chooseLabReward(g.state, g.content, best, T0, g.emit);
    } else {
      const pending = current.pending!;
      const held = g.state.lab.turma.equipped[slotOf(pending.base)]!;
      if (itemPower(g.content, pending) > itemPower(g.content, held)) equipLabPending(g.state, g.content, T0, g.emit);
      else recycleLabPending(g.state, g.content, T0, g.emit);
    }
  }
  const end = run();
  return { phase: end.phase, seconds: end.t, bosses: end.bosses, commits: g.state.lab.commits, bestRank: bestEquipped(), rankAtBoss1, rankAtBoss2, brokenBy: end.brokenBy };
}

/** Commits it takes to buy the whole of `content`'s tree. */
export function fullTreeCost(content: GameContent): number {
  const g = newCleanGame();
  const full: Record<string, number> = {};
  for (const node of content.lab.tree) full[node.id] = node.maxLevel;
  g.state.lab.tree = full;
  return labTreeSpent(g.state, g.content);
}

export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
}

/** A tree bought the way a player does: the cheapest next level that is available, until the Commits run out. */
export function treeForBudget(content: GameContent, budget: number): Record<string, number> {
  const tree: Record<string, number> = {};
  let left = budget;
  for (let guard = 0; guard < 2000; guard += 1) {
    let pick: { id: string; cost: number } | null = null;
    for (const node of content.lab.tree) {
      const level = tree[node.id] ?? 0;
      if (level >= node.maxLevel || !node.requires.every((id) => (tree[id] ?? 0) > 0)) continue;
      const cost = Math.ceil(node.cost * node.costGrowth ** level - 1e-9);
      if (cost <= left && (!pick || cost < pick.cost)) pick = { id: node.id, cost };
    }
    if (!pick) break;
    left -= pick.cost;
    tree[pick.id] = (tree[pick.id] ?? 0) + 1;
  }
  return tree;
}

const POWER_EFFECTS = new Set(['damage', 'bossDamage', 'bossTime', 'firstBossTime', 'integrityFlat', 'integrityPct', 'drain', 'repairPhase', 'repairBoss', 'phaseShield', 'secondWind', 'legendaryDamage', 'luck']);

export interface CampaignStep {
  run: number;
  phase: number;
  commits: number;
  spent: number;
}

/**
 * A player's whole campaign: run after run, spending every Commit on the cheapest node available, until the tree is
 * full (or maxRuns). Returns the runs it took (maxRuns + 1 if it never finished) and the step of every run.
 */
export function playCampaign(content: GameContent, maxRuns = 150, coins?: string): { runsToFull: number; steps: CampaignStep[] } {
  const total = fullTreeCost(content);
  let wallet = 0;
  let spent = 0;
  let tree: Record<string, number> = {};
  const steps: CampaignStep[] = [];
  for (let run = 1; run <= maxRuns; run += 1) {
    const result = playBot(7000 + run * 131, { tree, coins });
    wallet += result.commits;
    steps.push({ run, phase: result.phase, commits: result.commits, spent });
    // Buy: keep what is owned and add the cheapest levels that the wallet pays for.
    for (let guard = 0; guard < 500; guard += 1) {
      let pick: { id: string; cost: number } | null = null;
      for (const node of content.lab.tree) {
        const level = tree[node.id] ?? 0;
        if (level >= node.maxLevel || !node.requires.every((id) => (tree[id] ?? 0) > 0)) continue;
        const cost = Math.ceil(node.cost * node.costGrowth ** level - 1e-9);
        // Survival and damage first (a player's usual order), the cheapest among them.
        const power = Object.keys(node.effects).some((key) => POWER_EFFECTS.has(key)) ? 0 : 1;
        const weighted = cost + power * 1_000_000;
        if (cost <= wallet && (!pick || weighted < pick.cost)) pick = { id: node.id, cost: weighted };
      }
      if (!pick) break;
      const paid = pick.cost % 1_000_000;
      wallet -= paid;
      spent += paid;
      tree = { ...tree, [pick.id]: (tree[pick.id] ?? 0) + 1 };
    }
    if (spent >= total) return { runsToFull: run, steps };
  }
  return { runsToFull: maxRuns + 1, steps };
}
