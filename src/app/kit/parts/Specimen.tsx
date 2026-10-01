import type { ReactNode } from 'react';
import { Panel } from '@/ui/kit';

export interface SpecimenProps {
  title: string;
  code: string;
  className?: string;
  children: ReactNode;
}

/** A labelled panel that frames one component on the showcase page. */
export function Specimen({ title, code, className, children }: SpecimenProps) {
  return (
    <Panel className={className ? `specimen ${className}` : 'specimen'}>
      <div className="specimen-title">
        <h3>{title}</h3>
        <span aria-hidden="true">{code}</span>
      </div>
      {children}
    </Panel>
  );
}
