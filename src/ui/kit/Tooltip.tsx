'use client';
import { cloneElement, useId, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactElement } from 'react';

export interface TooltipProps {
  content: string;
  placement?: 'top' | 'bottom';
  /** A single focusable element. It gets aria-describedby while the tip is open. */
  children: ReactElement<HTMLAttributes<HTMLElement>>;
}

const EDGE_GAP = 8;

export function Tooltip({ content, placement = 'top', children }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const tip = useRef<HTMLSpanElement>(null);

  // Slide the tip back inside the viewport when its centred position would overflow an edge.
  useLayoutEffect(() => {
    const node = tip.current;
    if (!open || !node) return;
    node.style.setProperty('--tooltip-shift', '0px');
    const rect = node.getBoundingClientRect();
    const overflowLeft = EDGE_GAP - rect.left;
    const overflowRight = rect.right - (window.innerWidth - EDGE_GAP);
    const shift = overflowLeft > 0 ? overflowLeft : overflowRight > 0 ? -overflowRight : 0;
    node.style.setProperty('--tooltip-shift', `${Math.round(shift)}px`);
  }, [open, content]);

  const describedBy = [children.props['aria-describedby'], open ? id : undefined].filter(Boolean).join(' ');

  return (
    <span
      className="ui-tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      {cloneElement(children, { 'aria-describedby': describedBy || undefined })}
      {open ? (
        <span className="ui-tooltip-content" role="tooltip" id={id} ref={tip} data-placement={placement}>
          {content}
        </span>
      ) : null}
    </span>
  );
}
