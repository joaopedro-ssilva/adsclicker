import { labBenchView, labMonitorView, labRewardsView, labSlotView, labTreeView } from '../engine/views';
import type { LabBenchView, LabMonitorView, LabRewardsView, LabSlotView, LabTreeView } from '../engine/views';
import { useGameView } from './hooks';

/** The 9th slot in the classroom: hidden until Pablo is hired, then the unlock and the per-turma gate. */
export const useLabSlotView = (): LabSlotView => useGameView(labSlotView);
/** The monitor: phase, integrity, mobs, boss timer and damage numbers. */
export const useLabMonitorView = (): LabMonitorView => useGameView(labMonitorView);
/** The equipped items, the run buffs and the item waiting for a decision. */
export const useLabBenchView = (): LabBenchView => useGameView(labBenchView);
/** The options after a cleared phase. */
export const useLabRewardsView = (): LabRewardsView => useGameView(labRewardsView);
/** The permanent tree bought with Commits. */
export const useLabTreeView = (): LabTreeView => useGameView(labTreeView);
