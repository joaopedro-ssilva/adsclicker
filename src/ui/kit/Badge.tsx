import type { HTMLAttributes } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'bad';
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return <span className={className ? `ui-badge ${className}` : 'ui-badge'} data-tone={tone} {...props} />;
}
