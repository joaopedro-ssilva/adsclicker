import { sortTitles } from '@/shared/titles';

interface TitleBadgeProps {
  /** Ids of the titles the player holds (as the API sends them). */
  titles: readonly string[] | undefined;
}

/**
 * The player's highest-priority title as a small badge. The rest are not drawn (space is tight
 * next to a nickname) but listed, with what each one means, in the title attribute.
 */
export function TitleBadge({ titles }: TitleBadgeProps) {
  const held = sortTitles(titles);
  const [first, ...others] = held;
  if (!first) return null;
  const all = held.map((title) => `${title.label}: ${title.description}`).join('\n');
  return (
    <span
      className="title-badge"
      data-tone={first.tone}
      data-qa="title-badge"
      title={all}
      aria-label={held.map((title) => title.label).join(', ')}
    >
      {first.label}
      {others.length > 0 ? <span className="title-badge-more">+{others.length}</span> : null}
    </span>
  );
}
