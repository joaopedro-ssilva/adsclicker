import { z } from 'zod';

/** Balances stay far below 2^53 so they fit a bigint column read as a JS number. */
export const MAX_COMMITS = 1_000_000_000_000;
export const MAX_XP = 1_000_000_000_000;

export const addCapped = (current: number, amount: number, cap: number): number => Math.min(cap, current + Math.max(0, Math.floor(amount)));

/** A whole, non-negative number that is safe to store, or 0. */
export const safeWhole = (value: number): number =>
  Number.isFinite(value) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value))) : 0;

export const countsSchema = z.record(z.string(), z.number().int().min(0).max(1_000_000));
