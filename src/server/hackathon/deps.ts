import { randomUUID, getRandomValues } from 'node:crypto';
import { hackathonContent } from '@/hackathon/content';
import type { HackathonContent } from '@/hackathon/content/types';
import * as realEngine from '@/hackathon/engine';
import type { HackathonEngine } from '@/hackathon/engine/types';
import { ApiFailure } from '../http/errors';

/**
 * What the services need from the outside. Services take it as an argument (defaulting to the
 * real engine and content) so tests can run them with a tiny fake engine and fixture content.
 */
export interface HackathonDeps {
  engine: HackathonEngine;
  content: HackathonContent;
  /** Float in [0, 1) backed by node:crypto: loot must not be predictable from anything the client sees. */
  rng: () => number;
  newId: () => string;
}

/** 53 random bits as a float in [0, 1). */
export function cryptoRng(): number {
  const [high = 0, low = 0] = getRandomValues(new Uint32Array(2));
  return ((high >>> 5) * 2 ** 26 + (low >>> 6)) / 2 ** 53;
}

export function defaultDeps(): HackathonDeps {
  return { engine: realEngine, content: hackathonContent, rng: cryptoRng, newId: randomUUID };
}

let shared: HackathonDeps | null = null;

/** The real engine and content, built once per instance (the ready check is cached on it). */
export function sharedDeps(): HackathonDeps {
  return (shared ??= defaultDeps());
}

const NOT_READY_MESSAGE = 'O Hackathon ainda não está disponível. Tente de novo mais tarde.';
const PLACEHOLDER = /not implemented yet/;

const readyCache = new WeakSet<HackathonDeps>();

/**
 * True once the engine and the content exist. While either is still a placeholder (empty lists,
 * an engine that throws) routes answer `unavailable` instead of crashing.
 */
export function isReady(deps: HackathonDeps): boolean {
  if (readyCache.has(deps)) return true;
  const { content } = deps;
  if (content.stages.length === 0 || content.cargos.length === 0 || content.heads.length === 0) return false;
  try {
    deps.engine.xpToNext(1, content);
  } catch (error) {
    if (error instanceof Error && PLACEHOLDER.test(error.message)) return false;
    throw error;
  }
  readyCache.add(deps);
  return true;
}

export function assertReady(deps: HackathonDeps): void {
  if (!isReady(deps)) throw new ApiFailure('unavailable', NOT_READY_MESSAGE);
}
