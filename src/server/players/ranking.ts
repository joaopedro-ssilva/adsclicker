/**
 * Test phase switch: while the game is in testing, players flagged by the plausibility check
 * still appear on the boards, in the feed and in the community totals (the flag and its reason
 * are kept, and the admin still sees them). Banned players and test accounts stay out.
 *
 * Set RANK_FLAGGED_PLAYERS=false in the environment to go back to the strict rule, or flip the
 * default here when testing ends. The test suite runs strict (see vitest.config.ts).
 */
export function flaggedAreRanked(): boolean {
  return process.env.RANK_FLAGGED_PLAYERS !== 'false';
}
