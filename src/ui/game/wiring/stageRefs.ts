/**
 * Elements of the stage that effects need to aim at (coins fly to the balance, numbers rise from the
 * professor's head). Components register themselves; the event wiring reads them.
 */
export type StageAnchor = 'balance' | 'actor' | 'invasion' | 'stage';

const anchors: Partial<Record<StageAnchor, HTMLElement>> = {};

export function registerAnchor(name: StageAnchor, element: HTMLElement | null): void {
  if (element) anchors[name] = element;
  else delete anchors[name];
}

export function anchorElement(name: StageAnchor): HTMLElement | undefined {
  const element = anchors[name];
  return element?.isConnected ? element : undefined;
}

/** Viewport centre of an anchor, or `fallbackY` of the viewport when it is not on screen. */
export function anchorPoint(name: StageAnchor, vertical = 0.5): { x: number; y: number } {
  const element = anchorElement(name);
  if (!element) return { x: window.innerWidth / 2, y: window.innerHeight * 0.45 };
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height * vertical };
}
