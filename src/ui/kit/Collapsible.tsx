'use client';
import { useId, type ReactNode } from 'react';

export interface CollapsibleProps {
  title: string;
  /** One line that stays visible while closed, so a closed section still says something ("1 vaga livre"). */
  summary?: ReactNode;
  /** Something in here needs the player: shows a small blinking dot on the header. */
  attention?: boolean;
  /** Spoken label of the attention dot. */
  attentionLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rendered as data-qa on the header button. */
  testId?: string;
  /** The body mounts only while open. */
  children: ReactNode;
}

/**
 * A titled block that opens and closes. Controlled: the caller owns `open` (the Formatura tab keeps it in a
 * device-only store). The header is a real button with `aria-expanded` and `aria-controls`; the body stays in the
 * DOM as a hidden region so the reference is valid, but its children only mount while open.
 */
export function Collapsible({
  title,
  summary,
  attention,
  attentionLabel = 'precisa de atenção',
  open,
  onOpenChange,
  testId,
  children,
}: CollapsibleProps) {
  const bodyId = useId();
  return (
    <section className="ui-collapsible" data-open={open}>
      <h2 className="ui-collapsible-heading">
        <button
          type="button"
          className="ui-collapsible-head"
          aria-expanded={open}
          aria-controls={bodyId}
          data-qa={testId}
          onClick={() => onOpenChange(!open)}
        >
          <span className="ui-collapsible-text">
            <span className="ui-collapsible-title">
              {title}
              {attention ? <span className="ui-collapsible-dot" role="img" aria-label={attentionLabel} /> : null}
            </span>
            {summary ? <span className="ui-collapsible-summary">{summary}</span> : null}
          </span>
          <svg
            className="ui-collapsible-chevron"
            viewBox="0 0 8 4"
            width="16"
            height="8"
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            <path d="M0 0h2v1H0zM6 0h2v1H6zM1 1h2v1H1zM5 1h2v1H5zM2 2h4v1H2zM3 3h2v1H3z" fill="currentColor" />
          </svg>
        </button>
      </h2>
      <div id={bodyId} className="ui-collapsible-body" role="region" aria-label={title} hidden={!open}>
        {open ? children : null}
      </div>
    </section>
  );
}
