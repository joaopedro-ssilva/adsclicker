const FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Today in São Paulo as YYYY-MM-DD, the key the server uses for the daily stage. */
export function saoPauloDateKey(now: number): string {
  return FORMAT.format(new Date(now));
}

/** "1:23" style countdown (mm:ss), never negative. */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
