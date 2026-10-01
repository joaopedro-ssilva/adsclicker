import { toDecimal } from '@/game/engine/decimal';
import { formatNumber } from '@/game/engine/format';
import type { CommunityResponse } from '@/shared/api';
import { Icon, NumberTicker } from '@/ui/kit';
import type { IconName } from '@/ui/kit';
import { Section } from '../lib/Section';

/** NumberTicker only needs a monotonic number: log10 keeps totals past 1e308 finite. */
const hint = (value: string) => toDecimal(value).log10();
const whole = (value: number) => formatNumber(value, { integer: true });

interface StatProps {
  icon: IconName;
  label: string;
  value: string;
  raw: number;
  live?: boolean;
}

function Stat({ icon, label, value, raw, live }: StatProps) {
  return (
    <div className="community-stat">
      <span className="community-stat-label">
        {live ? <span className="community-dot" data-on="true" aria-hidden="true" /> : <Icon name={icon} size={16} />}
        {label}
      </span>
      <NumberTicker className="community-stat-value" value={value} numericHint={raw} />
    </div>
  );
}

export function CommunityStats({ data }: { data: CommunityResponse }) {
  return (
    <Section title="A turma agora">
      {data.eventMultiplier !== 1 ? (
        <div className="community-event" role="status" data-qa="community-event">
          <Icon name="star" size={20} />
          <span>Evento da comunidade: ADScoins ×{formatNumber(data.eventMultiplier)}</span>
        </div>
      ) : null}

      <div className="community-hero">
        <span className="community-stat-label">
          <Icon name="coin" size={16} />
          ADScoins da comunidade
        </span>
        <NumberTicker className="community-hero-value" value={formatNumber(data.coins)} numericHint={hint(data.coins)} />
      </div>

      <div className="community-stats">
        <Stat icon="click" label="Online agora" live value={whole(data.online)} raw={data.online} />
        <Stat icon="book" label="Jogadores" value={whole(data.players)} raw={data.players} />
        <Stat icon="diploma" label="Turmas formadas" value={whole(data.graduations)} raw={data.graduations} />
        <Stat icon="click" label="Cliques" value={formatNumber(data.clicks)} raw={hint(data.clicks)} />
        <Stat icon="trophy" label="Conquistas" value={whole(data.achievements)} raw={data.achievements} />
      </div>
    </Section>
  );
}
