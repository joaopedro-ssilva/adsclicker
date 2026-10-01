import type { ComponentProps } from 'react';

export interface PanelProps extends ComponentProps<'div'> {
  /** `raised` is one step lighter, `inset` is sunken without a drop shadow (use it inside another panel). */
  tone?: 'default' | 'raised' | 'inset';
}

/** The pixel frame: hard border, offset shadow, no blur. */
export function Panel({ tone = 'default', className, ...props }: PanelProps) {
  return <div className={className ? `ui-panel pixel-frame ${className}` : 'ui-panel pixel-frame'} data-tone={tone} {...props} />;
}
