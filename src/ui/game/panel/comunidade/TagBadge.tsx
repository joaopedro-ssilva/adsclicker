import { tagTextColor } from '@/shared/tags';
import { cssVariables } from '@/ui/theme';

/** What a badge needs: a public tag as the API sends it, or a catalogue tag on /admin. */
export interface BadgeTag {
  id: string;
  label: string;
  description: string;
  color: string;
  /** Only seen on /admin: drawn with a dashed border. */
  adminOnly?: boolean;
}

interface TagBadgeProps {
  /** The tags the player holds, highest priority first. */
  tags: readonly BadgeTag[] | undefined;
  /** Draw every tag (the admin list) instead of the first one with a "+N". */
  all?: boolean;
}

function Badge({ tag, more }: { tag: BadgeTag; more?: number }) {
  return (
    <span
      className="tag-badge"
      data-qa="tag-badge"
      data-admin-only={tag.adminOnly || undefined}
      style={cssVariables({ '--tag-bg': tag.color, '--tag-fg': tagTextColor(tag.color) })}
    >
      {tag.label}
      {more ? <span className="tag-badge-more">+{more}</span> : null}
    </span>
  );
}

/**
 * The player's tags next to the nickname. Space is tight there, so by default only the first one
 * is drawn; all of them, with what each one means, are in the tooltip.
 */
export function TagBadge({ tags, all = false }: TagBadgeProps) {
  if (!tags || tags.length === 0) return null;
  const tooltip = tags.map((tag) => (tag.description ? `${tag.label}: ${tag.description}` : tag.label)).join('\n');
  const label = tags.map((tag) => tag.label).join(', ');
  if (all) {
    return (
      <span className="tag-badges" title={tooltip} aria-label={label}>
        {tags.map((tag) => (
          <Badge key={tag.id} tag={tag} />
        ))}
      </span>
    );
  }
  const [first] = tags;
  return (
    <span className="tag-badges" title={tooltip} aria-label={label}>
      <Badge tag={first!} more={tags.length - 1} />
    </span>
  );
}
