import { content } from '@/game/content';

interface PostdocBadgeProps {
  /** Pós-doc stars of the professor; the badge renders nothing for 0. */
  stars: number;
  /** Where the badge sits: pinned to a corner of a portrait, or in the flow of a line. */
  placement?: 'corner' | 'inline';
}

/** The golden star with the Pós-doc count that marks a professor's portrait. */
export function PostdocBadge({ stars, placement = 'corner' }: PostdocBadgeProps) {
  if (stars <= 0) return null;
  const bonus = Math.round(content.balance.postdoc.bonusPerStar * stars * 100);
  return (
    <span
      className="postdoc-badge"
      data-placement={placement}
      data-qa="postdoc-badge"
      title={`Pós-doc: ${stars} ${stars === 1 ? 'estrela' : 'estrelas'} (Domínio ${bonus}% mais forte)`}
    >
      <i className="postdoc-star" aria-hidden="true" />
      <b>{stars}</b>
      <span className="sr-only">{stars === 1 ? ' estrela de Pós-doc' : ' estrelas de Pós-doc'}</span>
    </span>
  );
}
