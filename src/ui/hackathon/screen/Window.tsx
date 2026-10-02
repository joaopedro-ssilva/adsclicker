import type { ReactNode } from 'react';
import { Icon } from '@/ui/kit';
import type { IconName } from '@/ui/kit';

interface WindowProps {
  title: string;
  icon?: IconName;
  subtitle?: string;
  /** Right side of the header: a counter, a summary, a toggle. */
  aside?: ReactNode;
  /** 'md' 880px, 'lg' 1040px (default), 'xl' 1240px. */
  size?: 'md' | 'lg' | 'xl';
  qa?: string;
  children: ReactNode;
}

/** A framed window centred over the arena: the frame of every Hackathon screen except the hub and the fight. */
export function Window({ title, icon, subtitle, aside, size = 'lg', qa, children }: WindowProps) {
  return (
    <section className="hx-window" data-size={size} data-qa={qa} aria-label={title}>
      <header className="hx-window-head">
        {icon ? (
          <span className="hx-window-icon" aria-hidden="true">
            <Icon name={icon} size={24} />
          </span>
        ) : null}
        <div className="hx-window-title">
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {aside ? <div className="hx-window-aside">{aside}</div> : null}
      </header>
      <div className="hx-window-body">{children}</div>
    </section>
  );
}
