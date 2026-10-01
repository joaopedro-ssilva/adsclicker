import { describe, expect, it } from 'vitest';
import { FRESH_MEMORY, nextConnectionToast } from './connectionToasts';
import type { ConnectionMemory } from './connectionToasts';

function run(steps: [Parameters<typeof nextConnectionToast>[1], boolean?][]) {
  let memory: ConnectionMemory = FRESH_MEMORY;
  const toasts: (string | null)[] = [];
  for (const [status, unavailable = false] of steps) {
    const next = nextConnectionToast(memory, status, unavailable);
    memory = next.memory;
    toasts.push(next.toast);
  }
  return toasts;
}

describe('nextConnectionToast', () => {
  it('stays quiet when the cloud was never reachable', () => {
    expect(run([['offline'], ['offline'], ['offline', true]])).toEqual([null, null, null]);
  });

  it('warns once when the connection is lost and once when it returns', () => {
    expect(run([['synced'], ['offline'], ['syncing'], ['offline'], ['offline'], ['synced'], ['synced']])).toEqual([
      null,
      'lost',
      null,
      null,
      null,
      'back',
      null,
    ]);
  });
});
