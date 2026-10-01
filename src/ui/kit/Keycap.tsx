import type { HTMLAttributes } from 'react';

export function Keycap({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <kbd className={className ? `ui-keycap ${className}` : 'ui-keycap'} {...props} />;
}
