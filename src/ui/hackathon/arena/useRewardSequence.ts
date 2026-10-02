'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ItemInstance } from '@/hackathon/engine';
import { useReducedMotion } from '@/ui/useReducedMotion';

export type RewardStep = 'header' | 'xp' | 'commits' | 'items' | 'promotion' | 'done';

export interface RewardSequence {
  step: RewardStep;
  /** Items shown so far. */
  revealed: number;
  /** A legendary waiting for the player in a full-screen scene. */
  legendary: ItemInstance | null;
  promotionOpen: boolean;
  closeLegendary(): void;
  closePromotion(): void;
  /** Jumps to the end (a promotion scene still plays). */
  skip(): void;
}

interface SequenceInput {
  items: ItemInstance[];
  promoted: boolean;
  /** Level steps of the XP bar: each takes a moment. */
  levelSteps: number;
}

const ITEM_GAP_MS = 1000;

/**
 * The order of the rewards screen: verdict, XP bar, Commits, each item one at a time (a legendary takes the
 * screen and waits), the promotion. All timing lives here so the components only draw what has been reached.
 */
export function useRewardSequence({ items, promoted, levelSteps }: SequenceInput): RewardSequence {
  const reduced = useReducedMotion();
  const [step, setStep] = useState<RewardStep>('header');
  const [revealed, setRevealed] = useState(0);
  const [legendary, setLegendary] = useState<ItemInstance | null>(null);
  const [promotionShown, setPromotionShown] = useState(false);

  const afterItems: RewardStep = promoted && !promotionShown ? 'promotion' : 'done';
  const speed = reduced ? 0.3 : 1;

  useEffect(() => {
    if (legendary) return; // waiting for the player
    let after: number | null = null;
    let next: () => void = () => undefined;
    if (step === 'header') {
      after = 400;
      next = () => setStep('xp');
    } else if (step === 'xp') {
      after = levelSteps * 850 + 700;
      next = () => setStep('commits');
    } else if (step === 'commits') {
      after = 1200;
      next = () => setStep('items');
    } else if (step === 'items') {
      if (revealed >= items.length) {
        after = 700;
        next = () => setStep(afterItems);
      } else {
        const upcoming = items[revealed];
        after = ITEM_GAP_MS;
        next = () => {
          if (upcoming?.rarity === 'lendario') setLegendary(upcoming);
          else setRevealed((count) => count + 1);
        };
      }
    }
    if (after === null) return;
    const timer = setTimeout(next, after * speed);
    return () => clearTimeout(timer);
  }, [step, revealed, legendary, items, levelSteps, afterItems, speed]);

  const closeLegendary = useCallback(() => {
    setLegendary(null);
    setRevealed((count) => count + 1);
  }, []);

  const closePromotion = useCallback(() => {
    setPromotionShown(true);
    setStep('done');
  }, []);

  const skip = useCallback(() => {
    setLegendary(null);
    setRevealed(items.length);
    setStep(promoted && !promotionShown ? 'promotion' : 'done');
  }, [items.length, promoted, promotionShown]);

  return { step, revealed, legendary, promotionOpen: step === 'promotion', closeLegendary, closePromotion, skip };
}
