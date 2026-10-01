import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  /** Right-aligned note on the heading row ("3/10"). */
  note?: ReactNode;
  children: ReactNode;
}

/** A titled group inside a tab. */
export function Section({ title, note, children }: SectionProps) {
  return (
    <section className="panel-section">
      <header className="panel-section-head">
        <h2>{title}</h2>
        {note ? <span className="panel-section-note">{note}</span> : null}
      </header>
      {children}
    </section>
  );
}
