import { content, useGame } from '@/game/store';
import type { GameEvent } from '@/game/store';
import { formatDuration, formatNumber } from '@/game/engine/format';
import { audio } from '@/ui/audio';
import { fx } from '@/ui/fx';
import { toast } from '@/ui/kit';
import { useSwarmSummary } from '../stage/maestria/swarmSummaryStore';
import { anchorElement, anchorPoint } from './stageRefs';

const GOLD = '#ffd23f';
const GOOD = '#78d9a5';
const BAD = '#ff6b6b';

let lastKillSound = 0;

/** Where a bug of the swarm sits in the viewport. The bugs' positions are 0..1 of the stage, as for invasions. */
function bugPoint(x: number, y: number): { x: number; y: number } {
  const stage = anchorElement('stage');
  if (!stage) return anchorPoint('actor', 0.3);
  const rect = stage.getBoundingClientRect();
  return { x: rect.left + rect.width * (0.08 + x * 0.84), y: rect.top + rect.height * (0.18 + y * 0.5) };
}

/** The golden mode starts: a gold flourish over the professor and the sound. The clicks after it only get gold numbers. */
function onJoinhaStart(): void {
  const { settings } = useGame.getState().state;
  const point = anchorPoint('actor', 0.28);
  if (settings.floatingNumbers) fx.floatingNumber({ ...point, text: 'MODO OURO', crit: true, color: GOLD, thumbsUp: true });
  fx.sparkles({ ...point, count: 40, color: GOLD });
  fx.shake({ intensity: 5, duration: 320 });
  audio.play('golden');
}

function onRollforward(event: Extract<GameEvent, { type: 'rollforward' }>): void {
  const point = anchorPoint('actor', 0.45);
  const balance = anchorElement('balance');
  if (balance && event.coins.gt(0)) fx.coins({ ...point, target: balance, count: 30, color: GOLD });
  fx.sparkles({ ...point, count: 50, color: '#9ec7ff' });
  fx.shake({ intensity: 6, duration: 300 });
  fx.floatingNumber({ ...point, text: `⏩ +${formatDuration(event.ms)}`, crit: true, color: '#9ec7ff' });
  audio.play('rollforward');
  toast({
    title: `⏩ Rollforward: +${formatDuration(event.ms)}`,
    description: `${event.coins.gt(0) ? `+${formatNumber(event.coins, { integer: true })} ADScoins chegaram de uma vez. ` : ''}As recargas andaram junto.`,
    tone: 'good',
    duration: 4500,
  });
}

let lastDesign = 0;

/** B2's free levels: a quiet mark (they can be frequent), at most one toast every few seconds. */
function onDesignSystem(event: Extract<GameEvent, { type: 'designSystem' }>): void {
  audio.play('uiTap');
  fx.sparkles({ ...anchorPoint('actor', 0.5), count: 16, color: content.professors.b2.color });
  const now = performance.now();
  if (now - lastDesign < 2500) return;
  lastDesign = now;
  const names = event.gifts.map((gift) => content.disciplines.find((def) => def.id === gift.id)?.name ?? gift.id);
  toast({ title: '🎨 Design System', description: `Nível grátis: ${names.join(', ')}.`, tone: 'good', duration: 2500 });
}

function onFesta(event: Extract<GameEvent, { type: 'festaStart' }>): void {
  audio.play('festa');
  fx.confetti({ ...anchorPoint('stage', 0.3), count: 120 });
  fx.shake({ intensity: 7, duration: 400 });
  toast({
    title: '🎉 Festa de lançamento!',
    description: `${formatDuration(event.seconds * 1000)} de caos: ${event.abilities > 0 ? 'todas as habilidades disparadas, ' : ''}tudo mais forte e mais invasões.`,
    tone: 'good',
    duration: 4500,
  });
}

function onBolsa(event: Extract<GameEvent, { type: 'bolsa' }>): void {
  if (event.side === 'buy') {
    audio.play('buy');
    return;
  }
  audio.play(event.profit.gt(0) ? 'milestone' : 'uiTap');
  const balance = anchorElement('balance');
  if (balance && event.profit.gt(0)) fx.coins({ ...anchorPoint('actor', 0.5), target: balance, count: 16, color: GOLD });
  if (event.capped) {
    toast({ title: '📈 Liquidez esgotada', description: 'O mercado não pagou todo o lucro. Ela volta aos poucos.', tone: 'warn', duration: 3500 });
  }
}

function onSwarmHit(event: Extract<GameEvent, { type: 'swarmHit' }>): void {
  const point = bugPoint(event.x, event.y);
  const now = performance.now();
  if (event.killed) {
    fx.sparkles({ ...point, count: event.boss ? 60 : 14, color: event.boss ? GOLD : GOOD });
    if (event.boss) fx.shake({ intensity: 8, duration: 360 });
    if (!event.auto && now - lastKillSound > 50) {
      lastKillSound = now;
      audio.play(event.boss ? 'invasionDefended' : 'invasionHit');
    }
  } else if (!event.auto) {
    fx.sparkles({ ...point, count: 5, color: BAD });
    if (now - lastKillSound > 50) {
      lastKillSound = now;
      audio.play('invasionHit');
    }
  }
}

function onSwarmEnd(event: Extract<GameEvent, { type: 'swarmEnd' }>): void {
  if (event.cleared) fx.confetti({ ...anchorPoint('stage', 0.4), count: 80 });
  const balance = anchorElement('balance');
  if (balance && event.coins.gt(0)) fx.coins({ ...anchorPoint('stage', 0.4), target: balance, count: 30, color: GOLD });
  audio.play(event.cleared ? 'achievement' : 'sprintDone');
  useSwarmSummary.getState().show({
    defeated: event.defeated,
    total: event.total,
    bossDefeated: event.bossDefeated,
    cleared: event.cleared,
    seconds: event.seconds,
    coins: event.coins,
  });
}

/** Sound, effects and toasts of the Maestrias. The golden mode's clicks are ordinary `click` events (gold numbers); its start is `joinhaStart`. */
export function handleMaestriaEvent(event: GameEvent): void {
  switch (event.type) {
    case 'maestria': {
      const def = content.maestrias.defs[event.professor];
      audio.play(event.level === 1 ? 'unlock' : 'milestone');
      fx.sparkles({ ...anchorPoint('actor', 0.5), count: 30, color: content.professors[event.professor].color });
      toast({
        title: `${content.professors[event.professor].name}: ${def.name}`,
        description: event.level === 1 ? 'Maestria liberada.' : `Nível ${event.level}.`,
        tone: 'good',
        duration: 3500,
      });
      break;
    }
    case 'joinhaStart':
      onJoinhaStart();
      break;
    case 'rollforward':
      onRollforward(event);
      break;
    case 'designSystem':
      onDesignSystem(event);
      break;
    case 'festaStart':
      onFesta(event);
      break;
    case 'bolsa':
      onBolsa(event);
      break;
    case 'swarmStart':
      audio.play('invasionSpawn');
      fx.shake({ intensity: 6, duration: 300 });
      toast({ title: '🐛 Super invasão!', description: 'Derrote os bugs antes que escapem. Um chefe chega perto do fim.', tone: 'warn', duration: 4000 });
      break;
    case 'swarmHit':
      onSwarmHit(event);
      break;
    case 'swarmEscape':
      break;
    case 'swarmEnd':
      onSwarmEnd(event);
      break;
    default:
      break;
  }
}
