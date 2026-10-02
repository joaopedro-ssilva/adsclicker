import type { ReactNode } from 'react';
import { Icon } from '@/ui/kit';
import type { IconName } from '@/ui/kit';

interface CardProps {
  title?: string;
  icon?: IconName;
  /** Right side of the title row. */
  aside?: ReactNode;
  className?: string;
  qa?: string;
  children: ReactNode;
}

/** A small framed card over the arena (hub cards, the health panels of the fight). */
export function Card({ title, icon, aside, className, qa, children }: CardProps) {
  return (
    <section className={className ? `hx-card ${className}` : 'hx-card'} data-qa={qa} aria-label={title}>
      {title ? (
        <header className="hx-card-head">
          {icon ? <Icon name={icon} size={16} /> : null}
          <h3>{title}</h3>
          {aside ? <div className="hx-card-aside">{aside}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
