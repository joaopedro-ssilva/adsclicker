import { writeFileSync } from 'node:fs';
const root = 'file:///C:/Users/joaopedro/Documents/Workspace%20-%202026/Ed%C3%A9cio-Clicker-Remastered/src/game';
const { content } = await import(`${root}/content/index.ts`);
const { createInitialState } = await import(`${root}/engine/init.ts`);
const { serializeState } = await import(`${root}/engine/save.ts`);
const { Decimal } = await import(`${root}/engine/decimal.ts`);

const kind = process.argv[2] ?? 'mid';
const out = process.argv[3] ?? `art/preview/saves/${kind}.json`;
const now = Date.now();
const state = createInitialState(content, now);
const hire = (...ids: string[]) => ids.forEach((id) => (state.hired[id] = true));

if (kind === 'mid') {
  hire('gladimir', 'b2', 'wagner');
  state.coins = new Decimal('3.2e7');
  state.runCoins = new Decimal('3.2e7');
  state.lifetimeCoins = new Decimal('3.2e7');
  state.levels = { 'cafe-quentinho': 24, 'programacao': 11 };
  state.combo = { steps: 13, lastClickAt: now };
  state.invasion = { uid: 1, def: 'phishing', spawnedAt: now - 3000, expiresAt: now + 600000, clicksLeft: 2, x: 0.78, y: 0.35 };
  state.invasionSeq = 1;
  state.buffs = [{ id: 'buff-invasion-click', name: 'Clique Turbo', emoji: '⚡', effects: [{ stat: 'clickPower', op: 'mult', value: 10 }], startedAt: now - 5000, endsAt: now + 10000, source: 'invasion' }];
  state.counters.clicks = 800;
}
if (kind === 'late') {
  hire('gladimir', 'b2', 'wagner', 'guto', 'b1', 'angelo');
  state.activeProfessor = 'guto';
  state.coins = new Decimal('4.5e12');
  state.runCoins = new Decimal('4.5e12');
  state.lifetimeCoins = new Decimal('4.5e12');
  state.research['edecio-aula-show'] = true;
  state.combo = { steps: 20, lastClickAt: now };
  state.invasion = { uid: 4, def: 'ddos', spawnedAt: now - 2000, expiresAt: now + 600000, clicksLeft: 9, x: 0.3, y: 0.55 };
  state.invasionSeq = 4;
  state.sprint = { offers: [], active: { def: 'aquecimento', startedAt: now - 20000, endsAt: now + 40000, progress: 24, target: 60 }, nextOffersAt: 0 };
  state.buffs = [
    { id: 'buff-auto-scaling', name: 'Auto Scaling', emoji: '☁️', effects: [], startedAt: now - 10000, endsAt: now + 20000, source: 'ability' },
    { id: 'buff-invasion-production', name: 'Produção Turbo', emoji: '🔥', effects: [], startedAt: now - 5000, endsAt: now + 25000, source: 'invasion' },
  ];
  state.abilityReadyAt = { 'auto-scaling': now + 400000 };
  state.sceneries.laboratorio = true;
  state.equippedScenery = 'laboratorio';
  state.counters.clicks = 5000;
}
if (kind === 'offers') {
  hire('gladimir', 'b2', 'wagner', 'guto', 'b1');
  state.coins = new Decimal('9e11');
  state.sprint = { offers: ['aquecimento', 'maratona-de-cliques', 'dia-de-sorte'], active: null, nextOffersAt: 0 };
  state.counters.clicks = 3000;
}
if (kind === 'away') {
  hire('gladimir');
  state.levels = { 'cafe-quentinho': 30, programacao: 12 };
  state.lastTickAt = now - 3 * 3600_000;
  state.coins = new Decimal('1e5');
}
writeFileSync(out, serializeState(state));
console.log('saved', out);
