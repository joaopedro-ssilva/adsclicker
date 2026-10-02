const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "2026-10-02": the calendar day in Brazil at `now`. It decides the daily stage and the per-day caps. */
export function dateKeyOf(now: number): string {
  return formatter.format(new Date(now));
}
