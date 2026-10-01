/** "agora" for a few seconds, then the time of day, with the date when it is not today. */
export function formatSavedAt(savedAt: number, now: number): string {
  if (now - savedAt < 60_000) return 'agora';
  const date = new Date(savedAt);
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === new Date(now).toDateString()) return `hoje às ${time}`;
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às ${time}`;
}
