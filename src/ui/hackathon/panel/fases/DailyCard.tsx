import { useMemo } from 'react';
import { resolveStage } from '@/hackathon/engine';
import type { HackathonProfile } from '@/shared/hackathonApi';
import { Badge } from '@/ui/kit';
import { HK } from '../lib/hk';
import { Commits } from '../lib/Commits';
import { whole } from '../lib/labels';
import { DropStrip } from './DropStrip';
import { EnemyStrip } from './EnemyStrip';
import { StartControls } from './StartControls';
import { useDailyStatus } from './useDailyStatus';

/** The Hackathon of the day: the same stage for everybody, with the rules of the day and its own start button. */
export function DailyCard({ profile }: { profile: HackathonProfile }) {
  const { dateKey, won, clears } = useDailyStatus(profile);
  const stage = useMemo(() => resolveStage('daily', dateKey, HK), [dateKey]);
  const found = useMemo(() => new Set(profile.collection), [profile.collection]);
  if (!stage) return null;

  return (
    <section className="hk-daily" data-won={won} data-qa="hk-daily" aria-label="Hackathon diário">
      <div className="hk-daily-info">
        <header className="hk-daily-head">
          <p className="hk-eyebrow">Hackathon diário</p>
          <Badge tone={won ? 'good' : 'warn'}>{won ? `Vencido hoje (${clears}×)` : 'Não vencido hoje'}</Badge>
        </header>
        <h3>{stage.name}</h3>
        <p className="hk-note">
          Mesma fase para todo mundo · nível {stage.level} · {stage.waves.length} ondas
        </p>

        <ul className="hk-rules" aria-label="Regras do dia">
          {stage.modifiers.map((modifier) => (
            <li key={modifier.id}>
              <strong>{modifier.name}</strong>
              <span>{modifier.description}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="hk-daily-side">
        <div className="hk-daily-lists">
          <EnemyStrip waves={stage.waves} />
          <DropStrip drops={stage.drops} found={found} />
        </div>

        <p className="hk-rewards">
          <span>{whole(stage.xp)} XP</span>
          <Commits amount={stage.commits} />
        </p>

        <StartControls stageId="daily" profile={profile} lock={null} qa="hk-start-daily" autoQa="hk-auto-daily" compact />
      </div>
    </section>
  );
}
