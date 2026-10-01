export interface SectionHeadingProps {
  id: string;
  number: string;
  title: string;
  note: string;
}

export function SectionHeading({ id, number, title, note }: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <span className="section-number" aria-hidden="true">
        {number}
      </span>
      <h2 id={id}>{title}</h2>
      <p>{note}</p>
    </div>
  );
}
