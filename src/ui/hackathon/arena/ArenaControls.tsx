'use client';
import { enemyById, skillDefById } from '../shared/lookup';
import { useHackathon } from '../store';
import type { ActiveRun } from '../store';
import { FlowBar } from './FlowBar';
import { SkillButton } from './SkillButton';

interface ArenaControlsProps {
  run: ActiveRun;
}

/** The bottom of the arena: the Flow bar and the skills. */
export function ArenaControls({ run }: ArenaControlsProps) {
  const useSkill = useHackathon((store) => store.useSkill);
  const { state, build, auto } = run;
  const fighting = state.phase === 'fighting';
  const danger = state.enemies.some((enemy) => {
    const charge = enemyById.get(enemy.def)?.traits.some((trait) => trait.kind === 'charge');
    return charge === true && enemy.chargeLandsAt !== null;
  });

  return (
    <div className="ar-controls" role="group" aria-label="Controles da luta">
      <FlowBar run={run} />
      {state.skills.length > 0 ? (
        <div className="ar-skills" role="group" aria-label="Habilidades">
          {state.skills.map((skill, index) => (
            <SkillButton
              key={skill.id}
              skillId={skill.id}
              readyAt={skill.readyAt}
              tick={state.tick}
              cooldownPercent={build.meta.cooldown}
              slot={index + 1}
              auto={auto}
              hinted={danger && skillDefById.get(skill.id)?.effect.kind === 'block'}
              disabled={!fighting}
              onUse={useSkill}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
