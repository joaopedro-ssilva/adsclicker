'use client';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
  /** A small notification dot on the tab (for example "something is affordable"). */
  dot?: boolean;
  /** Rendered as data-qa on the tab button. */
  testId?: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the tab list. */
  label?: string;
  /** Keep inactive panels mounted (hidden). By default only the active panel is rendered. */
  keepMounted?: boolean;
}

export function Tabs({ items, value, onChange, label = 'Seções', keepMounted = false }: TabsProps) {
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabled = items.flatMap((item, position) => (item.disabled ? [] : [position]));
    const current = enabled.indexOf(index);
    let target: number | undefined;
    if (event.key === 'Home') target = enabled[0];
    else if (event.key === 'End') target = enabled[enabled.length - 1];
    else target = enabled[(current + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
    const item = target === undefined ? undefined : items[target];
    if (target === undefined || !item) return;
    onChange(item.value);
    buttons.current[target]?.focus();
  };

  return (
    <div className="ui-tabs">
      <div role="tablist" aria-label={label} className="ui-tablist">
        {items.map((item, index) => (
          <button
            key={item.value}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-controls={`${id}-panel-${index}`}
            aria-selected={item.value === value}
            tabIndex={item.value === value ? 0 : -1}
            disabled={item.disabled}
            data-qa={item.testId}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {item.label}
            {item.dot ? <span className="ui-tab-dot" role="img" aria-label="novidade" /> : null}
          </button>
        ))}
      </div>
      {items.map((item, index) => (
        <div
          key={item.value}
          role="tabpanel"
          id={`${id}-panel-${index}`}
          aria-labelledby={`${id}-tab-${index}`}
          hidden={item.value !== value}
          tabIndex={0}
          className="ui-tabpanel"
        >
          {keepMounted || item.value === value ? item.content : null}
        </div>
      ))}
    </div>
  );
}
