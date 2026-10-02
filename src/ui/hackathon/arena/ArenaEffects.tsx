'use client';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { audio } from '@/ui/audio';
import { fx } from '@/ui/fx';
import { useReducedMotion } from '@/ui/useReducedMotion';
import type { FightEvent } from '@/hackathon/engine';
import { subscribeFightEvents } from '../store';
import { wholeNumber } from '../shared/format';
import { skillDefById } from '../shared/lookup';

interface ArenaEffectsProps {
  /** The arena element: queries and shakes stay inside it. */
  root: RefObject<HTMLElement | null>;
  scale: number;
}

const GOLD = '#f7ca75';
const CYAN = '#6ee7ff';
const RED = '#ff6b6b';
const GREEN = '#78d9a5';

function center(element: Element | null | undefined, lift = 0.25): { x: number; y: number } | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height * lift };
}

function play(element: Element | null | undefined, keyframes: Keyframe[], options: KeyframeAnimationOptions): void {
  element?.animate(keyframes, options);
}

/** Turns the events of each tick into hits, numbers, shakes and sounds. Renders nothing. */
export function ArenaEffects({ root, scale }: ArenaEffectsProps) {
  const reduced = useReducedMotion();
  const live = useRef({ reduced, scale });

  useEffect(() => {
    live.current = { reduced, scale };
  }, [reduced, scale]);

  useEffect(() => {
    const find = (selector: string) => root.current?.querySelector(selector) ?? null;
    const enemyBody = (uid: number) => find(`[data-enemy-uid="${uid}"] .ar-enemy-body`);
    const playerBody = () => find('[data-player] .ar-player-body');
    const flash = (element: Element | null, filter: string) =>
      play(element, [{ filter }, { filter: 'brightness(1)' }], { duration: 160, easing: 'steps(3)' });
    const lunge = (element: Element | null, dx: number) =>
      play(element, [{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], {
        duration: 180,
        easing: 'steps(4)',
      });
    const vignette = (kind: 'hurt' | 'crit') => {
      const element = find('.ar-vignette');
      play(element, [{ opacity: kind === 'hurt' ? 0.75 : 0.35 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
    };
    const shake = (intensity: number, duration: number) => {
      const target = root.current;
      if (target && !live.current.reduced) fx.shake({ target, intensity, duration });
    };

    const handle = (event: FightEvent) => {
      const { reduced: calm, scale: zoom } = live.current;
      switch (event.type) {
        case 'playerHit': {
          const body = enemyBody(event.target);
          const at = center(body, 0.15);
          if (at) {
            fx.floatingNumber({
              ...at,
              text: `${event.flow ? '⚡ ' : ''}${wholeNumber(event.damage)}`,
              crit: event.crit,
              color: event.flow ? CYAN : event.crit ? GOLD : undefined,
            });
            if (event.crit) fx.sparkles({ ...at, count: event.flow ? 36 : 22, color: event.flow ? CYAN : GOLD });
            const middle = event.killed ? center(body, 0.5) : null;
            if (middle) fx.sparkles({ ...middle, count: 26, color: '#c9d4e6' });
          }
          if (!calm) {
            lunge(playerBody(), zoom * 9);
            flash(body, event.flow ? 'brightness(3) drop-shadow(0 0 6px #6ee7ff)' : event.crit ? 'brightness(2.6)' : 'brightness(1.8)');
            if (event.crit) shake(event.flow ? 9 : 5, event.flow ? 380 : 240);
            if (event.crit) vignette('crit');
          }
          audio.play(event.crit ? 'crit' : 'click');
          break;
        }
        case 'enemyHit': {
          const target = playerBody();
          const at = center(target, 0.2);
          if (at) {
            fx.floatingNumber({
              ...at,
              text: event.blocked ? 'BLOQUEADO' : `-${wholeNumber(event.damage)}`,
              crit: event.charged,
              color: event.blocked ? CYAN : RED,
            });
            if (event.charged && !event.blocked) fx.sparkles({ ...at, count: 30, color: RED });
          }
          if (!calm) {
            lunge(enemyBody(event.source), -zoom * 9);
            if (!event.blocked) {
              flash(target, 'brightness(2) sepia(1) saturate(6) hue-rotate(-40deg)');
              vignette('hurt');
              shake(event.charged ? 12 : 3, event.charged ? 460 : 180);
            }
          }
          audio.play(event.blocked ? 'invasionDefended' : 'invasionHit');
          break;
        }
        case 'chargeStart':
          audio.play('invasionSpawn');
          break;
        case 'stunned': {
          const at = center(playerBody(), 0);
          if (at) fx.floatingNumber({ ...at, text: 'ATORDOADO!', color: '#ffe066', crit: true });
          audio.play('cantAfford');
          break;
        }
        case 'skill': {
          const def = skillDefById.get(event.skill);
          const at = center(playerBody(), 0.1);
          if (at) {
            fx.floatingNumber({ ...at, text: `${def?.emoji ?? '✨'} ${def?.name ?? event.skill}`, color: GOLD, crit: true });
            fx.sparkles({ ...at, count: 28, color: GOLD });
          }
          if (!calm && def?.effect.kind === 'aoe') shake(7, 300);
          audio.play('ability');
          break;
        }
        case 'heal': {
          const at = center(playerBody(), 0.3);
          if (at) {
            fx.floatingNumber({ ...at, text: `+${wholeNumber(event.amount)}`, color: GREEN });
            fx.sparkles({ ...at, count: 14, color: GREEN });
          }
          break;
        }
        case 'secondWind': {
          const at = center(playerBody(), 0);
          if (at) fx.floatingNumber({ ...at, text: 'SEGUNDO FÔLEGO!', color: GREEN, crit: true });
          audio.play('achievement');
          break;
        }
        case 'waveCleared': {
          // High on the field, clear of the upgrade cards that open right after.
          const at = center(find('.ar-field'), 0.14);
          if (at) {
            fx.floatingNumber({ ...at, text: 'ONDA LIMPA!', color: GREEN, crit: true });
            fx.sparkles({ ...at, count: 40, color: GREEN });
          }
          audio.play('milestone');
          break;
        }
        case 'offer':
          audio.play('unlock');
          break;
        case 'buffPicked':
          audio.play('buy');
          break;
        case 'end': {
          const at = center(find('.ar-field'), 0.4);
          if (event.won && at) {
            fx.confetti({ ...at, count: 110 });
            audio.play('graduate');
          } else {
            audio.play(event.reason === 'timeout' ? 'sprintFailed' : 'invasionMissed');
            shake(8, 420);
          }
          break;
        }
        default:
          break;
      }
    };

    // The listener runs before React has drawn the tick, so the elements it needs are still the ones of the last frame.
    return subscribeFightEvents((events) => events.forEach(handle));
  }, [root]);

  return null;
}
