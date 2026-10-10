/**
 * Players flagged by the plausibility check stay off the boards, the feed and the community totals: the flag
 * and its reason are kept, and the admin can clear it. Banned players and test accounts are always out.
 *
 * During the test phase flagged players were ranked. Setting RANK_FLAGGED_PLAYERS=true brings that back.
 */
export function flaggedAreRanked(): boolean {
  return process.env.RANK_FLAGGED_PLAYERS === 'true';
}
