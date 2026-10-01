import { formatNumber } from '@/game/engine/format';
import type { DecimalSource } from '@/game/engine/decimal';

/** Coin amounts and outputs, pt-BR abbreviated ("12,5 K"). */
export const fmt = (value: DecimalSource): string => formatNumber(value);

/** Whole numbers with thousands separators ("1.234"). */
export const fmtInt = (value: number): string => formatNumber(Math.floor(value), { integer: true });
