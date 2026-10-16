import type { GameContent } from '@/game/content/types';
import { PROFESSOR_IDS } from '@/game/content/types';
import { ZERO } from '@/game/engine';
import type { GameState } from '@/game/engine/state';
import { postdocTotalPrice } from '@/game/engine/postdoc';

/**
 * Pós-doc stars cannot be forged: the production ceilings read them through computeStats (a star only makes a Domínio
 * a little stronger), so what the server refuses is a save with more stars than the game could have given.
 * Returns the reason, or null when the stars are plausible.
 *
 * - Stars only grow between two syncs.
 * - A professor defends once per turma, so a professor has at most one star per graduation made plus the current turma.
 * - Every star was paid in ADScoins: the prices of all the stars together cannot pass the lifetime coins.
 */
export function judgePostdoc(previous: GameState | null, next: GameState, content: GameContent): string | null {
  const { maxStars } = content.balance.postdoc;
  let paid = ZERO;
  for (const id of PROFESSOR_IDS) {
    const stars = next.postdoc.stars[id];
    if (stars > maxStars) return 'more Pós-doc stars than the cap';
    if (previous && stars < previous.postdoc.stars[id]) return 'Pós-doc stars went backwards';
    if (stars > next.counters.graduations + 1) return 'more Pós-doc stars than turmas';
    paid = paid.add(postdocTotalPrice(content, stars));
  }
  if (paid.gt(next.lifetimeCoins)) return 'Pós-doc stars beyond the coins earned';
  return null;
}
