import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';

export interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
}

export function EmptyState({ title, children, action, icon = 'book' }: EmptyStateProps) {
  return (
    <div className="ui-empty">
      <Icon name={icon} size={36} />
      <h3>{title}</h3>
      {children ? <div className="ui-empty-text">{children}</div> : null}
      {action}
    </div>
  );
}
