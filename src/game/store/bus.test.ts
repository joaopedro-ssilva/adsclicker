import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearGameEventListeners, emitGameEvent, subscribeGameEvents } from './bus';
import type { GameEvent } from './types';

afterEach(() => clearGameEventListeners());

describe('event bus', () => {
  it('delivers events to every subscriber until they unsubscribe', () => {
    const a: GameEvent[] = [];
    const b: GameEvent[] = [];
    const offA = subscribeGameEvents((e) => a.push(e));
    subscribeGameEvents((e) => b.push(e));

    emitGameEvent({ type: 'saved' });
    offA();
    emitGameEvent({ type: 'loaded' });

    expect(a).toEqual([{ type: 'saved' }]);
    expect(b).toEqual([{ type: 'saved' }, { type: 'loaded' }]);
  });

  it('keeps delivering when a listener throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const received: GameEvent[] = [];
    subscribeGameEvents(() => {
      throw new Error('boom');
    });
    subscribeGameEvents((e) => received.push(e));
    emitGameEvent({ type: 'reset' });
    expect(received).toEqual([{ type: 'reset' }]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('lets a listener unsubscribe while an event is being delivered', () => {
    const calls: string[] = [];
    const off = subscribeGameEvents(() => {
      calls.push('first');
      off();
    });
    subscribeGameEvents(() => calls.push('second'));
    emitGameEvent({ type: 'saved' });
    emitGameEvent({ type: 'saved' });
    expect(calls).toEqual(['first', 'second', 'second']);
  });
});
