import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { donationTitles } from '../content/donations';
import { LAB_FLAGS, labBossFlag } from '../content/labFlags';
import { PROFESSOR_IDS } from '../content/types';
import type { Condition } from '../content/types';
import type { Emit, GameEvent } from '../store/types';
import { achievementDetail } from './achievementDetail';
import { checkAchievements, createProbe, measureCondition } from './achievements';
import { Decimal } from './decimal';
import { donateToCampus } from './donations';
import { createInitialState } from './init';
import { grantLabCosmetic, labCosmeticOwned } from './lab/cosmetics';
import { advanceLab, labClick, startLabRun } from './lab/run';
import { enterNextPhase, spawnPhase } from './lab/phase';
import { labTotals } from './lab/effects';
import type { LabItem } from './lab/types';
import { unlockLab } from './lab/access';
import { deserializeState, serializeState } from './save';

const T0 = 1_700_000_000_000;

function game() {
  const events: GameEvent[] = [];
  const emit: Emit = (event) => events.push(event);
  const state = createInitialState(content, T0);
  for (const id of PROFESSOR_IDS) state.hired[id] = true;
  return { state, events, emit };
}

type Game = ReturnType<typeof game>;

const met = (g: Game, condition: Condition) => measureCondition(g.state, content, condition, createProbe(g.state, content));
const byId = (id: string) => content.achievements.find((a) => a.id === id)!;
const detail = (g: Game, id: string) => achievementDetail(g.state, content, byId(id), createProbe(g.state, content));

function item(base: string, rarity: LabItem['rarity'] = 'comum', uid = 1): LabItem {
  return { uid, base, rarity, level: 1, affixes: [], rerolls: 0 };
}

/** A game with the lab open and a run started: every aula at level 1, 150 diplomas spent on the unlock. */
function labGame(seed = 99): Game {
  const g = game();
  g.state.diplomas = 150;
  g.state.diplomasEarned = 150;
  unlockLab(g.state, content, g.emit);
  for (const def of content.disciplines) g.state.levels[def.id] = 1;
  expect(startLabRun(g.state, content, seed, g.emit)).toBe(true);
  return g;
}

function run(g: Game) {
  const current = g.state.lab.turma.run;
  if (!current) throw new Error('no run');
  return current;
}

/** Puts the run in `phase` with a fresh wave and knocks the wave down: the phase is cleared. */
function clearAt(g: Game, phase: number): void {
  const current = run(g);
  current.phase = phase;
  current.status = 'fighting';
  spawnPhase(g.state, content, labTotals(g.state, content));
  for (let i = 0; i < 6 && current.status === 'fighting'; i += 1) {
    for (const mob of current.mobs) mob.hp = 0.001;
    advanceLab(g.state, content, 0.2, g.emit);
  }
  expect(current.status).toBe('reward');
}

describe('donated', () => {
  it('measures the total given on the log scale, and meets at the title threshold', () => {
    const g = game();
    const condition: Condition = { kind: 'donated', gte: '1e12' };
    expect(met(g, condition)).toEqual({ progress: 0, met: false });
    g.state.donated = new Decimal('1e6');
    const half = met(g, condition);
    expect(half.met).toBe(false);
    expect(half.progress).toBeCloseTo(0.5);
    g.state.donated = new Decimal('1e12');
    expect(met(g, condition)).toEqual({ progress: 1, met: true });
  });

  it('has one achievement per title, each met at the threshold of its title and not before', () => {
    const ids = ['donate-voluntario', 'donate-apoiador', 'donate-patrocinador', 'donate-mecenas', 'donate-benfeitor', 'donate-nome'];
    donationTitles.forEach((title, i) => {
      const g = game();
      const def = byId(ids[i]!);
      g.state.donated = new Decimal(title.threshold).div(2);
      expect(measureCondition(g.state, content, def.condition, createProbe(g.state, content)).met, title.id).toBe(false);
      g.state.donated = new Decimal(title.threshold);
      expect(measureCondition(g.state, content, def.condition, createProbe(g.state, content)).met, title.id).toBe(true);
    });
  });

  it('reads "current / target" in the detail', () => {
    const g = game();
    g.state.donated = new Decimal(500);
    expect(detail(g, 'donate-voluntario').text).toMatch(/^500 \/ .* moedas doadas$/);
  });
});

describe('Doação Generosa', () => {
  it('needs everything in hand given at once, from 1 Sp up', () => {
    const small = game();
    small.state.coins = new Decimal('5e23');
    donateToCampus(small.state, content, new Decimal('5e23'), T0, small.emit);
    expect(small.state.secrets['donate-all']).toBeUndefined();

    const partial = game();
    partial.state.coins = new Decimal('4e24');
    donateToCampus(partial.state, content, new Decimal('2e24'), T0, partial.emit);
    expect(partial.state.secrets['donate-all']).toBeUndefined();

    const all = game();
    all.state.coins = new Decimal('4e24');
    donateToCampus(all.state, content, new Decimal('4e24'), T0, all.emit);
    expect(all.state.secrets['donate-all']).toBe(true);
    expect(met(all, { kind: 'flag', flag: 'donate-all' }).met).toBe(true);
    // The donation action already scans the achievements.
    expect(all.state.achievements['donate-all']).toBeDefined();
    expect(all.state.achievements['donate-apoiador']).toBeDefined();
  });

  it('survives a save', () => {
    const g = game();
    g.state.coins = new Decimal('1e25');
    donateToCampus(g.state, content, new Decimal('1e25'), T0, g.emit);
    const loaded = deserializeState(serializeState(g.state), content, T0);
    expect(loaded?.secrets['donate-all']).toBe(true);
  });
});

describe('lab conditions', () => {
  it('labStat reads the unlock, the best phase, broken monitors and recycled items', () => {
    const g = game();
    expect(met(g, { kind: 'labStat', stat: 'unlocked', gte: 1 }).met).toBe(false);
    g.state.lab.unlocked = true;
    expect(met(g, { kind: 'labStat', stat: 'unlocked', gte: 1 }).met).toBe(true);
    g.state.lab.bestPhase = 20;
    expect(met(g, { kind: 'labStat', stat: 'bestPhase', gte: 25 })).toEqual({ progress: 0.8, met: false });
    g.state.lab.bestPhase = 25;
    expect(met(g, { kind: 'labStat', stat: 'bestPhase', gte: 25 }).met).toBe(true);
    g.state.lab.counters.broken = 9;
    expect(met(g, { kind: 'labStat', stat: 'broken', gte: 10 }).met).toBe(false);
    g.state.lab.counters.broken = 10;
    expect(met(g, { kind: 'labStat', stat: 'broken', gte: 10 }).met).toBe(true);
    g.state.lab.counters.itemsRecycled = 99;
    expect(met(g, { kind: 'labStat', stat: 'itemsRecycled', gte: 100 }).met).toBe(false);
    g.state.lab.counters.itemsRecycled = 100;
    expect(met(g, { kind: 'labStat', stat: 'itemsRecycled', gte: 100 }).met).toBe(true);
  });

  it('labEquipped counts the items of one rarity worn right now', () => {
    const g = game();
    const bases = content.lab.bases.filter((base) => base.drops);
    const slots = ['ferramenta', 'setup', 'acessorio', 'amuleto'] as const;
    const condition: Condition = { kind: 'labEquipped', rarity: 'lendario', gte: 4 };
    slots.forEach((slot, i) => {
      g.state.lab.turma.equipped[slot] = item(bases.find((base) => base.slot === slot)!.id, i < 3 ? 'lendario' : 'epico', i + 1);
    });
    expect(met(g, condition)).toEqual({ progress: 0.75, met: false });
    g.state.lab.turma.equipped.amuleto!.rarity = 'lendario';
    expect(met(g, condition)).toEqual({ progress: 1, met: true });
    expect(detail(g, 'lab-legendary-4').text).toBe('4 / 4 itens lendários equipados');
  });

  it('labSet counts the pieces of one set, for both sets', () => {
    for (const [set, id] of [['guilda-dos-professores', 'lab-set-guilda'], ['kit-plantao', 'lab-set-plantao']] as const) {
      const g = game();
      const pieces = content.lab.bases.filter((base) => base.set === set);
      expect(pieces.length, set).toBeGreaterThanOrEqual(4);
      const slots = ['ferramenta', 'setup', 'acessorio', 'amuleto'] as const;
      slots.slice(0, 3).forEach((slot) => {
        const base = pieces.find((entry) => entry.slot === slot);
        if (base) g.state.lab.turma.equipped[slot] = item(base.id);
      });
      expect(met(g, byId(id).condition).met, `${set} with 3`).toBe(false);
      for (const slot of slots) {
        const base = pieces.find((entry) => entry.slot === slot);
        if (base) g.state.lab.turma.equipped[slot] = item(base.id);
      }
      expect(met(g, byId(id).condition).met, `${set} with 4`).toBe(true);
    }
  });

  it('labTree meets for one full branch, and for the whole tree only when every node is full', () => {
    const g = game();
    expect(met(g, { kind: 'labTree', scope: 'branch' }).met).toBe(false);
    const full = (branch: string) => {
      for (const node of content.lab.tree) if (node.branch === branch) g.state.lab.tree[node.id] = node.maxLevel;
    };
    // One level short in a branch is not enough.
    full('infra');
    const anInfra = content.lab.tree.find((node) => node.branch === 'infra')!;
    g.state.lab.tree[anInfra.id] = anInfra.maxLevel - 1;
    expect(met(g, { kind: 'labTree', scope: 'branch' }).met).toBe(false);
    g.state.lab.tree[anInfra.id] = anInfra.maxLevel;
    expect(met(g, { kind: 'labTree', scope: 'branch' })).toEqual({ progress: 1, met: true });
    expect(met(g, { kind: 'labTree', scope: 'all' }).met).toBe(false);
    full('codigo');
    expect(met(g, { kind: 'labTree', scope: 'all' }).met).toBe(false);
    full('produto');
    expect(met(g, { kind: 'labTree', scope: 'all' })).toEqual({ progress: 1, met: true });
    expect(detail(g, 'lab-tree').text).toBe('100% da árvore');
  });
});

describe('lab flags noted by the engine', () => {
  it('notes which boss fell, from the cycle', () => {
    const g = labGame();
    expect(g.state.secrets[labBossFlag('deploy-de-sexta')]).toBeUndefined();
    clearAt(g, 5);
    expect(g.state.secrets[labBossFlag('deploy-de-sexta')]).toBe(true);
    expect(g.state.secrets[labBossFlag('select-em-producao')]).toBeUndefined();
    clearAt(g, 10);
    expect(g.state.secrets[labBossFlag('select-em-producao')]).toBe(true);
    clearAt(g, 15);
    expect(g.state.secrets[labBossFlag('ia-que-apagou-o-banco')]).toBe(true);
  });

  it('a common phase notes no boss', () => {
    const g = labGame();
    clearAt(g, 3);
    expect(Object.keys(g.state.secrets).filter((key) => key.startsWith('lab-boss:'))).toEqual([]);
  });

  it('Minimalista: the first boss beaten with one item equipped only', () => {
    const lone = labGame();
    expect(Object.keys(lone.state.lab.turma.equipped)).toEqual(['ferramenta']);
    clearAt(lone, 5);
    expect(lone.state.secrets[LAB_FLAGS.minimalist]).toBe(true);

    const two = labGame();
    two.state.lab.turma.equipped.setup = item(content.lab.bases.find((base) => base.slot === 'setup' && base.drops)!.id);
    clearAt(two, 5);
    expect(two.state.secrets[LAB_FLAGS.minimalist]).toBeUndefined();

    // The second boss of a run does not count, even if it is the only item left.
    const late = labGame();
    run(late).bosses = 1;
    clearAt(late, 10);
    expect(late.state.secrets[LAB_FLAGS.minimalist]).toBeUndefined();
  });

  it('Mouse de Estimação: phase 10 cleared with the starting Mouse quebrado still equipped', () => {
    const early = labGame();
    clearAt(early, 9);
    expect(early.state.secrets[LAB_FLAGS.starterMouse]).toBeUndefined();

    const kept = labGame();
    expect(kept.state.lab.turma.equipped.ferramenta?.base).toBe(content.lab.starter);
    clearAt(kept, 10);
    expect(kept.state.secrets[LAB_FLAGS.starterMouse]).toBe(true);

    const swapped = labGame();
    swapped.state.lab.turma.equipped.ferramenta = item(content.lab.bases.find((base) => base.slot === 'ferramenta' && base.drops)!.id);
    clearAt(swapped, 10);
    expect(swapped.state.secrets[LAB_FLAGS.starterMouse]).toBeUndefined();
  });

  it('Sem as Mãos: phase 10 reached with no click on the monitor in that run', () => {
    const hands = labGame();
    run(hands).phase = 9;
    enterNextPhase(hands.state, content);
    expect(run(hands).phase).toBe(10);
    expect(hands.state.secrets[LAB_FLAGS.noHands]).toBe(true);

    const clicked = labGame();
    expect(labClick(clicked.state, content, T0, clicked.emit)).toBe(true);
    expect(run(clicked).clicks).toBe(1);
    run(clicked).phase = 9;
    enterNextPhase(clicked.state, content);
    expect(clicked.state.secrets[LAB_FLAGS.noHands]).toBeUndefined();

    // Reaching phase 9 is not enough.
    const short = labGame();
    run(short).phase = 8;
    enterNextPhase(short.state, content);
    expect(short.state.secrets[LAB_FLAGS.noHands]).toBeUndefined();
  });

  it('counts a click that the rate limit refuses, and keeps the count across a save', () => {
    const g = labGame();
    labClick(g.state, content, T0, g.emit);
    const loaded = deserializeState(serializeState(g.state), content, T0);
    expect(loaded?.lab.turma.run?.clicks).toBe(1);
  });

  it('keeps the flags through a save (they are known to the achievements)', () => {
    const g = labGame();
    clearAt(g, 5);
    const loaded = deserializeState(serializeState(g.state), content, T0);
    expect(loaded?.secrets[labBossFlag('deploy-de-sexta')]).toBe(true);
    expect(loaded?.secrets[LAB_FLAGS.minimalist]).toBe(true);
  });
});

describe('lab achievements granting lab cosmetics', () => {
  it('Reciclador hands out the Gato dormindo and announces it', () => {
    const g = game();
    g.state.lab.unlocked = true;
    g.state.lab.counters.itemsRecycled = 100;
    expect(labCosmeticOwned(content, g.state.lab.cosmetics, 'gato-dormindo-no-monitor')).toBe(false);
    expect(checkAchievements(g.state, content, T0, g.emit)).toContain('lab-recycle-100');
    expect(labCosmeticOwned(content, g.state.lab.cosmetics, 'gato-dormindo-no-monitor')).toBe(true);
    expect(g.events).toContainEqual({ type: 'labCosmeticGained', id: 'gato-dormindo-no-monitor', how: 'grant' });
  });

  it('Arquiteto and Sem as Mãos grant their theme and starting item, once', () => {
    const g = game();
    for (const node of content.lab.tree) if (node.branch === 'codigo') g.state.lab.tree[node.id] = node.maxLevel;
    g.state.secrets[LAB_FLAGS.noHands] = true;
    const unlocked = checkAchievements(g.state, content, T0, g.emit);
    expect(unlocked).toEqual(expect.arrayContaining(['lab-branch', 'secret-lab-hands']));
    expect(labCosmeticOwned(content, g.state.lab.cosmetics, 'tema-grimorio')).toBe(true);
    expect(labCosmeticOwned(content, g.state.lab.cosmetics, 'mousepad-gamer-rgb')).toBe(true);
    expect(grantLabCosmetic(g.state, content, 'tema-grimorio')).toBe(false);
  });

  it('gives a lab cosmetic back after a load when the achievement was unlocked before the lab part of the save existed', () => {
    const g = game();
    g.state.achievements['lab-recycle-100'] = T0;
    const raw = JSON.parse(serializeState(g.state)) as { lab?: unknown };
    delete raw.lab;
    const loaded = deserializeState(JSON.stringify(raw), content, T0);
    expect(loaded && labCosmeticOwned(content, loaded.lab.cosmetics, 'gato-dormindo-no-monitor')).toBe(true);
  });
});

describe('rewards of the late collections', () => {
  it('Corpo Docente Estrelado, Constelação and a Doutor skin follow the stars', () => {
    const g = game();
    for (const id of PROFESSOR_IDS) g.state.postdoc.stars[id] = 1;
    g.state.postdoc.stars.pablo = 3;
    const unlocked = checkAchievements(g.state, content, T0, g.emit);
    expect(unlocked).toEqual(expect.arrayContaining(['postdoc-1', 'postdoc-all', 'postdoc-pablo']));
    expect(unlocked).not.toContain('postdoc-5');
    expect(unlocked).not.toContain('postdoc-edecio');
    expect(g.state.sceneries['salao-da-defesa']).toBe(true);
    expect(g.state.skins['pablo-posdoc']).toBe(true);
    expect(g.state.skins['edecio-posdoc']).toBeUndefined();
  });

  it('the Mecenas title gives the Pablo Mecenas skin', () => {
    const g = game();
    g.state.donated = new Decimal('1e45');
    checkAchievements(g.state, content, T0, g.emit);
    expect(g.state.skins['pablo-mecenas']).toBe(true);
    expect(g.state.sceneries['centro-comunitario']).toBe(true);
    expect(g.state.skins['angelo-nome-no-predio']).toBeUndefined();
  });

  it('the late skins stay out of the rarity feats', () => {
    const g = game();
    const mythics = content.skins.filter((skin) => skin.rarity === 'mythic' && !skin.source);
    for (const skin of mythics) g.state.skins[skin.id] = true;
    expect(met(g, { kind: 'rarityOwned', rarity: 'mythic' }).met).toBe(true);
    // The Panteão asks for the 8 original mythics only, never for the donation skins.
    expect(detail(g, 'mythics-all').text).toBe('8 de 8 skins');
  });
});
