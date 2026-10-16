import { donationTitleById, donationTitles } from '@/game/content/donations';

interface DonorBadgeProps {
  /** Id of a donor title (content/donations.ts). Nothing is drawn for null or an id the content no longer has. */
  id: string | null | undefined;
}

/** The Centro Comunitário title next to a nickname: an emoji and the name, tinted by how far up the ladder it sits. */
export function DonorBadge({ id }: DonorBadgeProps) {
  const title = id ? donationTitleById.get(id) : undefined;
  if (!title) return null;
  return (
    <span className="donor-badge" data-tier={donationTitles.indexOf(title)} title={`${title.name}: ${title.description}`} data-qa="donor-badge">
      <span aria-hidden="true">{title.emoji}</span>
      {title.name}
    </span>
  );
}
