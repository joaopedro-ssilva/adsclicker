import { eq } from 'drizzle-orm';
import type { EquipRequest, ItemsRequest, MentorRequest, ProfileOnlyResponse, SkillsRequest } from '@/shared/hackathonApi';
import { hackathonItems, hackathonProfiles } from '../db/schema';
import { ApiFailure } from '../http/errors';
import { earnCommits, spendCommits, storeBestItem } from './balance';
import { withProfile } from './context';
import type { HackathonContext } from './context';
import { MAX_COMMITS } from './limits';
import { loadItems, loadSave, removeItems } from './store';
import { unlockedMentors } from './unlock';
import { asCargo, mentorLevels } from './view';

const forbidden = (message: string): ApiFailure => new ApiFailure('forbidden', message);

/** POST /api/hackathon/equip */
export async function equipItem(ctx: HackathonContext, request: EquipRequest): Promise<ProfileOnlyResponse> {
  const profile = await withProfile(ctx, async (tx, row) => {
    const equipped: Record<string, string> = { ...row.equipped };
    if (request.itemId === null) {
      delete equipped[request.slot];
    } else {
      const item = (await loadItems(tx, ctx.player.id)).find((candidate) => candidate.id === request.itemId);
      if (!item) throw new ApiFailure('not_found', 'Item não encontrado.');
      const base = ctx.deps.content.items.find((def) => def.id === item.base);
      if (base?.slot !== request.slot) throw forbidden('Esse item não cabe nesse espaço.');
      // An item sits in one slot only: the slot is the base's, so equipping it elsewhere was refused above.
      equipped[request.slot] = item.id;
    }
    await tx.update(hackathonProfiles).set({ equipped }).where(eq(hackathonProfiles.playerId, ctx.player.id));
  });
  return { profile };
}

/** POST /api/hackathon/skills */
export async function manageSkills(ctx: HackathonContext, request: SkillsRequest): Promise<ProfileOnlyResponse> {
  const { engine, content } = ctx.deps;
  const profile = await withProfile(ctx, async (tx, row) => {
    const where = eq(hackathonProfiles.playerId, ctx.player.id);
    switch (request.action) {
      case 'buy': {
        const node = content.skillNodes.find((def) => def.id === request.node);
        if (!node) throw new ApiFailure('not_found', 'Habilidade não encontrada.');
        const owned = row.skillNodes[node.id] ?? 0;
        if (owned >= node.maxLevel) throw forbidden('Essa habilidade já está no nível máximo.');
        const lock = engine.nodeLock(node.id, row.level, row.skillNodes, content);
        if (lock !== null) throw forbidden(lock);
        if (engine.freeSkillPoints(row.level, row.skillNodes, content) < node.cost) throw forbidden('Pontos de habilidade insuficientes.');
        await tx
          .update(hackathonProfiles)
          .set({ skillNodes: { ...row.skillNodes, [node.id]: owned + 1 } })
          .where(where);
        return;
      }
      case 'respec':
        await spendCommits(tx, ctx.player.id, content.config.respecCommits);
        await tx.update(hackathonProfiles).set({ skillNodes: {}, activeSkills: [] }).where(where);
        return;
      case 'active': {
        const slots = content.cargos.find((cargo) => cargo.id === asCargo(row.cargo, ctx.deps))?.skillSlots ?? 0;
        const wanted = request.skills;
        if (new Set(wanted).size !== wanted.length) throw new ApiFailure('invalid', 'Habilidades repetidas.');
        if (wanted.length > slots) throw forbidden(`Seu cargo tem ${slots} espaço(s) de habilidade.`);
        const available = new Set(
          content.skillNodes.flatMap((node) => (node.unlocksSkill && (row.skillNodes[node.id] ?? 0) > 0 ? [node.unlocksSkill] : [])),
        );
        for (const id of wanted) {
          if (!content.skills.some((skill) => skill.id === id)) throw new ApiFailure('not_found', 'Habilidade não encontrada.');
          if (!available.has(id)) throw forbidden('Você ainda não aprendeu essa habilidade.');
        }
        await tx.update(hackathonProfiles).set({ activeSkills: wanted }).where(where);
        return;
      }
    }
  });
  return { profile };
}

/** POST /api/hackathon/mentors */
export async function buyMentorLevel(ctx: HackathonContext, request: MentorRequest): Promise<ProfileOnlyResponse> {
  const { engine, content } = ctx.deps;
  if (!content.mentors.some((mentor) => mentor.professor === request.professor)) {
    throw new ApiFailure('not_found', 'Mentor não encontrado.');
  }
  const profile = await withProfile(ctx, async (tx, row) => {
    const save = await loadSave(tx, ctx.player.id, ctx.now);
    if (!unlockedMentors(save)[request.professor]) throw forbidden('Contrate esse professor na sala de aula para ele virar seu mentor.');
    const level = mentorLevels(row)[request.professor] ?? 0;
    const cost = engine.mentorCost(request.professor, level, content);
    if (cost === null) throw forbidden('Esse mentor já está no nível máximo.');
    await spendCommits(tx, ctx.player.id, cost);
    await tx
      .update(hackathonProfiles)
      .set({ mentors: { ...row.mentors, [request.professor]: level + 1 } })
      .where(eq(hackathonProfiles.playerId, ctx.player.id));
  });
  return { profile };
}

/** POST /api/hackathon/items */
export async function manageItems(ctx: HackathonContext, request: ItemsRequest): Promise<ProfileOnlyResponse> {
  const { engine, content } = ctx.deps;
  const profile = await withProfile(ctx, async (tx, row) => {
    const items = await loadItems(tx, ctx.player.id);
    if (request.action === 'recycle') {
      const ids = [...new Set(request.itemIds)];
      const equipped = new Set(Object.values(row.equipped));
      const chosen = ids.map((id) => items.find((item) => item.id === id));
      if (chosen.some((item) => item === undefined)) throw new ApiFailure('not_found', 'Item não encontrado.');
      if (ids.some((id) => equipped.has(id))) throw forbidden('Tire o item do seu aluno antes de reciclar.');
      const gain = chosen.reduce((sum, item) => sum + (item ? Math.max(0, Math.floor(engine.recycleValue(item, content))) : 0), 0);
      // The delete reports how many rows it removed: a concurrent recycle of the same item cannot pay twice.
      if ((await removeItems(tx, ctx.player.id, ids)) !== ids.length) throw new ApiFailure('not_found', 'Item não encontrado.');
      await earnCommits(tx, ctx.player.id, Math.min(gain, MAX_COMMITS));
      await storeBestItem(
        tx,
        ctx.player.id,
        items.filter((item) => !ids.includes(item.id)),
        ctx.deps,
      );
      return;
    }

    const item = items.find((candidate) => candidate.id === request.itemId);
    if (!item) throw new ApiFailure('not_found', 'Item não encontrado.');
    if (request.affixIndex < 1 || request.affixIndex >= item.affixes.length)
      throw new ApiFailure('invalid', 'Esse atributo não pode ser rerrolado.');
    await spendCommits(tx, ctx.player.id, engine.rerollCost(item, content));
    const rolled = engine.rerollAffix(item, request.affixIndex, ctx.deps.rng, content);
    // The price doubles per reroll; make sure the counter moves even if the engine forgot to.
    const next = { ...rolled, id: item.id, base: item.base, rerolls: Math.max(rolled.rerolls, item.rerolls + 1) };
    await tx
      .update(hackathonItems)
      .set({ affixes: next.affixes, quality: next.quality, rerolls: next.rerolls })
      .where(eq(hackathonItems.id, item.id));
    await storeBestItem(
      tx,
      ctx.player.id,
      items.map((candidate) => (candidate.id === item.id ? next : candidate)),
      ctx.deps,
    );
  });
  return { profile };
}
