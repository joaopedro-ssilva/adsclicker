import { useCoinsPerSecond, useClickValue, useGame } from '@/game/store';
import { formatDuration } from '@/game/engine/format';
import type { CounterKey } from '@/game/content/types';
import { fmt, fmtInt } from '../lib/numbers';
import { Section } from '../lib/Section';

interface Stat {
  label: string;
  value: string;
}

const COUNTER_LABELS: [CounterKey, string][] = [
  ['clicks', 'Cliques'],
  ['crits', 'Críticos'],
  ['maxCombo', 'Combo máximo'],
  ['levelsBought', 'Níveis comprados'],
  ['researchBought', 'Pesquisas feitas'],
  ['eventsDefended', 'Invasões defendidas'],
  ['eventsMissed', 'Invasões perdidas'],
  ['bestEventStreak', 'Melhor sequência'],
  ['abilitiesUsed', 'Habilidades usadas'],
  ['sprintsCompleted', 'Sprints concluídos'],
  ['sprintsFailed', 'Sprints falhos'],
  ['graduations', 'Formaturas'],
  ['professorSwaps', 'Trocas de professor'],
  ['offlineCollections', 'Ganhos offline'],
];

/** The lifetime counters, readable. */
export function Statistics() {
  const counters = useGame((store) => store.state.counters);
  const lifetime = useGame((store) => fmt(store.state.lifetimeCoins));
  const perSecond = useCoinsPerSecond();
  const perClick = useClickValue();

  const stats: Stat[] = [
    { label: 'Tempo de jogo', value: formatDuration(counters.playSeconds * 1000) },
    { label: 'ADScoins ganhos', value: lifetime },
    { label: 'Por segundo', value: fmt(perSecond) },
    { label: 'Por clique', value: fmt(perClick) },
    ...COUNTER_LABELS.map(([key, label]) => ({ label, value: fmtInt(counters[key]) })),
  ];

  return (
    <Section title="Estatísticas">
      <dl className="stats-grid">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
