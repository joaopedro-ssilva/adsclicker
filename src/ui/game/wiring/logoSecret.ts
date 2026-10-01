import { fireSecret } from './fireSecret';

const CLICKS = 10;
const WINDOW_MS = 5000;
let stamps: number[] = [];

/** Ten quick clicks on the logo. */
export function registerLogoClick(now = Date.now()): void {
  stamps = [...stamps.filter((stamp) => now - stamp < WINDOW_MS), now];
  if (stamps.length >= CLICKS) {
    stamps = [];
    fireSecret('logo-clicks');
  }
}
