import type { BolsaAssetDef, GameContent } from '../../content/types';
import type { Emit } from '../../store/types';
import { Decimal, ZERO } from '../decimal';
import type { GameState } from '../state';
import { atLevel } from './levelTable';
import { steadyCoinsPerSecond } from './production';
import { maestriaLevel } from './slots';
import type { BolsaAssetState, BolsaHolding, BolsaState } from './types';

/**
 * Bolsa de tokens. Prices are an index around 1 that moves in steps of `stepMs` of game time, driven by the
 * injected rng (three draws per asset per step, whatever happens, so a seed always gives the same market).
 * A holding is `units` shares worth `units x price`, bought with coins and sold for coins.
 *
 * Two limits keep it bounded, so the server can account for it (see maestriaBounds.ts):
 * - the money invested at once is at most `limitMinutes` of the class's production;
 * - profit is paid from the market's liquidity, a bucket of seconds of production that holds at most the same
 *   limit and refills by that much per hour. A sale that would pay more than the bucket holds pays the rest at cost
 *   (the principal always comes back; only the profit is limited).
 */

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
/** Steps simulated when a market opens, so the sparkline is not empty. */
const WARMUP_STEPS = 40;

export const bolsaLevel = (state: GameState): number => maestriaLevel(state, 'pablo');

const emptyHolding = (): BolsaHolding => ({ units: ZERO, cost: ZERO });

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Seconds of production the player can have invested at once, and that the market pays in profit per hour. */
export function bolsaLimitSeconds(state: GameState, content: GameContent): number {
  const level = bolsaLevel(state);
  return level > 0 ? atLevel(content.maestrias.bolsa.limitMinutes, level) * 60 : 0;
}

/** The same limit in coins, at the class's steady production. */
export function bolsaLimit(state: GameState, content: GameContent): Decimal {
  return steadyCoinsPerSecond(state, content).mul(bolsaLimitSeconds(state, content));
}

/** Coins paid for everything held, the Fundo included. */
export function bolsaInvested(state: GameState): Decimal {
  let total = state.maestria.bolsa.fund.cost;
  for (const id in state.maestria.bolsa.assets) total = total.add(state.maestria.bolsa.assets[id]?.held.cost ?? ZERO);
  return total;
}

/** Coins that can still go in. */
export function bolsaRoom(state: GameState, content: GameContent): Decimal {
  return Decimal.max(ZERO, bolsaLimit(state, content).sub(bolsaInvested(state)));
}

export function assetOpen(state: GameState, def: BolsaAssetDef): boolean {
  return bolsaLevel(state) >= def.unlockLevel;
}

/** Growth of the Fundo per minute at the current level. */
export function fundRate(state: GameState, content: GameContent): number {
  const level = bolsaLevel(state);
  return level > 0 ? atLevel(content.maestrias.bolsa.fundPerMinute, level) : 0;
}

/** The next price of an asset, from three draws in [0, 1). Pure: this is the whole market model. */
export function nextPrice(def: BolsaAssetDef, price: number, step: number, a: number, b: number, c: number): number {
  const target =
    def.temperament === 'cyclic'
      ? Math.log(1 + (def.amplitude ?? 0) * Math.sin((2 * Math.PI * step) / Math.max(2, def.periodSteps ?? 60)))
      : 0;
  let log = Math.log(price);
  log += def.revert * (target - log) + def.noise * (2 * a - 1);
  if (def.temperament === 'spiky' && b < (def.spikeChance ?? 0)) {
    const magnitude = 0.6 + 0.8 * Math.abs(c - 0.5) * 2;
    log += (c < 0.5 ? -1 : 1) * (def.spikeSize ?? 0) * magnitude;
  }
  return clamp(Math.exp(log), def.lo, def.hi);
}

function stepMarket(bolsa: BolsaState, content: GameContent, rng: () => number): void {
  const cfg = content.maestrias.bolsa;
  bolsa.step += 1;
  for (const def of cfg.assets) {
    const a = rng();
    const b = rng();
    const c = rng();
    const entry = bolsa.assets[def.id] ?? (bolsa.assets[def.id] = freshAsset(def));
    entry.price = nextPrice(def, entry.price, bolsa.step, a, b, c);
    entry.history.push(entry.price);
    if (entry.history.length > cfg.historyLength) entry.history.splice(0, entry.history.length - cfg.historyLength);
  }
}

function freshAsset(def: BolsaAssetDef): BolsaAssetState {
  return { price: def.start, history: [def.start], held: emptyHolding() };
}

/** Moves the market forward to `now`: opens it on first use, then one step per `stepMs` (at most `catchUpSteps` of a long gap). */
export function updateBolsa(state: GameState, content: GameContent, now: number, rng: () => number): void {
  if (bolsaLevel(state) <= 0) return;
  const cfg = content.maestrias.bolsa;
  const bolsa = state.maestria.bolsa;

  if (bolsa.at <= 0) {
    bolsa.at = now;
    bolsa.liquidity = bolsaLimitSeconds(state, content);
    for (const def of cfg.assets) bolsa.assets[def.id] ??= freshAsset(def);
    for (let i = 0; i < WARMUP_STEPS; i += 1) stepMarket(bolsa, content, rng);
    return;
  }

  const steps = Math.floor((now - bolsa.at) / cfg.stepMs);
  if (steps <= 0) {
    if (now < bolsa.at) bolsa.at = now; // the clock went backwards
    return;
  }
  const limit = bolsaLimitSeconds(state, content);
  const rate = fundRate(state, content);
  for (let i = 0; i < Math.min(steps, cfg.catchUpSteps); i += 1) {
    stepMarket(bolsa, content, rng);
    bolsa.fundIndex += (rate * cfg.stepMs) / MINUTE_MS;
    bolsa.liquidity = Math.min(limit, bolsa.liquidity + (limit * cfg.stepMs) / HOUR_MS);
  }
  bolsa.at += steps * cfg.stepMs;
}

/** What a holding is worth at `price`. */
export const holdingValue = (holding: BolsaHolding, price: number): Decimal => holding.units.mul(price);

function buyInto(state: GameState, holding: BolsaHolding, price: number, amount: Decimal): void {
  holding.units = holding.units.add(amount.div(price));
  holding.cost = holding.cost.add(amount);
  state.coins = Decimal.max(ZERO, state.coins.sub(amount));
}

interface SaleResult {
  /** Coins that reached the wallet. */
  payout: Decimal;
  /** The part of the payout that was profit. */
  profit: Decimal;
  /** The market could not pay all the profit. */
  capped: boolean;
}

function sellFrom(state: GameState, content: GameContent, holding: BolsaHolding, price: number, fraction: number): SaleResult {
  const whole = fraction >= 1;
  const f = clamp(fraction, 0, 1);
  const units = whole ? holding.units : holding.units.mul(f);
  const costPart = whole ? holding.cost : holding.cost.mul(f);
  const value = units.mul(price);

  let payout = value;
  let capped = false;
  let paidSeconds = 0;
  if (value.gt(costPart)) {
    const bolsa = state.maestria.bolsa;
    const cps = steadyCoinsPerSecond(state, content);
    const wanted = cps.gt(0) ? value.sub(costPart).div(cps).toNumber() : Infinity;
    const seconds = Math.min(bolsa.liquidity, wanted);
    capped = seconds < wanted;
    bolsa.liquidity -= seconds;
    // With no production nothing was paid, so no seconds count either.
    if (cps.gt(0)) paidSeconds = seconds;
    payout = costPart.add(cps.mul(seconds));
  }
  holding.units = whole ? ZERO : holding.units.sub(units);
  holding.cost = whole ? ZERO : holding.cost.sub(costPart);

  const profit = Decimal.max(ZERO, payout.sub(costPart));
  state.coins = state.coins.add(payout);
  // Only the profit is new money: the principal was already counted when it was first earned.
  state.runCoins = state.runCoins.add(profit);
  state.lifetimeCoins = state.lifetimeCoins.add(profit);
  state.run.extraCoins = state.run.extraCoins.add(profit);
  state.counters.bolsaProfitSeconds += paidSeconds;
  return { payout, profit, capped };
}

/** The coins a purchase of `fraction` of the room would spend, held to the wallet. */
export function bolsaSpend(state: GameState, content: GameContent, fraction: number): Decimal {
  return Decimal.min(state.coins, bolsaRoom(state, content).mul(clamp(fraction, 0, 1))).floor();
}

/** Buys an asset with `fraction` of the room left under the limit. */
export function buyAsset(state: GameState, content: GameContent, id: string, fraction: number, emit: Emit): boolean {
  const def = content.maestrias.bolsa.assets.find((asset) => asset.id === id);
  const entry = state.maestria.bolsa.assets[id];
  if (!def || !entry || !assetOpen(state, def)) return false;
  const amount = bolsaSpend(state, content, fraction);
  if (amount.lt(1)) return false;
  buyInto(state, entry.held, entry.price, amount);
  emit({ type: 'bolsa', side: 'buy', asset: id, coins: amount, profit: ZERO, capped: false });
  return true;
}

/** Sells `fraction` of what is held of an asset. */
export function sellAsset(state: GameState, content: GameContent, id: string, fraction: number, emit: Emit): boolean {
  const entry = state.maestria.bolsa.assets[id];
  if (!entry || entry.held.units.lte(0) || fraction <= 0) return false;
  const sale = sellFrom(state, content, entry.held, entry.price, fraction);
  emit({ type: 'bolsa', side: 'sell', asset: id, coins: sale.payout, profit: sale.profit, capped: sale.capped });
  return true;
}

export function depositFund(state: GameState, content: GameContent, fraction: number, emit: Emit): boolean {
  if (bolsaLevel(state) <= 0) return false;
  const amount = bolsaSpend(state, content, fraction);
  if (amount.lt(1)) return false;
  buyInto(state, state.maestria.bolsa.fund, state.maestria.bolsa.fundIndex, amount);
  emit({ type: 'bolsa', side: 'buy', asset: 'fundo', coins: amount, profit: ZERO, capped: false });
  return true;
}

export function withdrawFund(state: GameState, content: GameContent, fraction: number, emit: Emit): boolean {
  const bolsa = state.maestria.bolsa;
  if (bolsa.fund.units.lte(0) || fraction <= 0) return false;
  const sale = sellFrom(state, content, bolsa.fund, bolsa.fundIndex, fraction);
  emit({ type: 'bolsa', side: 'sell', asset: 'fundo', coins: sale.payout, profit: sale.profit, capped: sale.capped });
  return true;
}

/** At graduation everything is sold at the price of the moment (the profit counts for the run), so nothing carries over. */
export function liquidateBolsa(state: GameState, content: GameContent): void {
  const bolsa = state.maestria.bolsa;
  for (const id in bolsa.assets) {
    const entry = bolsa.assets[id];
    if (entry && entry.held.units.gt(0)) sellFrom(state, content, entry.held, entry.price, 1);
  }
  if (bolsa.fund.units.gt(0)) sellFrom(state, content, bolsa.fund, bolsa.fundIndex, 1);
}

/** Most profit, in seconds of the class's production, the market can pay in a window: a full bucket plus what refills. */
export function bolsaMaxSeconds(content: GameContent, level: number, windowSeconds: number): number {
  if (level <= 0) return 0;
  return atLevel(content.maestrias.bolsa.limitMinutes, level) * 60 * (1 + Math.max(0, windowSeconds) / 3600);
}
