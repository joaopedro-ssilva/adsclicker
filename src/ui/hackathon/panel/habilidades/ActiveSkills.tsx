import type { HackathonProfile } from '@/shared/hackathonApi';
import { useHackathon } from '@/ui/hackathon/store';
import { Button } from '@/ui/kit';
import { cargoById, HK, nodeById, skillById } from '../lib/hk';
import { num } from '../lib/labels';
import { useBusy } from '../lib/useBusy';
import { InlineError, useAction } from '../lib/useAction';

/** The active skills: the cargo's slots, which unlocked skill sits in each, and the ones granted by items. */
export function ActiveSkills({ profile }: { profile: HackathonProfile }) {
  const { locked } = useBusy();
  const { run: report, error } = useAction();
  const slots = cargoById.get(profile.cargo)?.skillSlots ?? 0;
  const unlockNode = new Map(HK.skillNodes.flatMap((node) => (node.unlocksSkill ? [[node.unlocksSkill, node] as const] : [])));
  const owned = new Set(HK.skills.filter((skill) => (profile.skillNodes[unlockNode.get(skill.id)?.id ?? ''] ?? 0) > 0).map((skill) => skill.id));
  const chosen = profile.activeSkills.filter((id) => owned.has(id) && skillById.has(id)).slice(0, slots);
  const extras = profile.build.skills.filter((id) => !chosen.includes(id));

  const apply = (next: string[]) => void report(useHackathon.getState().setActiveSkills(next));
  const equip = (id: string) => apply(chosen.length >= slots ? [...chosen.slice(1), id] : [...chosen, id]);
  const remove = (id: string) => apply(chosen.filter((entry) => entry !== id));

  return (
    <div className="hk-active" data-qa="hk-active-skills">
      <ul className="hk-slots-row" aria-label="Espaços de habilidade">
        {Array.from({ length: slots }, (_, index) => {
          const skill = skillById.get(chosen[index] ?? '');
          return (
            <li key={index} className="hk-skill-slot" data-filled={skill !== undefined}>
              <span className="hk-skill-emoji" aria-hidden="true">
                {skill?.emoji ?? '+'}
              </span>
              <span>{skill?.name ?? 'Vazio'}</span>
            </li>
          );
        })}
        {extras.map((id) => (
          <li key={id} className="hk-skill-slot" data-filled="true" data-extra="true" title="Concedida por um item lendário equipado">
            <span className="hk-skill-emoji" aria-hidden="true">
              {skillById.get(id)?.emoji}
            </span>
            <span>{skillById.get(id)?.name}</span>
            <small>extra do item</small>
          </li>
        ))}
      </ul>
      <p className="hk-note">
        {slots} {slots === 1 ? 'espaço' : 'espaços'} neste cargo. {slots < 2 ? 'O próximo cargo libera mais um.' : ''}
      </p>

      <InlineError message={error} />
      <ul className="hk-skill-list">
        {HK.skills.map((skill) => {
          const isOwned = owned.has(skill.id);
          const isOn = chosen.includes(skill.id);
          const node = unlockNode.get(skill.id);
          return (
            <li key={skill.id} className="hk-skill-card" data-on={isOn} data-owned={isOwned}>
              <span className="hk-skill-emoji" aria-hidden="true">
                {skill.emoji}
              </span>
              <div className="hk-skill-text">
                <strong>{skill.name}</strong>
                <span className="hk-note">{skill.description}</span>
                <small>Recarga {num(skill.cooldownMs / 1000, 0)} s</small>
              </div>
              {isOwned ? (
                <Button
                  size="sm"
                  variant={isOn ? 'secondary' : 'primary'}
                  disabled={locked}
                  aria-pressed={isOn}
                  data-qa={`hk-skill-${skill.id}`}
                  onClick={() => (isOn ? remove(skill.id) : equip(skill.id))}
                >
                  {isOn ? 'Remover' : chosen.length >= slots ? 'Trocar' : 'Equipar'}
                </Button>
              ) : (
                <span className="hk-reason">{node ? `Libere em “${nodeById.get(node.id)?.name}”` : 'Bloqueada'}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
