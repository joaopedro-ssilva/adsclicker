import { Button, type ButtonProps } from './Button';
import { Icon, type IconName } from './icons';

export interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: IconName;
  /** Accessible name. Icon-only buttons need one. */
  label: string;
}

const ICON_SIZE = { sm: 24, md: 24, lg: 36 } as const;

export function IconButton({ icon, label, size = 'md', className, ...props }: IconButtonProps) {
  return (
    <Button
      size={size}
      className={className ? `ui-icon-button ${className}` : 'ui-icon-button'}
      aria-label={label}
      {...props}
    >
      <Icon name={icon} size={ICON_SIZE[size]} />
    </Button>
  );
}
