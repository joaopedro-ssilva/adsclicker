import { create } from 'zustand';
import type { Decimal } from '@/game/engine/decimal';

export interface SwarmSummaryData {
  defeated: number;
  total: number;
  bossDefeated: boolean;
  cleared: boolean;
  seconds: number;
  coins: Decimal;
}

/** The result of the last Super invasão, kept until the player closes the summary. Interface only. */
interface SwarmSummaryStore {
  summary: SwarmSummaryData | null;
  show(summary: SwarmSummaryData): void;
  close(): void;
}

export const useSwarmSummary = create<SwarmSummaryStore>((set) => ({
  summary: null,
  show: (summary) => set({ summary }),
  close: () => set({ summary: null }),
}));
