import { useMemo } from 'react';
import { resolveStage } from '@/hackathon/engine';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Badge } from '@/ui/kit';
import { saoPauloDateKey } from '../lib/dateKey';
import { HK } from '../lib/hk';
import { Commits } from '../lib/Commits';
import { whole } from '../lib/labels';
import { useNow } from '../lib/useNow';
import { DropStrip } from './DropStrip';
import { EnemyStrip } from './EnemyStrip';
import { StartControls } from './StartControls';

interface DailyCardProps {
  profile: HackathonProfile;
  auto: boolean;
  onAuto: (value: boolean) => void;
}

/** The Hackathon of the day: the same stage for everybody, with the rules of the day and its own start button. */
export function DailyCard({ profile, auto, onAuto }: DailyCardProps) {
  const now = useNow(60_000);
  const dateKey = saoPauloDateKey(now);
  const stage = useMemo(() => resolveStage('daily', dateKey, HK), [dateKey]);
  const found = useMemo(() => new Set(profile.collection), [profile.collection]);
  if (!stage) return null;
  const wonToday = profile.daily.dateKey === dateKey && profile.daily.clears > 0;

  return (
    <section className="hk-daily hk-card" data-tone="accent" data-won={wonToday} data-qa="hk-daily">
      <header className="hk-daily-head">
        <div>
          <h2>{stage.name}</h2>
          <p className="hk-note">
            Mesma fase para todo mundo hoje · nível {stage.level} · {stage.waves.length} ondas
          </p>
        </div>
        <Badge tone={wonToday ? 'good' : 'warn'}>{wonToday ? `Vencido hoje (${profile.daily.clears}×)` : 'Não vencido hoje'}</Badge>
      </header>

      <ul className="hk-rules" aria-label="Regras do dia">
        {stage.modifiers.map((modifier) => (
          <li key={modifier.id}>
            <strong>{modifier.name}</strong>
            <span>{modifier.description}</span>
          </li>
        ))}
      </ul>

      <EnemyStrip waves={stage.waves} />
      <DropStrip drops={stage.drops} found={found} />

      <p className="hk-rewards">
        <span>{whole(stage.xp)} XP</span>
        <Commits amount={stage.commits} />
      </p>

      <StartControls stageId="daily" profile={profile} auto={auto} onAuto={onAuto} lock={null} qa="hk-start-daily" autoQa="hk-auto-daily" compact />
    </section>
  );
}
