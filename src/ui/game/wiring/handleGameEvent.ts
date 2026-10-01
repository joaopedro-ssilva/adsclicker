import { content, useGame } from '@/game/store';
import type { GameEvent } from '@/game/store';
import { formatNumber } from '@/game/engine/format';
import { audio } from '@/ui/audio';
import { fx } from '@/ui/fx';
import { toast } from '@/ui/kit';
import { useMoments } from '../moments/momentsStore';
import { forgetLayers } from '../stage/LayerReveal';
import { achievementGrants, invasionById, rewardText, sprintById } from './describe';
import { anchorElement, anchorPoint } from './stageRefs';

const GOLD = '#f7ca75';
const COIN_GAP_MS = 90;
const AUTO_NUMBER_GAP_MS = 450;
const BUY_SOUND_GAP_MS = 70;

let lastCoins = 0;
let lastAuto = 0;
let lastBuy = 0;

function accent(): string {
  return content.professors[useGame.getState().state.activeProfessor].color;
}

function onClick(event: Extract<GameEvent, { type: 'click' }>): void {
  const { settings } = useGame.getState().state;
  const now = performance.now();

  if (event.auto) {
    // Automatic clicks stay quiet: a small rising number now and then, no sound, no coins.
    if (settings.floatingNumbers && now - lastAuto > AUTO_NUMBER_GAP_MS) {
      lastAuto = now;
      const head = anchorPoint('actor', 0.28);
      fx.floatingNumber({
        x: head.x + (Math.random() - 0.5) * 70,
        y: head.y,
        text: `+${formatNumber(event.value)}`,
        color: accent(),
      });
    }
    return;
  }

  const point = event.x !== undefined && event.y !== undefined ? { x: event.x, y: event.y } : anchorPoint('actor', 0.28);
  if (settings.floatingNumbers) {
    fx.floatingNumber({ ...point, text: `+${formatNumber(event.value)}`, crit: event.crit, thumbsUp: event.crit });
  }
  const balance = anchorElement('balance');
  if (balance && (event.crit || now - lastCoins > COIN_GAP_MS)) {
    lastCoins = now;
    fx.coins({ ...point, target: balance, count: event.crit ? 18 : 2, color: GOLD });
  }
  if (event.crit) {
    fx.shake({ intensity: 8, duration: 360 });
    fx.sparkles({ ...point, count: 30, color: GOLD });
  }
  audio.play(event.crit ? 'crit' : 'click');
}

function onInvasionEnd(event: Extract<GameEvent, { type: 'invasionDefended' | 'invasionMissed' }>): void {
  const def = invasionById.get(event.def);
  const point = anchorPoint('invasion');
  if (event.type === 'invasionDefended') {
    audio.play('invasionDefended');
    const balance = anchorElement('balance');
    if (balance && event.reward.kind === 'coins') fx.coins({ ...point, target: balance, count: 22, color: GOLD });
    fx.sparkles({ ...point, count: 36, color: '#78d9a5' });
    fx.floatingNumber({ ...point, text: 'DEFENDIDA!', crit: true, color: '#78d9a5' });
    toast({
      title: `${def?.emoji ?? '🛡️'} ${def?.name ?? 'Invasão'} defendida`,
      description: `${rewardText(event.reward)}${event.streak > 1 ? ` · sequência de ${event.streak}` : ''}`,
      tone: 'good',
      duration: 3500,
    });
  } else {
    audio.play('invasionMissed');
    fx.floatingNumber({ ...point, text: 'PERDIDA', color: '#ff6b6b' });
    toast({
      title: `${def?.emoji ?? '⚠️'} ${def?.name ?? 'Invasão'} escapou`,
      description: 'A sequência de defesas foi zerada.',
      tone: 'bad',
      duration: 3500,
    });
  }
}

/** One place that turns what happened in the game into sound, effects, toasts and ceremonies. */
export function handleGameEvent(event: GameEvent): void {
  switch (event.type) {
    case 'click':
      onClick(event);
      break;
    case 'purchase': {
      const now = performance.now();
      if (now - lastBuy > BUY_SOUND_GAP_MS) {
        lastBuy = now;
        audio.play('buy');
      }
      break;
    }
    case 'milestone':
      audio.play('milestone');
      fx.sparkles({ ...anchorPoint('actor', 0.3), count: 26, color: accent() });
      break;
    case 'hire':
      audio.play('hire');
      useMoments.getState().push({ kind: 'hire', professor: event.professor });
      break;
    case 'achievement': {
      const def = content.achievements.find((entry) => entry.id === event.id);
      if (!def) break;
      audio.play('achievement');
      toast({ title: `Conquista: ${def.name}`, description: achievementGrants(def), emoji: def.emoji, tone: 'good', duration: 6000 });
      break;
    }
    case 'unlock':
      useMoments.getState().pushUnlock({ item: event.kind, itemId: event.id, rarity: event.rarity ?? 'rare' });
      setTimeout(() => audio.play('unlock'), 320);
      break;
    case 'invasionSpawn':
      audio.play('invasionSpawn');
      break;
    case 'invasionHit':
      audio.play('invasionHit');
      fx.sparkles({ ...anchorPoint('invasion'), count: 12, color: '#ff6b6b' });
      break;
    case 'invasionDefended':
    case 'invasionMissed':
      onInvasionEnd(event);
      break;
    case 'abilityUsed': {
      audio.play('ability');
      const ability = content.abilities.find((entry) => entry.id === event.id);
      fx.sparkles({ ...anchorPoint('actor', 0.5), count: 44, color: accent() });
      fx.shake({ intensity: 4, duration: 240 });
      if (ability) {
        fx.floatingNumber({
          ...anchorPoint('actor', 0.1),
          text: `${ability.emoji} ${ability.name.toUpperCase()}`,
          crit: true,
          color: accent(),
        });
      }
      break;
    }
    case 'sprintOffers':
      toast({ title: '📋 Novas sprints', description: 'Escolha uma meta no card do palco.', duration: 4000 });
      break;
    case 'sprintStart':
      audio.play('uiTap');
      break;
    case 'sprintDone': {
      audio.play('sprintDone');
      const def = sprintById.get(event.def);
      fx.confetti({ ...anchorPoint('stage', 0.4), count: 70 });
      toast({
        title: `${def?.emoji ?? '🏁'} Sprint concluída: ${def?.name ?? ''}`,
        description: rewardText(event.reward),
        tone: 'good',
        duration: 5000,
      });
      break;
    }
    case 'sprintFailed': {
      audio.play('sprintFailed');
      const def = sprintById.get(event.def);
      toast({
        title: `${def?.emoji ?? '⏰'} Sprint perdida: ${def?.name ?? ''}`,
        description: 'O prazo acabou. Novas ofertas em instantes.',
        tone: 'warn',
        duration: 4000,
      });
      break;
    }
    case 'graduate':
      audio.play('graduate');
      useMoments.getState().push({ kind: 'graduate', diplomas: event.diplomas });
      break;
    case 'reset':
      fx.clear();
      forgetLayers();
      toast.clear();
      useMoments.getState().clear();
      break;
    default:
      break;
  }
}
